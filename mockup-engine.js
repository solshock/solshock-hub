import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Only POST allowed');

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const { images, sceneType } = req.body;

    // 1. THE VOICE: Gemini 1.5 Pro for Copy
    const textModel = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    const copyPrompt = `
      You are Summer, SOLSHOCK's AI strategist. Write a product description for a piece in this setting: ${sceneType}.
      Strictly follow Rule 7:
      HOOK: One sensory sentence. Lifestyle-forward.
      DETAILS: Two sentences. Benefits, not specs.
      CLOSE: 'This is how you wear the coast.'
      NEVER write more than four lines.
    `;
    const copyPromise = textModel.generateContent(copyPrompt);

    // 2. THE LOOK: Nano Banana for Images
    const imagePromise = fetch('https://api.google.com/nano-banana/v1/compose', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GEMINI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        images: images,
        prompt: `Composite the uploaded logos onto Apliiq blanks worn by Summer. Ensure RGBA transparency is preserved. Scene: ${sceneType}. Generate 4 distinct poses.`,
        outputCount: 4 
      })
    }).then(r => r.json());

    // Wait for both engines to finish
    const [copyResult, imageResult] = await Promise.all([copyPromise, imagePromise]);
    const responseText = await copyResult.response.text();

    return res.status(200).json({ 
      success: true, 
      copy: responseText,
      images: imageResult.outputs || []
    });

  } catch (error) {
    console.error("Engine crash:", error);
    return res.status(500).json({ error: "Reality Check Protocol: Dual-Engine failed." });
  }
}