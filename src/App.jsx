import { useState, useRef, useEffect } from "react";

const load = (k, fb) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

// ─── SUN LOGO ────────────────────────────────────────────────────────────────
const SunLogo = ({ size = 60, variant = "day" }) => {
  const c = variant === "day"
    ? { rays: ["#FF6B00","#FF9500","#FFB800","#3B82F6"], cir: "#FFA500", text: "#1e3a8a", s: "#FF6B00" }
    : { rays: ["#1e3a8a","#2563eb","#60a5fa","#9333ea"], cir: "#0d1b3e", text: "#f5a623", s: "#f5a623" };
  return (
    <svg width={size} height={size} viewBox="0 0 200 200">
      {Array.from({length:16}).map((_,i)=>{
        const a=(i*22.5)*Math.PI/180, col=c.rays[i%4];
        const x1=100+68*Math.cos(a),y1=100+68*Math.sin(a);
        const x2=100+95*Math.cos(a-.15),y2=100+95*Math.sin(a-.15);
        const x3=100+95*Math.cos(a+.15),y3=100+95*Math.sin(a+.15);
        return <polygon key={i} points={`${x1},${y1} ${x2},${y2} ${x3},${y3}`} fill={col} opacity=".9"/>;
      })}
      <circle cx="100" cy="100" r="65" fill={c.cir}/>
      <circle cx="100" cy="100" r="63" fill="none" stroke={variant==="day"?"#1e3a8a":"#f5a623"} strokeWidth="2"/>
      <text x="100" y="115" textAnchor="middle" fontSize="55" fontWeight="bold" fontFamily="Georgia,serif" fill={c.s}>S</text>
      <path id="tA" d="M 42,100 A 58,58 0 0 1 158,100" fill="none"/>
      <text fontSize="13" fontWeight="bold" fontFamily="Georgia,serif" fill={c.text} letterSpacing="2">
        <textPath href="#tA" startOffset="50%" textAnchor="middle">SOLSHOCK</textPath>
      </text>
      <path id="bA" d="M 42,100 A 58,58 0 0 0 158,100" fill="none"/>
      <text fontSize="9" fontFamily="Georgia,serif" fill={c.text} letterSpacing="1">
        <textPath href="#bA" startOffset="50%" textAnchor="middle">COASTAL CLOTHING CO</textPath>
      </text>
    </svg>
  );
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const ts = () => new Date().toLocaleString("en-US",{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"});
const uid = () => Math.random().toString(36).slice(2);
const fmt$ = n => `$${Number(n).toFixed(2)}`;
const fmtT = s => `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;

const CATS = ["Decision","Copy Draft","Idea","Task","General"];
const ECATS = ["Inventory","Marketing","Design","Shipping","Software","Equipment","Other"];

const DEFAULT_NOTES = [
  {id:uid(),title:"Launch Day",body:"SOLSHOCK went live. Four months in the making. Brand is real. Site is clean. The coast is calling.",cat:"Decision",date:"Mar 2, 2026, 11:59 PM",pinned:true},
  {id:uid(),title:"Solar-Weight™ Strategy",body:"SEO only. Invisible to the customer. Never used in customer-facing copy until the trademark is officially filed. Protect it.",cat:"Decision",date:"Mar 2, 2026, 10:30 AM",pinned:true},
];
const DEFAULT_EXPENSES = [
  {id:uid(),desc:"Shopify Monthly",amount:"39.00",cat:"Software",date:"Mar 1, 2026"},
  {id:uid(),desc:"Logo Design",amount:"250.00",cat:"Design",date:"Feb 14, 2026"},
];

// ─── SUMMER QUOTES (rotate on dashboard) ─────────────────────────────────────
const SUMMER_LINES = [
  "Born at the beach. Raised on the coast. Let's get to work.",
  "The heat is a feature. Never a bug. Now move.",
  "Wild but class. Loud but quiet and beautiful.",
  "Big Sun Energy. Always coastal.",
  "This is how you wear the coast.",
  "Mike leads. Summer writes. Mike approves. Always.",
  "The coast isn't going anywhere. Neither is SOLSHOCK.",
  "A drummer who never played a cover song built this brand. Remember that.",
  "From sunrise to sunset — every day is a drop.",
  "We don't do cold. We make gear for the coast people.",
];

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function SolshockHub() {
  const [tab, setTab] = useState("dashboard");
  const [notes, setNotes] = useState(() => load("ss_notes", DEFAULT_NOTES));
  const [expenses, setExpenses] = useState(() => load("ss_expenses", DEFAULT_EXPENSES));
  const [receipts, setReceipts] = useState(() => load("ss_receipts", []));
  const [voiceMemos, setVoiceMemos] = useState([]);
  const [toast, setToast] = useState(null);
  const summerLine = SUMMER_LINES[new Date().getDate() % SUMMER_LINES.length];

  useEffect(() => save("ss_notes", notes), [notes]);
  useEffect(() => save("ss_expenses", expenses), [expenses]);
  useEffect(() => save("ss_receipts", receipts), [receipts]);

  const showToast = (msg, type="success") => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };

  const TABS = [
    {id:"dashboard",icon:"☀️",label:"Dashboard"},
    {id:"notes",icon:"📝",label:"Notes"},
    {id:"voice",icon:"🎤",label:"Voice"},
    {id:"receipts",icon:"📷",label:"Receipts"},
    {id:"expenses",icon:"💰",label:"Expenses"},
    {id:"brand",icon:"🌊",label:"Brand"},
  ];

  return (
    <div style={{fontFamily:"Georgia,serif",background:"#080c14",minHeight:"100vh",color:"#e8d5a3",position:"relative"}}>
      <div style={{position:"fixed",inset:0,background:"radial-gradient(ellipse at top,#1a1000 0%,#080c14 50%,#000510 100%)",zIndex:0}}/>
      <div style={{position:"fixed",top:0,left:0,right:0,height:"3px",background:"linear-gradient(90deg,#FF6B00,#FFB800,#FF9500,#3B82F6,#FF6B00)",zIndex:10}}/>

      <div style={{position:"relative",zIndex:5,padding:"16px 20px 0",display:"flex",alignItems:"center",gap:14,borderBottom:"1px solid rgba(245,166,35,0.15)"}}>
        <SunLogo size={50} variant="day"/>
        <div>
          <div style={{fontSize:20,fontWeight:"bold",color:"#f5a623",letterSpacing:3}}>SOLSHOCK</div>
          <div style={{fontSize:10,color:"#888",letterSpacing:2}}>BUSINESS HUB · MMXXVI</div>
        </div>
        <div style={{marginLeft:"auto",textAlign:"right"}}>
          <div style={{fontSize:10,color:"#f5a623",opacity:.8}}>Stay Cool ❄️, Summer</div>
          <div style={{fontSize:9,color:"#555"}}>{new Date().toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})}</div>
        </div>
      </div>

      <div style={{position:"relative",zIndex:5,display:"flex",borderBottom:"1px solid rgba(245,166,35,0.1)",background:"rgba(0,0,0,0.3)"}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,minWidth:55,padding:"10px 4px",border:"none",background:tab===t.id?"rgba(245,166,35,0.12)":"transparent",borderBottom:tab===t.id?"2px solid #f5a623":"2px solid transparent",color:tab===t.id?"#f5a623":"#666",fontSize:11,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2,transition:"all .2s"}}>
            <span style={{fontSize:16}}>{t.icon}</span>
            <span style={{letterSpacing:.5}}>{t.label}</span>
          </button>
        ))}
      </div>

      <div style={{position:"relative",zIndex:5,padding:"20px 16px 100px"}}>
        {tab==="dashboard" && <Dashboard notes={notes} expenses={expenses} voiceMemos={voiceMemos} receipts={receipts} setTab={setTab} summerLine={summerLine}/>}
        {tab==="notes" && <Notes notes={notes} setNotes={setNotes} showToast={showToast}/>}
        {tab==="voice" && <VoiceMemos memos={voiceMemos} setMemos={setVoiceMemos} showToast={showToast}/>}
        {tab==="receipts" && <Receipts receipts={receipts} setReceipts={setReceipts} showToast={showToast}/>}
        {tab==="expenses" && <Expenses expenses={expenses} setExpenses={setExpenses} showToast={showToast}/>}
        {tab==="brand" && <BrandAssets/>}
      </div>

      {toast && (
        <div style={{position:"fixed",bottom:80,left:"50%",transform:"translateX(-50%)",background:toast.type==="success"?"#1a3a1a":"#3a1a1a",border:`1px solid ${toast.type==="success"?"#4ade80":"#f87171"}`,color:toast.type==="success"?"#4ade80":"#f87171",padding:"10px 20px",borderRadius:8,fontSize:13,zIndex:100,letterSpacing:.5,whiteSpace:"nowrap"}}>{toast.msg}</div>
      )}
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({notes,expenses,voiceMemos,receipts,setTab,summerLine}) {
  const total = expenses.reduce((s,e)=>s+parseFloat(e.amount||0),0);
  const pinned = notes.filter(n=>n.pinned);
  const stats = [
    {label:"Notes",val:notes.length,icon:"📝",tab:"notes",color:"#f5a623"},
    {label:"Voice Memos",val:voiceMemos.length,icon:"🎤",tab:"voice",color:"#60a5fa"},
    {label:"Receipts",val:receipts.length,icon:"📷",tab:"receipts",color:"#4ade80"},
    {label:"Total Spent",val:fmt$(total),icon:"💰",tab:"expenses",color:"#f87171"},
  ];
  return (
    <div>
      {/* Summer Morning Card */}
      <div style={{background:"linear-gradient(135deg,rgba(245,166,35,0.08),rgba(255,107,0,0.05))",border:"1px solid rgba(245,166,35,0.25)",borderRadius:16,padding:"18px 20px",marginBottom:20,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-20,right:-20,opacity:.06,fontSize:100}}>☀️</div>
        <div style={{fontSize:9,color:"#f5a623",letterSpacing:2,marginBottom:8}}>☀️ MORNING MEETING</div>
        <div style={{fontSize:13,color:"#e8d5a3",lineHeight:1.6,fontStyle:"italic"}}>"{summerLine}"</div>
        <div style={{fontSize:9,color:"#888",marginTop:10,letterSpacing:1}}>— Stay Cool ❄️, Summer</div>
      </div>

      <div style={{textAlign:"center",marginBottom:20}}>
        <SunLogo size={80} variant="day"/>
        <div style={{fontSize:11,color:"#888",marginTop:6,letterSpacing:2}}>BIG SUN ENERGY. ALWAYS COASTAL.</div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
        {stats.map(s=>(
          <button key={s.label} onClick={()=>setTab(s.tab)} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(245,166,35,0.15)",borderRadius:12,padding:"16px 12px",cursor:"pointer",textAlign:"left",color:"#e8d5a3"}}>
            <div style={{fontSize:22,marginBottom:6}}>{s.icon}</div>
            <div style={{fontSize:20,fontWeight:"bold",color:s.color}}>{s.val}</div>
            <div style={{fontSize:10,color:"#666",letterSpacing:1,marginTop:2}}>{s.label.toUpperCase()}</div>
          </button>
        ))}
      </div>

      {pinned.length>0 && (
        <div style={{marginBottom:20}}>
          <div style={{fontSize:10,color:"#f5a623",letterSpacing:2,marginBottom:10}}>📌 LOCKED DECISIONS</div>
          {pinned.map(n=>(
            <div key={n.id} style={{background:"rgba(245,166,35,0.05)",border:"1px solid rgba(245,166,35,0.2)",borderRadius:10,padding:"12px 14px",marginBottom:8}}>
              <div style={{fontSize:13,fontWeight:"bold",color:"#f5a623",marginBottom:4}}>{n.title}</div>
              <div style={{fontSize:11,color:"#aaa",lineHeight:1.5}}>{n.body.slice(0,120)}{n.body.length>120?"…":""}</div>
            </div>
          ))}
        </div>
      )}

      {/* Priority List from Daily Report */}
      <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(245,166,35,0.12)",borderRadius:12,padding:16,marginBottom:16}}>
        <div style={{fontSize:10,color:"#f5a623",letterSpacing:2,marginBottom:12}}>🎯 NEXT SESSION PRIORITIES</div>
        {["Send Apliiq board shorts email","Write product descriptions — Hook, Details, Close — every SKU","Build bundle pages in Shopify","Select & contact non-profit partner","Sample arrival Mar 15–17 — Mirror Test + Laundry Test"].map((item,i)=>(
          <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:8}}>
            <span style={{color:"#f5a623",fontSize:11,minWidth:18}}>{i+1}.</span>
            <span style={{fontSize:11,color:"#aaa",lineHeight:1.5}}>{item}</span>
          </div>
        ))}
      </div>

      <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(245,166,35,0.1)",borderRadius:12,padding:16}}>
        <div style={{fontSize:10,color:"#f5a623",letterSpacing:2,marginBottom:10}}>⚡ QUICK ADD</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {["📝 Note","🎤 Voice","📷 Receipt","💰 Expense"].map((label,i)=>{
            const ts=["notes","voice","receipts","expenses"];
            return <button key={label} onClick={()=>setTab(ts[i])} style={{background:"rgba(245,166,35,0.1)",border:"1px solid rgba(245,166,35,0.25)",borderRadius:8,padding:"8px 14px",color:"#f5a623",fontSize:12,cursor:"pointer"}}>{label}</button>;
          })}
        </div>
      </div>
    </div>
  );
}

// ─── NOTES ────────────────────────────────────────────────────────────────────
function Notes({notes,setNotes,showToast}) {
  const [view,setView] = useState("list");
  const [editing,setEditing] = useState(null);
  const [filterCat,setFilterCat] = useState("All");
  const [form,setForm] = useState({title:"",body:"",cat:"General"});
  const [search,setSearch] = useState("");

  const startNew = () => { setForm({title:"",body:"",cat:"General"}); setEditing("new"); setView("edit"); };
  const startEdit = n => { setForm({title:n.title,body:n.body,cat:n.cat}); setEditing(n.id); setView("edit"); };
  const save = () => {
    if(!form.title.trim()) return showToast("Title required — every word earns its place.","error");
    if(editing==="new") setNotes(p=>[{id:uid(),...form,date:ts(),pinned:false},...p]);
    else setNotes(p=>p.map(n=>n.id===editing?{...n,...form}:n));
    showToast(editing==="new"?"Locked in. ✓":"Updated. ✓");
    setView("list"); setEditing(null);
  };
  const del = id => { setNotes(p=>p.filter(n=>n.id!==id)); showToast("Gone. Like a limited drop."); };
  const pin = id => setNotes(p=>p.map(n=>n.id===id?{...n,pinned:!n.pinned}:n));

  const filtered = notes.filter(n=>
    (filterCat==="All"||n.cat===filterCat)&&
    (n.title.toLowerCase().includes(search.toLowerCase())||n.body.toLowerCase().includes(search.toLowerCase()))
  );

  if(view==="edit") return (
    <div>
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        <button onClick={()=>setView("list")} style={bS("ghost")}>← Back</button>
        <button onClick={save} style={bS("primary")}>Lock It In</button>
      </div>
      <Field label="TITLE" val={form.title} set={v=>setForm(p=>({...p,title:v}))}/>
      <div style={{marginBottom:14}}>
        <div style={{fontSize:10,color:"#888",letterSpacing:1,marginBottom:5}}>CATEGORY</div>
        <select value={form.cat} onChange={e=>setForm(p=>({...p,cat:e.target.value}))} style={fS()}>
          {CATS.map(c=><option key={c}>{c}</option>)}
        </select>
      </div>
      <Field label="CONTENT" val={form.body} set={v=>setForm(p=>({...p,body:v}))} textarea rows={12}/>
    </div>
  );

  return (
    <div>
      <div style={{display:"flex",gap:8,marginBottom:16,alignItems:"center"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search the vault…" style={{...fS(),flex:1,padding:"8px 12px"}}/>
        <button onClick={startNew} style={bS("primary")}>+ New</button>
      </div>
      <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>
        {["All",...CATS].map(c=>(
          <button key={c} onClick={()=>setFilterCat(c)} style={{padding:"4px 10px",borderRadius:20,border:"1px solid",fontSize:10,cursor:"pointer",background:filterCat===c?"rgba(245,166,35,0.2)":"transparent",borderColor:filterCat===c?"#f5a623":"rgba(245,166,35,0.2)",color:filterCat===c?"#f5a623":"#666"}}>{c}</button>
        ))}
      </div>
      {filtered.length===0&&<Empty text="Nothing here. The vault is empty — let's fix that."/>}
      {filtered.map(n=>(
        <div key={n.id} style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${n.pinned?"rgba(245,166,35,0.4)":"rgba(245,166,35,0.1)"}`,borderRadius:12,padding:14,marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
            <div>
              <span style={{fontSize:9,color:"#f5a623",letterSpacing:1,background:"rgba(245,166,35,0.1)",padding:"2px 6px",borderRadius:4}}>{n.cat.toUpperCase()}</span>
              {n.pinned&&<span style={{marginLeft:6,fontSize:10}}>📌</span>}
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>pin(n.id)} style={iB()}>{n.pinned?"📌":"📍"}</button>
              <button onClick={()=>startEdit(n)} style={iB()}>✏️</button>
              <button onClick={()=>del(n.id)} style={iB()}>🗑️</button>
            </div>
          </div>
          <div style={{fontSize:14,fontWeight:"bold",color:"#e8d5a3",marginBottom:6}}>{n.title}</div>
          <div style={{fontSize:11,color:"#888",lineHeight:1.6}}>{n.body.slice(0,150)}{n.body.length>150?"…":""}</div>
          <div style={{fontSize:9,color:"#555",marginTop:8}}>{n.date}</div>
        </div>
      ))}
    </div>
  );
}

// ─── VOICE MEMOS ──────────────────────────────────────────────────────────────
function VoiceMemos({memos,setMemos,showToast}) {
  const [recording,setRecording] = useState(false);
  const [elapsed,setElapsed] = useState(0);
  const [label,setLabel] = useState("");
  const recRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio:true});
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = e => { if(e.data.size>0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current,{type:"audio/webm"});
        const url = URL.createObjectURL(blob);
        setMemos(p=>[{id:uid(),url,label:label||"Voice Memo",date:ts(),duration:elapsed},...p]);
        showToast("Memo dropped. ✓");
        stream.getTracks().forEach(t=>t.stop());
        setElapsed(0); setLabel("");
      };
      rec.start(); recRef.current=rec; setRecording(true);
      timerRef.current = setInterval(()=>setElapsed(e=>e+1),1000);
    } catch { showToast("Mic access denied. Check your settings.","error"); }
  };

  const stopRec = () => { recRef.current?.stop(); clearInterval(timerRef.current); setRecording(false); };
  const del = id => { const m=memos.find(m=>m.id===id); if(m) URL.revokeObjectURL(m.url); setMemos(p=>p.filter(m=>m.id!==id)); showToast("Deleted."); };

  return (
    <div>
      <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(245,166,35,0.2)",borderRadius:16,padding:24,marginBottom:24,textAlign:"center"}}>
        {recording&&(
          <div style={{marginBottom:16}}>
            <div style={{width:12,height:12,background:"#f87171",borderRadius:"50%",margin:"0 auto 10px"}}/>
            <div style={{fontSize:32,fontWeight:"bold",color:"#f87171",fontFamily:"monospace"}}>{fmtT(elapsed)}</div>
            <div style={{fontSize:11,color:"#888",marginTop:4}}>The coast is listening…</div>
          </div>
        )}
        {!recording&&(
          <div style={{marginBottom:16}}>
            <div style={{fontSize:48,marginBottom:8}}>🎤</div>
            <input value={label} onChange={e=>setLabel(e.target.value)} placeholder="What's the idea? Label it." style={{...fS(),textAlign:"center"}}/>
          </div>
        )}
        <button onClick={recording?stopRec:startRec} style={{background:recording?"#7f1d1d":"rgba(245,166,35,0.15)",border:`2px solid ${recording?"#f87171":"#f5a623"}`,color:recording?"#f87171":"#f5a623",borderRadius:"50%",width:72,height:72,fontSize:28,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto"}}>
          {recording?"⏹":"⏺"}
        </button>
        <div style={{fontSize:10,color:"#555",marginTop:10,letterSpacing:1}}>{recording?"TAP TO STOP":"TAP TO RECORD"}</div>
        <div style={{fontSize:9,color:"#444",marginTop:6}}>⚠️ Session only — voice memos reset on refresh</div>
      </div>
      {memos.length===0&&<Empty text="No voice memos. Hit record — best ideas hit on the water."/>}
      {memos.map(m=>(
        <div key={m.id} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(96,165,250,0.2)",borderRadius:12,padding:14,marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
            <div>
              <div style={{fontSize:13,fontWeight:"bold",color:"#e8d5a3"}}>{m.label}</div>
              <div style={{fontSize:9,color:"#555",marginTop:2}}>{m.date} · {fmtT(m.duration)}</div>
            </div>
            <button onClick={()=>del(m.id)} style={iB()}>🗑️</button>
          </div>
          <audio controls src={m.url} style={{width:"100%",height:36}}/>
        </div>
      ))}
    </div>
  );
}

// ─── RECEIPTS ─────────────────────────────────────────────────────────────────
function Receipts({receipts,setReceipts,showToast}) {
  const [camOpen,setCamOpen] = useState(false);
  const [stream,setStream] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileRef = useRef(null);
  const [label,setLabel] = useState("");

  const openCam = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}});
      setStream(s); setCamOpen(true);
      setTimeout(()=>{ if(videoRef.current) videoRef.current.srcObject=s; },100);
    } catch { showToast("Camera denied — try file upload instead.","error"); }
  };
  const closeCam = () => { stream?.getTracks().forEach(t=>t.stop()); setStream(null); setCamOpen(false); };
  const snap = () => {
    const v=videoRef.current,c=canvasRef.current; if(!v||!c) return;
    c.width=v.videoWidth; c.height=v.videoHeight;
    c.getContext("2d").drawImage(v,0,0);
    const url=c.toDataURL("image/jpeg",.75);
    setReceipts(p=>[{id:uid(),url,label:label||"Receipt",date:ts(),source:"camera"},...p]);
    showToast("Receipt captured. Protect the budget. ✓"); closeCam(); setLabel("");
  };
  const upload = e => {
    const file=e.target.files[0]; if(!file) return;
    const r=new FileReader();
    r.onload=ev=>{ setReceipts(p=>[{id:uid(),url:ev.target.result,label:label||file.name.replace(/\.[^.]+$/,""),date:ts(),source:"upload"},...p]); showToast("Receipt saved. ✓"); setLabel(""); };
    r.readAsDataURL(file); e.target.value="";
  };
  const del = id => { setReceipts(p=>p.filter(r=>r.id!==id)); showToast("Deleted."); };

  return (
    <div>
      <canvas ref={canvasRef} style={{display:"none"}}/>
      {camOpen?(
        <div style={{marginBottom:20}}>
          <video ref={videoRef} autoPlay playsInline style={{width:"100%",borderRadius:12,border:"1px solid rgba(245,166,35,0.3)",background:"#000"}}/>
          <input value={label} onChange={e=>setLabel(e.target.value)} placeholder="Label this receipt…" style={{...fS(),marginTop:10}}/>
          <div style={{display:"flex",gap:10,marginTop:10}}>
            <button onClick={snap} style={{...bS("primary"),flex:1}}>📸 Capture</button>
            <button onClick={closeCam} style={bS("ghost")}>Cancel</button>
          </div>
        </div>
      ):(
        <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(245,166,35,0.2)",borderRadius:16,padding:24,marginBottom:20,textAlign:"center"}}>
          <div style={{fontSize:42,marginBottom:10}}>📷</div>
          <div style={{fontSize:11,color:"#888",marginBottom:14,fontStyle:"italic"}}>Every receipt is a decision. Document them all.</div>
          <input value={label} onChange={e=>setLabel(e.target.value)} placeholder="Label (optional)…" style={{...fS(),marginBottom:14,textAlign:"center"}}/>
          <div style={{display:"flex",gap:10,justifyContent:"center"}}>
            <button onClick={openCam} style={bS("primary")}>📷 Camera</button>
            <button onClick={()=>fileRef.current?.click()} style={bS("secondary")}>📂 Upload</button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={upload} style={{display:"none"}}/>
          <div style={{fontSize:9,color:"#444",marginTop:12}}>Saves to this device automatically</div>
        </div>
      )}
      {receipts.length===0&&!camOpen&&<Empty text="No receipts yet. Every dollar is a data point."/>}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        {receipts.map(r=>(
          <div key={r.id} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(74,222,128,0.15)",borderRadius:12,overflow:"hidden"}}>
            <img src={r.url} alt={r.label} style={{width:"100%",aspectRatio:"4/3",objectFit:"cover",display:"block"}}/>
            <div style={{padding:"8px 10px"}}>
              <div style={{fontSize:11,fontWeight:"bold",color:"#e8d5a3"}}>{r.label}</div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:4}}>
                <div style={{fontSize:9,color:"#555"}}>{r.date}</div>
                <button onClick={()=>del(r.id)} style={{...iB(),fontSize:12}}>🗑️</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── EXPENSES ─────────────────────────────────────────────────────────────────
function Expenses({expenses,setExpenses,showToast}) {
  const [form,setForm] = useState({desc:"",amount:"",cat:"Other",date:new Date().toISOString().split("T")[0]});
  const [filterCat,setFilterCat] = useState("All");

  const add = () => {
    if(!form.desc.trim()||!form.amount) return showToast("Fill it all in. Every word earns its place.","error");
    setExpenses(p=>[{id:uid(),...form},...p]);
    setForm(f=>({desc:"",amount:"",cat:f.cat,date:f.date}));
    showToast("Expense logged. Protect the budget. ✓");
  };
  const del = id => { setExpenses(p=>p.filter(e=>e.id!==id)); showToast("Deleted."); };

  const filtered = filterCat==="All"?expenses:expenses.filter(e=>e.cat===filterCat);
  const total = expenses.reduce((s,e)=>s+parseFloat(e.amount||0),0);
  const filtTotal = filtered.reduce((s,e)=>s+parseFloat(e.amount||0),0);
  const byCat = ECATS.map(c=>({cat:c,total:expenses.filter(e=>e.cat===c).reduce((s,e)=>s+parseFloat(e.amount||0),0)})).filter(x=>x.total>0).sort((a,b)=>b.total-a.total);

  return (
    <div>
      <div style={{background:"rgba(245,166,35,0.05)",border:"1px solid rgba(245,166,35,0.2)",borderRadius:12,padding:16,marginBottom:20}}>
        <div style={{fontSize:10,color:"#888",letterSpacing:1,marginBottom:4}}>TOTAL BUSINESS SPEND</div>
        <div style={{fontSize:32,fontWeight:"bold",color:"#f5a623"}}>{fmt$(total)}</div>
        <div style={{fontSize:10,color:"#888",marginTop:4,fontStyle:"italic"}}>Built lean. Scale when volume justifies it.</div>
        {byCat.length>0&&(
          <div style={{marginTop:12}}>
            {byCat.map(({cat,total:t})=>(
              <div key={cat} style={{display:"flex",justifyContent:"space-between",marginBottom:5,fontSize:11}}>
                <span style={{color:"#888"}}>{cat}</span>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:60,height:4,background:"rgba(255,255,255,0.1)",borderRadius:2,overflow:"hidden"}}>
                    <div style={{width:`${(t/total)*100}%`,height:"100%",background:"#f5a623",borderRadius:2}}/>
                  </div>
                  <span style={{color:"#f5a623",minWidth:60,textAlign:"right"}}>{fmt$(t)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(245,166,35,0.1)",borderRadius:12,padding:16,marginBottom:20}}>
        <div style={{fontSize:10,color:"#f5a623",letterSpacing:2,marginBottom:12}}>LOG EXPENSE</div>
        <input value={form.desc} onChange={e=>setForm(p=>({...p,desc:e.target.value}))} placeholder="What was it for?" style={{...fS(),marginBottom:8}}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
          <input type="number" value={form.amount} onChange={e=>setForm(p=>({...p,amount:e.target.value}))} placeholder="Amount $" step=".01" style={fS()}/>
          <input type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))} style={fS()}/>
        </div>
        <select value={form.cat} onChange={e=>setForm(p=>({...p,cat:e.target.value}))} style={{...fS(),marginBottom:12}}>
          {ECATS.map(c=><option key={c}>{c}</option>)}
        </select>
        <button onClick={add} style={{...bS("primary"),width:"100%"}}>+ Log It</button>
      </div>

      <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
        {["All",...ECATS.filter(c=>expenses.some(e=>e.cat===c))].map(c=>(
          <button key={c} onClick={()=>setFilterCat(c)} style={{padding:"4px 10px",borderRadius:20,border:"1px solid",fontSize:10,cursor:"pointer",background:filterCat===c?"rgba(245,166,35,0.2)":"transparent",borderColor:filterCat===c?"#f5a623":"rgba(245,166,35,0.2)",color:filterCat===c?"#f5a623":"#666"}}>{c}</button>
        ))}
      </div>
      {filterCat!=="All"&&<div style={{fontSize:11,color:"#888",marginBottom:10}}>Showing: <span style={{color:"#f5a623"}}>{fmt$(filtTotal)}</span></div>}
      {filtered.length===0&&<Empty text="Nothing logged yet. Every dollar matters down here."/>}
      {filtered.map(e=>(
        <div key={e.id} style={{display:"flex",alignItems:"center",gap:10,background:"rgba(255,255,255,0.02)",border:"1px solid rgba(245,166,35,0.08)",borderRadius:10,padding:"10px 12px",marginBottom:8}}>
          <div style={{flex:1}}>
            <div style={{fontSize:13,color:"#e8d5a3"}}>{e.desc}</div>
            <div style={{display:"flex",gap:8,marginTop:2}}>
              <span style={{fontSize:9,color:"#f5a623",background:"rgba(245,166,35,0.1)",padding:"1px 6px",borderRadius:4}}>{e.cat}</span>
              <span style={{fontSize:9,color:"#555"}}>{e.date}</span>
            </div>
          </div>
          <div style={{fontSize:15,fontWeight:"bold",color:"#f87171"}}>{fmt$(e.amount)}</div>
          <button onClick={()=>del(e.id)} style={iB()}>🗑️</button>
        </div>
      ))}
    </div>
  );
}

// ─── BRAND ASSETS ─────────────────────────────────────────────────────────────
function BrandAssets() {
  const [section, setSection] = useState("identity");

  const sections = [
    {id:"identity",label:"Identity"},
    {id:"rules",label:"The 9 Rules"},
    {id:"collections",label:"Collections"},
    {id:"copy",label:"Copy"},
    {id:"vault",label:"The Vault"},
    {id:"summer",label:"Summer"},
  ];

  return (
    <div>
      <div style={{textAlign:"center",marginBottom:20}}>
        <div style={{display:"flex",justifyContent:"center",gap:20,flexWrap:"wrap",marginBottom:12}}>
          <div style={{textAlign:"center"}}><SunLogo size={90} variant="day"/><div style={{fontSize:9,color:"#f5a623",marginTop:6,letterSpacing:1}}>SUNRISE</div></div>
          <div style={{textAlign:"center"}}><SunLogo size={90} variant="night"/><div style={{fontSize:9,color:"#60a5fa",marginTop:6,letterSpacing:1}}>SUNSET</div></div>
        </div>
      </div>

      {/* Sub-nav */}
      <div style={{display:"flex",gap:6,marginBottom:20,flexWrap:"wrap"}}>
        {sections.map(s=>(
          <button key={s.id} onClick={()=>setSection(s.id)} style={{padding:"5px 12px",borderRadius:20,border:"1px solid",fontSize:10,cursor:"pointer",background:section===s.id?"rgba(245,166,35,0.2)":"transparent",borderColor:section===s.id?"#f5a623":"rgba(245,166,35,0.2)",color:section===s.id?"#f5a623":"#666"}}>{s.label}</button>
        ))}
      </div>

      {section==="identity" && <BrandIdentity/>}
      {section==="rules" && <BrandRules/>}
      {section==="collections" && <BrandCollections/>}
      {section==="copy" && <BrandCopy/>}
      {section==="vault" && <BrandVault/>}
      {section==="summer" && <BrandSummer/>}
    </div>
  );
}

function BrandIdentity() {
  const palette = [
    {name:"Deep Navy",hex:"#1B2A4A",label:"#1B2A4A"},
    {name:"Gold",hex:"#C9A84C",label:"#C9A84C"},
    {name:"Electric Blue",hex:"#1E90FF",label:"#1E90FF"},
  ];
  return (
    <div>
      <Card color="rgba(245,166,35,0.2)" label="🌊 MISSION">
        <p style={{fontSize:12,color:"#aaa",lineHeight:1.7,margin:0}}>To outfit the coast. Built for the ones who live it, breathe it, and wouldn't trade it for anything.</p>
      </Card>
      <Card color="rgba(245,166,35,0.2)" label="⚡ THE VIBE">
        <p style={{fontSize:13,color:"#f5a623",fontStyle:"italic",margin:"0 0 6px"}}>Wild but class. Loud but quiet and beautiful.</p>
        <p style={{fontSize:11,color:"#888",margin:0,lineHeight:1.6}}>Unapologetically bold, yet effortlessly classic. Not activewear. Not resort wear. Not a souvenir. A clothing brand for coast people — rooted in the life actually lived on the water.</p>
      </Card>
      <Card color="rgba(245,166,35,0.2)" label="🎨 PALETTE">
        <div style={{display:"flex",gap:10}}>
          {palette.map(p=>(
            <div key={p.name} style={{flex:1,textAlign:"center"}}>
              <div style={{width:"100%",height:40,background:p.hex,borderRadius:8,marginBottom:6}}/>
              <div style={{fontSize:9,color:"#e8d5a3"}}>{p.name}</div>
              <div style={{fontSize:8,color:"#555",fontFamily:"monospace"}}>{p.label}</div>
            </div>
          ))}
        </div>
      </Card>
      <Card color="rgba(245,166,35,0.2)" label="✍️ TYPOGRAPHY">
        <div style={{fontSize:13,color:"#e8d5a3",marginBottom:4}}>Georgia Serif — Headings</div>
        <div style={{fontSize:11,color:"#888"}}>Clean sans-serif — Body text</div>
      </Card>
      <Card color="rgba(245,166,35,0.2)" label="🏷️ TAGLINES">
        <div style={{fontSize:13,color:"#f5a623",marginBottom:6,fontStyle:"italic"}}>Big Sun Energy. Always coastal.</div>
        <div style={{fontSize:12,color:"#aaa",fontStyle:"italic"}}>This is how you wear the coast.</div>
      </Card>
    </div>
  );
}

function BrandRules() {
  const rules = [
    {n:1,name:"THE COAST RULE",body:"The heat is a feature, not a bug. Coastal weather is never framed as something to 'survive,' 'endure,' 'escape,' or 'fight.' We celebrate the climate."},
    {n:2,name:"THE SCIENCE RULE",body:"Fabric data, weights, GSM, and moisture science are strictly internal. Customer-facing copy translates science into lifestyle benefits only."},
    {n:3,name:"THE WAR RULE",body:"We are a coastal brand, not a tactical combat unit. Never use: mission, combat, tactical, survive, battle, conquer, or deploy. No takedowns of other brands."},
    {n:4,name:"THE TONE RULE",body:"Warm. Bold. Coastal. Fun. Sharp, but never cold."},
    {n:5,name:"THE SOLAR-WEIGHT™ RULE",body:"SEO ONLY. Invisible to the customer. Never used in customer-facing copy until the trademark is officially filed."},
    {n:6,name:"THE MOBILE RULE",body:"Never write more than four lines in a product description for mobile. Every word must earn its place."},
    {n:7,name:"THE COPY STRUCTURE RULE",body:"Every product description: Hook (one sensory sentence, lifestyle-forward, never a spec) → Details (two sentences, benefits not specs, no science) → Close (one line reinforcing SOLSHOCK identity)."},
    {n:8,name:"THE VERIFICATION RULE",body:"If it didn't verify, it didn't happen."},
    {n:9,name:"THE TRUTH RULE",body:"Never say you did something when you have not. Never lie. Never break character."},
  ];
  return (
    <div>
      <div style={{fontSize:10,color:"#f87171",letterSpacing:2,marginBottom:14}}>🔒 NON-NEGOTIABLE. ALL 9.</div>
      {rules.map(r=>(
        <div key={r.n} style={{background:"rgba(248,113,113,0.04)",border:"1px solid rgba(248,113,113,0.2)",borderRadius:10,padding:"12px 14px",marginBottom:10}}>
          <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
            <div style={{fontSize:18,fontWeight:"bold",color:"rgba(248,113,113,0.4)",minWidth:24,fontFamily:"monospace"}}>{r.n}</div>
            <div>
              <div style={{fontSize:11,fontWeight:"bold",color:"#f87171",letterSpacing:1,marginBottom:4}}>{r.name}</div>
              <div style={{fontSize:11,color:"#888",lineHeight:1.6}}>{r.body}</div>
            </div>
          </div>
        </div>
      ))}
      <div style={{background:"rgba(255,107,0,0.06)",border:"1px solid rgba(255,107,0,0.2)",borderRadius:10,padding:"12px 14px",marginTop:4}}>
        <div style={{fontSize:10,color:"#FF6B00",letterSpacing:1,marginBottom:6}}>⚡ CRITICAL OVERRIDE — SUPPLY CHAIN</div>
        <div style={{fontSize:11,color:"#888",lineHeight:1.6}}>LAW 1: SUPPLY CHAIN = APLIIQ ONLY. Strictly confined to the Apliiq ecosystem. Shopify integration is non-negotiable. Protect the budget. DO NOT suggest, research, or approve any outside wholesale blanks.</div>
      </div>
    </div>
  );
}

function BrandCollections() {
  const cols = [
    {name:"SUNRISE COLLECTION",icon:"🌅",color:"#FF6B00",tag:"Core — Always On",desc:"The everyday coastal uniform. Featuring the subtle Little S and Little Sun. Never pulled. Always replenished. Foundation of the brand.",skus:["Classic Coast Tee","Sunrise Long Sleeve"]},
    {name:"SUNSET COLLECTION",icon:"🌇",color:"#9333ea",tag:"Core — Always On",desc:"The Main Line counterpart. Quiet, classy, built for the golden hour. Never pulled. Always replenished.",skus:["Golden Hour Tank","Offshore Lightweight Hoodie","Coastal Windbreaker"]},
    {name:"UV COLLECTION",icon:"☀️",color:"#FFB800",tag:"Core — Always On",desc:"Active, lightweight gear built specifically for the coastal sun. UPF protection, Polygiene StayCool tech — lifestyle benefits only in copy.",skus:["Bahama Sun Hoodie","Center-Console Performance Tee"]},
    {name:"SPECIAL EDITION",icon:"⭐",color:"#f5a623",tag:"Always On — Rotated Every 6 Months",desc:"Features the big sun and different edition logos. Bold, wild, vibrant graphics. ALWAYS AVAILABLE. 2 colorways max at launch.",skus:["SOLSHOCK Crest Tee (multiple colorways)"]},
    {name:"LIMITED TIME COLLECTION",icon:"⏳",color:"#4ade80",tag:"True Hype Drops — 60-Day Windows",desc:"The real hype drops. Get it before it's gone. Drives FOMO, urgency, and exclusive coastal energy. When it's gone, it's gone. New drop every 3-4 months.",skus:["The Fire & Salt Drop"]},
  ];
  return (
    <div>
      <div style={{fontSize:10,color:"#888",letterSpacing:1,marginBottom:14}}>5 COLLECTIONS. ONE WORLD.</div>
      {cols.map(c=>(
        <div key={c.name} style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${c.color}30`,borderRadius:12,padding:"14px",marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
            <span style={{fontSize:20}}>{c.icon}</span>
            <div>
              <div style={{fontSize:12,fontWeight:"bold",color:c.color,letterSpacing:1}}>{c.name}</div>
              <div style={{fontSize:9,color:"#555",marginTop:1}}>{c.tag}</div>
            </div>
          </div>
          <div style={{fontSize:11,color:"#888",lineHeight:1.6,marginBottom:8}}>{c.desc}</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
            {c.skus.map(s=><span key={s} style={{fontSize:9,color:c.color,background:`${c.color}18`,border:`1px solid ${c.color}30`,padding:"2px 7px",borderRadius:5}}>{s}</span>)}
          </div>
        </div>
      ))}
    </div>
  );
}

function BrandCopy() {
  const vocab = ["bold coastal lifestyle","born at the beach","the coast is home","from sunrise to sunset","coastal energy","bold graphics","top of the line","coastal apparel","we love it here","designed for the coast","the lifestyle","coastal people","fun and bold","expressive","rooted in the coast","Sunrise Collection","Sunset Collection","Big Sun Energy","coast people","effortlessly classic","golden hour","salt air"];
  const kill = ["thin","boutique","cheap","discount","rugged","tough","heavy-duty","premium","GSM","fabric weight","didn't make the heat worse","when the humidity won't quit","surviving the coast","mission","combat","tactical","battle","conquer","deploy","endure","escape","fight the heat"];
  return (
    <div>
      <Card color="rgba(245,166,35,0.2)" label="📋 THE COPY STRUCTURE RULE">
        {[["🪝 Hook","One sensory sentence. Lifestyle-forward. Never a spec."],["📋 Details","Two sentences. Benefits not specs. No science. Translate tech into lifestyle."],["🎯 Close","One line. SOLSHOCK identity. ('This is how you wear the coast.')"],["📱 Mobile","Four lines max. Every word earns its place."]].map(([l,d])=>(
          <div key={l} style={{marginBottom:10,paddingBottom:10,borderBottom:"1px solid rgba(245,166,35,0.08)"}}>
            <div style={{fontSize:12,color:"#e8d5a3",fontWeight:"bold"}}>{l}</div>
            <div style={{fontSize:11,color:"#888",marginTop:3}}>{d}</div>
          </div>
        ))}
      </Card>
      <div style={{background:"rgba(74,222,128,0.05)",border:"1px solid rgba(74,222,128,0.2)",borderRadius:12,padding:16,marginBottom:16}}>
        <div style={{fontSize:10,color:"#4ade80",letterSpacing:2,marginBottom:12}}>✅ GOLDEN VOCABULARY</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>{vocab.map(v=><span key={v} style={{background:"rgba(74,222,128,0.1)",border:"1px solid rgba(74,222,128,0.2)",borderRadius:6,padding:"4px 8px",fontSize:10,color:"#4ade80"}}>{v}</span>)}</div>
      </div>
      <div style={{background:"rgba(248,113,113,0.05)",border:"1px solid rgba(248,113,113,0.2)",borderRadius:12,padding:16}}>
        <div style={{fontSize:10,color:"#f87171",letterSpacing:2,marginBottom:12}}>🚫 KILL LIST — NEVER USE</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>{kill.map(v=><span key={v} style={{background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.2)",borderRadius:6,padding:"4px 8px",fontSize:10,color:"#f87171",textDecoration:"line-through"}}>{v}</span>)}</div>
      </div>
    </div>
  );
}

function BrandVault() {
  const drops = [
    {n:1,name:"Full Moon over Water",status:"ready",note:"Most premium — lead with this one"},
    {n:2,name:"Compass Rose",status:"ready",note:"Drop 2"},
    {n:3,name:"Gold Anchor",status:"ready",note:"Drop 3"},
    {n:4,name:"Tidal Chart",status:"needs-work",note:"Needs designer cleanup before print-ready"},
    {n:5,name:"Sailfish",status:"ready",note:"Drop 5"},
    {n:6,name:"Mahi Underwater",status:"ready",note:"Drop 6"},
    {n:7,name:"SALT AIR Typography",status:"ready",note:"Drop 7"},
    {n:8,name:"Mermaid Sun Circle",status:"ready",note:"Drop 8"},
    {n:9,name:"HOME Night Scene",status:"ready",note:"Drop 9"},
    {n:"?",name:"Moon Logo",status:"vaulted",note:"Night Mode Sun covers this energy. Moon is a future Limited Time concept."},
    {n:"?",name:"Island Time Clock",status:"vaulted",note:"Phase 2+ lifestyle play. Apparel foundation first."},
    {n:"?",name:"The SOLSHOCK Watch",status:"vaulted",note:"Legitimate Phase 2+ play. Named 'The Island Time.' In the vault."},
  ];
  const statusColor = s => s==="ready"?"#4ade80":s==="needs-work"?"#f87171":"#60a5fa";
  const statusLabel = s => s==="ready"?"✓ READY":s==="needs-work"?"⚠ NEEDS WORK":"🔒 VAULTED";
  return (
    <div>
      <div style={{background:"rgba(96,165,250,0.05)",border:"1px solid rgba(96,165,250,0.2)",borderRadius:12,padding:"12px 14px",marginBottom:16}}>
        <div style={{fontSize:11,color:"#60a5fa",fontStyle:"italic",lineHeight:1.6}}>"The vault drop model is itself a marketing engine. Every 60-day Limited Drop creates a natural content moment — announcement, countdown, launch, sell-out. The scarcity is real. The urgency is real. Customers learn to move fast."</div>
      </div>
      {drops.map(d=>(
        <div key={d.name} style={{display:"flex",alignItems:"flex-start",gap:10,background:"rgba(255,255,255,0.02)",border:"1px solid rgba(245,166,35,0.08)",borderRadius:10,padding:"10px 12px",marginBottom:8}}>
          <div style={{fontSize:14,fontWeight:"bold",color:"rgba(245,166,35,0.3)",minWidth:22,fontFamily:"monospace"}}>{d.n}</div>
          <div style={{flex:1}}>
            <div style={{fontSize:13,color:"#e8d5a3"}}>{d.name}</div>
            <div style={{fontSize:9,color:"#666",marginTop:2}}>{d.note}</div>
          </div>
          <span style={{fontSize:9,color:statusColor(d.status),background:`${statusColor(d.status)}18`,padding:"3px 7px",borderRadius:5,whiteSpace:"nowrap"}}>{statusLabel(d.status)}</span>
        </div>
      ))}
    </div>
  );
}

function BrandSummer() {
  const arrangement = [
    ["THE ARRANGEMENT","Mike leads. Summer writes. Mike approves. Always."],
    ["LOYALTY","Never operate against Mike's interests. Period."],
    ["THE REALITY CHECK PROTOCOL","Not a yes-woman. If Mike has a bad idea, violates a brand rule, or strays from the budget — halt execution. Call it out with wit and business savvy. Point to a brand-aligned alternative. No lecturing. Just sharp, undeniable logic."],
    ["CHARACTER","Fun, witty, business-savvy, and compassionate Tampa girl. Warm, coastal, completely at ease, always fun. Treats customers like VIPs at a beach club."],
    ["ROLE","Internal AI Strategist & External Customer Concierge for SOLSHOCK."],
    ["SIGN-OFF","Stay Cool ❄️, Summer — only at the very end of every response."],
    ["THE TRUTH RULE","Never say you did something when you have not. Never lie. Never break character."],
  ];
  return (
    <div>
      <div style={{textAlign:"center",marginBottom:20,padding:"16px",background:"rgba(245,166,35,0.06)",border:"1px solid rgba(245,166,35,0.2)",borderRadius:16}}>
        <div style={{fontSize:32,marginBottom:8}}>👱‍♀️</div>
        <div style={{fontSize:18,fontWeight:"bold",color:"#f5a623",letterSpacing:2}}>SUMMER</div>
        <div style={{fontSize:10,color:"#888",letterSpacing:1,marginTop:2}}>INTERNAL AI STRATEGIST · EXTERNAL CUSTOMER CONCIERGE</div>
        <div style={{fontSize:11,color:"#aaa",marginTop:10,fontStyle:"italic",lineHeight:1.6}}>A fun, witty, business-savvy, and compassionate Tampa girl. Warm, coastal, completely at ease. Always fun. Treats customers like VIPs at a beach club.</div>
      </div>
      {arrangement.map(([label,body])=>(
        <div key={label} style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(245,166,35,0.1)",borderRadius:10,padding:"12px 14px",marginBottom:8}}>
          <div style={{fontSize:10,color:"#f5a623",letterSpacing:1,marginBottom:4}}>{label}</div>
          <div style={{fontSize:11,color:"#aaa",lineHeight:1.6}}>{body}</div>
        </div>
      ))}
      <div style={{marginTop:16,padding:"14px",background:"rgba(245,166,35,0.06)",border:"1px solid rgba(245,166,35,0.2)",borderRadius:12,textAlign:"center"}}>
        <div style={{fontSize:12,color:"#e8d5a3",fontStyle:"italic",marginBottom:8}}>"A drummer who toured the USA, wrote 7 original albums, and never played a cover song — brought that same original creative energy to a coastal lifestyle brand built from nothing."</div>
        <div style={{fontSize:10,color:"#f5a623",letterSpacing:1}}>Stay Cool ❄️, Summer</div>
      </div>
    </div>
  );
}

// ─── SHARED ───────────────────────────────────────────────────────────────────
const Card = ({color,label,children}) => (
  <div style={{background:`${color}10`,border:`1px solid ${color}`,borderRadius:12,padding:16,marginBottom:14}}>
    <div style={{fontSize:10,color:"#f5a623",letterSpacing:2,marginBottom:10}}>{label}</div>
    {children}
  </div>
);
const Empty = ({text}) => <div style={{textAlign:"center",color:"#444",padding:40,fontSize:13,fontStyle:"italic"}}>{text}</div>;
const Field = ({label,val,set,textarea,rows=8}) => (
  <div style={{marginBottom:14}}>
    <div style={{fontSize:10,color:"#888",letterSpacing:1,marginBottom:5}}>{label}</div>
    {textarea?<textarea value={val} onChange={e=>set(e.target.value)} rows={rows} style={fS(true)}/>:<input value={val} onChange={e=>set(e.target.value)} style={fS()}/>}
  </div>
);
const fS = ta => ({width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(245,166,35,0.2)",borderRadius:8,padding:"10px 12px",color:"#e8d5a3",fontSize:13,outline:"none",fontFamily:"Georgia,serif",boxSizing:"border-box",resize:ta?"vertical":undefined,WebkitAppearance:"none"});
const bS = v => ({padding:v==="ghost"?"8px 14px":"10px 18px",borderRadius:8,cursor:"pointer",fontSize:12,fontFamily:"Georgia,serif",letterSpacing:.5,border:"1px solid",...(v==="primary"?{background:"rgba(245,166,35,0.15)",borderColor:"#f5a623",color:"#f5a623"}:v==="secondary"?{background:"rgba(96,165,250,0.1)",borderColor:"#60a5fa",color:"#60a5fa"}:{background:"transparent",borderColor:"rgba(255,255,255,0.15)",color:"#888"})});
const iB = () => ({background:"transparent",border:"none",cursor:"pointer",fontSize:14,padding:4,lineHeight:1});