import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Only POST allowed');

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // Vercel parses JSON automatically
    const { images, sceneType } = req.body || {};

    // 1. THE VOICE: Gemini 1.5 Pro for Copy
    const textModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    const copyPrompt = `
      You are Summer, SOLSHOCK'S AI strategist. Write a product description for a piece in this setting: ${sceneType || 'Coastal'}.
      Strictly follow Rule 7:
      HOOK: One sensory sentence. Lifestyle-forward.
      DETAILS: Two sentences. Benefits, not specs.
      CLOSE: 'This is how you wear the coast.'
      NEVER write more than four lines.
    `;
    
    // Run only the real text engine
    const copyResult = await textModel.generateContent(copyPrompt);
    const responseText = await copyResult.response.text();

    // Send the successful copy back to your dashboard!
    return res.status(200).json({ 
      copy: responseText,
      mockups: [] // We will figure out real image generation tomorrow!
    });

  } catch (error) {
    console.error("ENGINE CRASH:", error);
    return res.status(500).json({ error: "Failed to run engine", details: error.message });
  }
}
 
