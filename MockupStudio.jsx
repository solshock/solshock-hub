import React, { useState } from 'react';

export default function MockupStudio() {
  const [btnText, setBtnText] = useState("Run Photoshoot");
  const [isProcessing, setIsProcessing] = useState(false);
  const [gallery, setGallery] = useState([]);
  const [copy, setCopy] = useState("");

  const handleRunShoot = async () => {
    const logoFiles = document.getElementById('logoUpload').files;
    const summerFiles = document.getElementById('summerReference').files;

    if (!logoFiles.length || !summerFiles.length) {
      alert("Reality Check: I need at least one logo and one photo of me!");
      return;
    }

    setIsProcessing(true);
    setBtnText(`Loading ${logoFiles.length + summerFiles.length} Assets... 📸`);

    const getBase64 = (file) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve({
        base64: reader.result.split(',')[1],
        mimeType: file.type
      });
      reader.onerror = error => reject(error);
    });

    try {
      const allFiles = [...logoFiles, ...summerFiles];
      const processedImages = await Promise.all(allFiles.map(file => getBase64(file)));
      
      setBtnText("Running Dual-Engine AI... ⚡");

      const response = await fetch('/api/mockup-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: processedImages,
          sceneType: "Dawn Phase, standing on the Tampa waterfront at golden hour"
        })
      });

      const result = await response.json();

      if (result.success) {
        setGallery(result.images);
        setCopy(result.copy);
      } else {
        alert("Engine failed.");
      }
    } catch (error) {
      console.error(error);
      alert("Failed to connect to the backend.");
    } finally {
      setIsProcessing(false);
      setBtnText("Run Photoshoot");
    }
  };

  const handleDownload = () => {
    gallery.forEach((imgData, index) => {
      const link = document.createElement('a');
      link.href = `data:image/jpeg;base64,${imgData}`;
      link.download = `SOLSHOCK_Summer_Shot_${index + 1}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'linear-gradient(135deg, #1B2A4A, #1E90FF)', color: '#e8d5a3', fontFamily: 'Helvetica, sans-serif' }}>
      
      {/* SIDEBAR */}
      <div style={{ width: '320px', background: 'rgba(27, 42, 74, 0.8)', padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <h1 style={{ color: '#C9A84C', margin: 0 }}>SOLSHOCK</h1>
        <div style={{ fontSize: '11px', letterSpacing: '2px' }}>MOCKUP STUDIO</div>
        
        <label style={{ marginTop: '20px', fontSize: '13px' }}>1. Brand Assets</label>
        <input type="file" id="logoUpload" accept="image/png" multiple style={{ padding: '10px', background: 'rgba(255,255,255,0.05)' }} />
        
        <label style={{ fontSize: '13px' }}>2. Summer References</label>
        <input type="file" id="summerReference" accept="image/jpeg, image/png" multiple style={{ padding: '10px', background: 'rgba(255,255,255,0.05)' }} />
        
        <button onClick={handleRunShoot} disabled={isProcessing} style={{ marginTop: 'auto', padding: '15px', background: '#C9A84C', color: '#1B2A4A', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
          {btnText}
        </button>
        
        {gallery.length > 0 && (
          <button onClick={handleDownload} style={{ padding: '15px', background: '#FF8C00', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
            Download Mockups
          </button>
        )}
      </div>

      {/* CANVAS */}
      <div style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
        <h2 style={{ color: '#fff' }}>New Collection</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
          {gallery.map((img, i) => (
            <img key={i} src={`data:image/jpeg;base64,${img}`} alt={`Mockup ${i}`} style={{ width: '100%', borderRadius: '12px' }} />
          ))}
        </div>
        {copy && (
          <div style={{ marginTop: '20px', padding: '20px', background: 'rgba(255,255,255,0.1)', borderLeft: '5px solid #C9A84C', borderRadius: '8px' }}>
            <strong>Shopify Copy:</strong><br/><br/>
            <div dangerouslySetInnerHTML={{ __html: copy.replace(/\n/g, '<br>') }} />
          </div>
        )}
      </div>
    </div>
  );
}