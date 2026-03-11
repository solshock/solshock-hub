import { useState, useRef, useEffect, useCallback } from "react";

const T = {
  navy:"#0a1628",navyMid:"#0f1f3d",navyLight:"#162848",navyGlass:"rgba(15,31,61,0.85)",
  gold:"#f5a623",goldDim:"rgba(245,166,35,0.15)",
  blue:"#3b82f6",text:"#ffffff",textDim:"#b0a080",textMuted:"#6a5f4a",
  border:"rgba(245,166,35,0.18)",borderDim:"rgba(245,166,35,0.08)",
  red:"#f87171",green:"#4ade80",orange:"#fb923c",purple:"#a78bfa",
  surface:"rgba(15,31,61,0.7)",surfaceHover:"rgba(22,40,72,0.9)",
  teal:"#2dd4bf",pink:"#f472b6",
};

const store = {
  async get(k) {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; }
  },
  async set(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
  },
  async del(k) {
    try { localStorage.removeItem(k); } catch {}
  },
};

const uid = () => Math.random().toString(36).slice(2, 9);
const nowStr = () => new Date().toLocaleString("en-US",{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"});
const fmt$ = n => "$" + Number(n||0).toFixed(2);
const fmtS = s => `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;
const today = () => new Date().toISOString().split("T")[0];


const COLLECTIONS = ["Sunrise","Sunset","Night Mode","UV","Special Ed.","Limited","Accessories"];
const ORDER_STAGES = ["New","Packed","Shipped","Done"];
const STAGE_COLORS = {New:T.blue,Packed:T.orange,Shipped:T.purple,Done:T.green};
const EXPENSE_CATS = ["Inventory","Marketing","Design","Shipping","Software","Equipment","Other"];
const PRIORITIES = ["🔴 High","🟡 Medium","🟢 Low"];
const NOTE_CATS = ["Decision","Copy Draft","Idea","Task","General"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ── ANTHROPIC API KEY ─────────────────────────────────────────────────────────
const apiKeyStore = { key: "" };
(async () => {
  try { const k = localStorage.getItem("ss_anthropic_key"); if (k) apiKeyStore.key = k; } catch {}
})();

async function callClaude(system, user, useSearch=false) {
  const body = {
    model:"claude-sonnet-4-20250514",
    max_tokens:1500,
    system,
    messages:[{role:"user",content:user}],
  };
  if (useSearch) body.tools = [{type:"web_search_20250305",name:"web_search"}];
  const headers = { "Content-Type":"application/json" };
  if (apiKeyStore.key) {
    headers["x-api-key"] = apiKeyStore.key;
    headers["anthropic-version"] = "2023-06-01";
    headers["anthropic-dangerous-allow-browser"] = "true";
  }
  const res = await fetch("https://api.anthropic.com/v1/messages",{
    method:"POST", headers, body:JSON.stringify(body),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.content.filter(b=>b.type==="text").map(b=>b.text).join("\n");
}

// ── SPEECH ────────────────────────────────────────────────────────────────────
const ttsKeyStore = { key: "", voice: "en-US-Journey-F" };
(async () => {
  try {
    const k = localStorage.getItem("ss_tts_key"); if (k) ttsKeyStore.key = k;
    const v = localStorage.getItem("ss_tts_voice"); if (v) ttsKeyStore.voice = v;
  } catch {}
})();

function cleanForSpeech(text) {
  return text
    .replace(/[^\x00-\x7F]/g, " ")
    .replace(/[#*_`~\[\]]/g, "")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/\.\s*\./g, ".")
    .trim();
}

// Global browser TTS utterance ref so stop() can always cancel it
let _currentUtt = null;

function useSpeech() {
  const [speaking, setSpeaking] = useState(false);
  const [paused,   setPaused]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const audioRef   = useRef(null);
  const blobUrlRef = useRef(null);

  const stop = useCallback(() => {
    // Stop Google TTS audio
    if (audioRef.current) {
      try { audioRef.current.pause(); audioRef.current.currentTime = 0; } catch {}
      audioRef.current = null;
    }
    if (blobUrlRef.current) {
      try { URL.revokeObjectURL(blobUrlRef.current); } catch {}
      blobUrlRef.current = null;
    }
    // Always cancel browser TTS too
    try { window.speechSynthesis.cancel(); } catch {}
    _currentUtt = null;
    setSpeaking(false);
    setPaused(false);
    setLoading(false);
  }, []);

  const speakBrowser = useCallback((text) => {
    try { window.speechSynthesis.cancel(); } catch {}
    const clean = cleanForSpeech(text);
    if (!clean) return;
    const VOICE_PRIORITY = [
      // Mac — best natural voices
      "Samantha","Serena","Karen","Moira","Tessa",
      // Windows — natural voices (Win11)
      "Aria","Jenny","Ana",
      // Chrome built-in (any OS)
      "Google US English","Google UK English Female",
      // Older fallbacks
      "Microsoft Zira","Microsoft Eva",
    ];
    const getBestVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      for (const name of VOICE_PRIORITY) {
        const v = voices.find(v => v.name.includes(name) && v.lang.startsWith("en"));
        if (v) return v;
      }
      // Last resort — any English female-sounding voice
      return voices.find(v => v.lang.startsWith("en-US")) ||
             voices.find(v => v.lang.startsWith("en")) || null;
    };
    const doSpeak = () => {
      const utt = new SpeechSynthesisUtterance(clean);
      const voice = getBestVoice();
      if (voice) utt.voice = voice;
      // Tune for most natural sound
      utt.rate   = 0.88;
      utt.pitch  = 1.1;
      utt.volume = 1;
      _currentUtt = utt;
      utt.onstart  = () => { setSpeaking(true); setPaused(false); setLoading(false); };
      utt.onend    = () => { setSpeaking(false); setPaused(false); _currentUtt = null; };
      utt.onerror  = () => { setSpeaking(false); setPaused(false); setLoading(false); _currentUtt = null; };
      utt.onpause  = () => setPaused(true);
      utt.onresume = () => setPaused(false);
      setSpeaking(true);
      window.speechSynthesis.speak(utt);
    };
    if (window.speechSynthesis.getVoices().length > 0) {
      doSpeak();
    } else {
      window.speechSynthesis.onvoiceschanged = () => { window.speechSynthesis.onvoiceschanged = null; doSpeak(); };
      setTimeout(() => { if (!_currentUtt) doSpeak(); }, 600);
    }
  }, []);

  const speakGoogle = useCallback(async (text) => {
    const clean = cleanForSpeech(text);
    if (!clean) return;
    setLoading(true);
    try {
      const toSpeak = clean.length > 4500 ? clean.slice(0, 4500) : clean;
      const res = await fetch(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${ttsKeyStore.key}`,
        {
          method:"POST", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({
            input:{text:toSpeak},
            voice:{languageCode:"en-US",name:ttsKeyStore.voice||"en-US-Journey-F",ssmlGender:"FEMALE"},
            audioConfig:{audioEncoding:"MP3",speakingRate:0.95,pitch:1.0},
          }),
        }
      );
      if (!res.ok) { const e=await res.json().catch(()=>({})); throw new Error(e?.error?.message||`Google TTS ${res.status}`); }
      const data = await res.json();
      const bytes = atob(data.audioContent);
      const arr = new Uint8Array(bytes.length);
      for (let i=0;i<bytes.length;i++) arr[i]=bytes.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([arr],{type:"audio/mp3"}));
      blobUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onplay   = () => { setSpeaking(true);  setPaused(false); setLoading(false); };
      audio.onpause  = () => setPaused(true);
      audio.onended  = () => { setSpeaking(false); setPaused(false); try{URL.revokeObjectURL(url);}catch{} blobUrlRef.current=null; audioRef.current=null; };
      audio.onerror  = () => { setSpeaking(false); setPaused(false); setLoading(false); };
      await audio.play();
    } catch(err) {
      console.error("Google TTS error:", err);
      setLoading(false);
      // Graceful fallback to browser TTS
      speakBrowser(text);
    }
  }, [speakBrowser]);

  const speak = useCallback(async (text) => {
    stop();
    if (!text?.trim()) return;
    if (ttsKeyStore.key) await speakGoogle(text);
    else speakBrowser(text);
  }, [stop, speakGoogle, speakBrowser]);

  const togglePause = useCallback(() => {
    if (audioRef.current) {
      if (paused) { audioRef.current.play(); setPaused(false); }
      else        { audioRef.current.pause(); setPaused(true); }
    } else if (_currentUtt) {
      if (paused) { window.speechSynthesis.resume(); setPaused(false); }
      else        { window.speechSynthesis.pause();  setPaused(true); }
    }
  }, [paused]);

  useEffect(() => () => stop(), [stop]);
  return { speaking, paused, loading, speak, togglePause, stop };
}

function SpeakButton({ getText, label = "▶ Play", style = {} }) {
  const { speaking, paused, loading, speak, togglePause, stop } = useSpeech();
  const handlePlay = () => {
    const text = typeof getText === "function" ? getText() : getText;
    if (!text?.trim()) return;
    speak(text);
  };
  const icon     = loading ? "⏳" : speaking && !paused ? "⏸" : "▶";
  const btnLabel = loading ? "Loading…" : speaking && !paused ? "Pause" : paused ? "Resume" : label;
  return (
    <div style={{display:"flex",alignItems:"center",gap:8,...style}}>
      <button
        onClick={speaking||paused ? togglePause : handlePlay}
        style={{
          display:"flex",alignItems:"center",gap:8,padding:"13px 22px",borderRadius:20,
          border:`1.5px solid ${speaking||loading?T.gold:T.gold+"60"}`,
          background:speaking||loading?T.goldDim:"rgba(245,166,35,0.06)",
          color:speaking||loading?T.gold:T.text,
          fontSize:20,fontFamily:"Georgia,serif",cursor:"pointer",
          transition:"all 0.15s",letterSpacing:0.5,fontWeight:speaking?"bold":"normal",
        }}
      >
        <span style={{fontSize:22}}>{icon}</span>
        <span>{btnLabel}</span>
        {(speaking&&!paused)&&(
          <span style={{display:"flex",gap:2,alignItems:"center"}}>
            {[0,1,2].map(i=><span key={i} style={{width:3,height:[8,12,6][i],background:T.gold,borderRadius:2,display:"inline-block",animation:`tickPulse 0.8s ${i*0.15}s infinite`}}/>)}
          </span>
        )}
      </button>
      {(speaking||paused)&&(
        <button onClick={stop} style={{
          padding:"13px 18px",borderRadius:20,
          border:`1.5px solid ${T.red}80`,background:`rgba(248,113,113,0.1)`,
          color:T.red,fontSize:20,cursor:"pointer",fontFamily:"Georgia,serif",
        }}>■ Stop</button>
      )}
    </div>
  );
}

function SunLogo({size=48}) {
  const flames=[
    [0,62,96,0.18,"#FF4500"],[22,60,88,0.14,"#FF6B00"],[45,62,98,0.16,"#3B82F6"],
    [67,60,86,0.14,"#FF8C00"],[90,62,96,0.18,"#FF4500"],[112,60,90,0.14,"#FFB800"],
    [135,62,100,0.16,"#3B82F6"],[157,60,86,0.14,"#FF6B00"],[180,62,96,0.18,"#FF4500"],
    [202,60,88,0.14,"#FF8C00"],[225,62,98,0.16,"#3B82F6"],[247,60,86,0.14,"#FFB800"],
    [270,62,96,0.18,"#FF4500"],[292,60,90,0.14,"#FF6B00"],[315,62,100,0.16,"#3B82F6"],
    [337,60,86,0.14,"#FF8C00"],
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 200 200">
      <defs>
        <radialGradient id="cg2"><stop offset="0%" stopColor="#1a0a00"/><stop offset="100%" stopColor="#0a1628"/></radialGradient>
        <radialGradient id="gg2"><stop offset="0%" stopColor="#FF6B00" stopOpacity="0.4"/><stop offset="100%" stopColor="#FF6B00" stopOpacity="0"/></radialGradient>
      </defs>
      <circle cx="100" cy="100" r="98" fill="url(#gg2)"/>
      {flames.map(([deg,inner,outer,spread,color],i)=>{
        const a=deg*Math.PI/180,aL=a-spread,aR=a+spread;
        const x1=100+inner*Math.cos(aL),y1=100+inner*Math.sin(aL);
        const x2=100+outer*Math.cos(a),y2=100+outer*Math.sin(a);
        const x3=100+inner*Math.cos(aR),y3=100+inner*Math.sin(aR);
        const cx1=100+(inner+20)*Math.cos(aL+0.05),cy1=100+(inner+20)*Math.sin(aL+0.05);
        const cx2=100+(inner+20)*Math.cos(aR-0.05),cy2=100+(inner+20)*Math.sin(aR-0.05);
        return <path key={i} d={`M ${x1} ${y1} Q ${cx1} ${cy1} ${x2} ${y2} Q ${cx2} ${cy2} ${x3} ${y3} Z`} fill={color} opacity="0.92"/>;
      })}
      <circle cx="100" cy="100" r="61" fill="url(#cg2)"/>
      <circle cx="100" cy="100" r="59" fill="none" stroke="#f5a623" strokeWidth="1.5"/>
      <path id="ta2" d="M 30,100 A 70,70 0 0 1 170,100" fill="none"/>
      <text fontFamily="Georgia,serif" fontWeight="bold" fill="#f5a623" letterSpacing="3">
        <textPath href="#ta2" startOffset="50%" textAnchor="middle" fontSize="13">SOLSHOCK</textPath>
      </text>
      <path id="tb2" d="M 33,100 A 67,67 0 0 0 167,100" fill="none"/>
      <text fontFamily="Georgia,serif" fill="#e8d5a3" letterSpacing="1.5">
        <textPath href="#tb2" startOffset="50%" textAnchor="middle" fontSize="8.5">COASTAL CLOTHING CO</textPath>
      </text>
      <text x="100" y="108" textAnchor="middle" fontSize="42" fontWeight="bold" fontFamily="Georgia,serif" fill="#f5a623">S</text>
      {[0,60,120,180,240,300].map((deg,i)=>{
        const a=deg*Math.PI/180;
        return <circle key={i} cx={100+59*Math.cos(a)} cy={100+59*Math.sin(a)} r="1.5" fill="#f5a623" opacity="0.6"/>;
      })}
    </svg>
  );
}

function SummerAvatar({size=36,pulse=false}) {
  return (
    <div style={{position:"relative",width:size,height:size,flexShrink:0}}>
      {pulse&&<div style={{position:"absolute",inset:-4,borderRadius:"50%",border:`2px solid ${T.gold}`,opacity:0.4,animation:"summerPulse 2s infinite"}}/>}
      <div style={{width:size,height:size,borderRadius:"50%",background:`linear-gradient(135deg,#FF6B00,#f5a623,#FFB800)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.45,border:`2px solid ${T.gold}`,boxShadow:`0 0 ${size/3}px rgba(245,166,35,0.4)`}}>☀️</div>
    </div>
  );
}

const fld = (multi) => ({
  width:"100%",background:"rgba(10,22,40,0.8)",border:`1px solid ${T.border}`,
  borderRadius:8,padding:"10px 12px",color:T.text,fontSize:20,
  fontFamily:"Georgia,serif",boxSizing:"border-box",outline:"none",
  resize:multi?"vertical":undefined,WebkitAppearance:"none",
});

const Inp = ({label,value,onChange,placeholder,type="text",multi,rows=6,style={}}) => (
  <div style={{marginBottom:12}}>
    {label&&<div style={{fontSize:18,color:T.textDim,letterSpacing:1.5,marginBottom:4,textTransform:"uppercase"}}>{label}</div>}
    {multi
      ? <textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={rows} style={{...fld(true),...style}}/>
      : <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} type={type} style={{...fld(),...style}}/>}
  </div>
);

const Sel = ({label,value,onChange,options,style={}}) => (
  <div style={{marginBottom:12}}>
    {label&&<div style={{fontSize:18,color:T.textDim,letterSpacing:1.5,marginBottom:4,textTransform:"uppercase"}}>{label}</div>}
    <select value={value} onChange={e=>onChange(e.target.value)} style={{...fld(),...style}}>
      {options.map(o=><option key={o}>{o}</option>)}
    </select>
  </div>
);

const Btn = ({children,onClick,variant="primary",style={},disabled=false}) => {
  const v = {
    primary:   {bg:T.goldDim,                                    bc:T.gold,   c:T.gold},
    secondary: {bg:"rgba(59,130,246,0.12)",                       bc:T.blue,   c:T.blue},
    danger:    {bg:"rgba(248,113,113,0.1)",                       bc:T.red,    c:T.red},
    ghost:     {bg:"transparent",                                 bc:"rgba(255,255,255,0.15)",c:T.textDim},
    green:     {bg:"rgba(74,222,128,0.1)",                        bc:T.green,  c:T.green},
    teal:      {bg:"rgba(45,212,191,0.1)",                        bc:T.teal,   c:T.teal},
    summer:    {bg:"linear-gradient(135deg,rgba(255,107,0,0.2),rgba(245,166,35,0.2))",bc:T.gold,c:T.gold},
  }[variant]||{};
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background:v.bg,border:`1px solid ${v.bc}`,color:v.c,
      borderRadius:8,padding:"9px 16px",fontSize:20,fontFamily:"Georgia,serif",
      cursor:disabled?"not-allowed":"pointer",letterSpacing:0.5,
      opacity:disabled?0.5:1,transition:"all 0.15s",...style,
    }}>{children}</button>
  );
};

const Tag = ({children,color=T.gold}) => (
  <span style={{fontSize:17,background:`${color}18`,border:`1px solid ${color}40`,color,borderRadius:4,padding:"2px 7px",letterSpacing:1,textTransform:"uppercase",whiteSpace:"nowrap"}}>{children}</span>
);

const Card = ({children,style={},accent,glow}) => (
  <div style={{background:T.surface,border:`1px solid ${accent||T.border}`,borderRadius:12,padding:16,marginBottom:12,boxShadow:glow?`0 0 20px ${glow}20`:undefined,...style}}>{children}</div>
);

const SecTitle = ({children,action}) => (
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
    <div style={{fontSize:22,color:T.gold,letterSpacing:2,textTransform:"uppercase",fontWeight:"bold"}}>{children}</div>
    {action}
  </div>
);

function Toast({msg,type}) {
  return (
    <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:type==="error"?"#3a0f0f":"#0f2a1a",border:`1px solid ${type==="error"?T.red:T.green}`,color:type==="error"?T.red:T.green,padding:"10px 24px",borderRadius:12,fontSize:20,zIndex:9999,letterSpacing:0.5,whiteSpace:"nowrap",pointerEvents:"none",boxShadow:`0 4px 24px rgba(0,0,0,0.4)`}}>{msg}</div>
  );
}

const NAV = [
  {id:"dashboard",icon:"☀️", label:"Dashboard",      group:"core"},
  {id:"summer",   icon:"🤖", label:"Summer AI",       group:"core"},
  {id:"briefing", icon:"📰", label:"Briefing",        group:"core"},
  {id:"revenue",  icon:"💵", label:"Revenue",         group:"biz"},
  {id:"pl",       icon:"📈", label:"P&L",             group:"biz"},
  {id:"goals",    icon:"🎯", label:"Goal Tracker",    group:"biz"},
  {id:"reports",  icon:"📋", label:"Reports",         group:"biz"},
  {id:"shopify",  icon:"🛍️", label:"Shopify",         group:"biz"},
  {id:"drops",    icon:"⏱️", label:"Drop Timers",     group:"brand"},
  {id:"content",  icon:"📸", label:"Content Planner", group:"brand"},
  {id:"crm",      icon:"📓", label:"Black Book CRM",  group:"brand"},
  {id:"copy",     icon:"✍️", label:"Copy AI",         group:"brand"},
  {id:"email",    icon:"📧", label:"Email Writer",    group:"brand"},
  {id:"campaigns",icon:"📅", label:"Campaigns",       group:"ops"},
  {id:"tasks",    icon:"✅", label:"Tasks",           group:"ops"},
  {id:"inventory",icon:"📦", label:"Inventory",       group:"ops"},
  {id:"expenses", icon:"💰", label:"Expenses",        group:"ops"},
  {id:"notes",    icon:"📝", label:"Notes",           group:"ops"},
  {id:"voice",    icon:"🎤", label:"Voice",           group:"ops"},
  {id:"receipts", icon:"📷", label:"Receipts",        group:"ops"},
  {id:"brand",    icon:"🌊", label:"Brand Assets",    group:"ops"},
  {id:"settings", icon:"⚙️", label:"Settings",        group:"ops"},
];

const NAV_GROUPS = {
  core: {label:"CORE",   color:T.gold},
  biz:  {label:"BUSINESS",color:T.green},
  brand:{label:"BRAND",  color:T.blue},
  ops:  {label:"OPS",    color:T.textDim},
};

export default function App() {
  const [tab, setTab]       = useState("dashboard");
  const [toast, setToast]   = useState(null);
  const [side, setSide]     = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [floatOpen, setFloatOpen] = useState(false);

  const [notes, setNotes]         = useState([]);
  const [expenses, setExpenses]   = useState([]);
  const [receipts, setReceipts]   = useState([]);
  const [memos, setMemos]         = useState([]);
  const [tasks, setTasks]         = useState([]);
  const [inventory, setInventory] = useState([]);
  const [orders, setOrders]       = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [revenue, setRevenue]     = useState([]);
  const [contacts, setContacts]   = useState([]);
  const [drops, setDrops]         = useState([]);
  const [posts, setPosts]         = useState([]);
  const [goals, setGoals]         = useState([]);
  const [settings, setSettings]   = useState({
    storeName:"SOLSHOCK",ownerName:"Mike",currency:"USD",
    launched:"Mar 2, 2026",revenueGoal:"10000",shopifyStore:"",
  });

  useEffect(()=>{
    (async()=>{
      const load = async(k,d)=>{ const v=await store.get(k); return v||d; };
      setNotes(await load("ss_notes",[{id:uid(),title:"Launch Day Summary",body:"SOLSHOCK went live. The coast is calling.",cat:"Decision",date:"Mar 2, 2026",pinned:true}]));
      setExpenses(await load("ss_expenses",[{id:uid(),desc:"Shopify Monthly",amount:"39.00",cat:"Software",date:"2026-03-01"},{id:uid(),desc:"Logo Design",amount:"250.00",cat:"Design",date:"2026-02-14"}]));
      setReceipts(await load("ss_receipts",[]));
      setMemos(await load("ss_memos",[]));
      setTasks(await load("ss_tasks",[
        {id:uid(),title:"Set up Judge.me reviews",priority:"🔴 High",due:"2026-03-15",done:false,notes:""},
        {id:uid(),title:"Launch Instagram page",priority:"🟡 Medium",due:"2026-03-20",done:false,notes:""},
        {id:uid(),title:"Write product descriptions",priority:"🔴 High",due:"2026-03-12",done:false,notes:""},
      ]));
      setInventory(await load("ss_inventory",[
        {id:uid(),sku:"SS-SUN-SM",name:"Sunrise Tee",size:"S",qty:24,reorder:10,price:"38.00",collection:"Sunrise"},
        {id:uid(),sku:"SS-SUN-MD",name:"Sunrise Tee",size:"M",qty:18,reorder:10,price:"38.00",collection:"Sunrise"},
        {id:uid(),sku:"SS-NST-MD",name:"Night Mode Tee",size:"M",qty:8,reorder:10,price:"42.00",collection:"Night Mode"},
      ]));
      setOrders(await load("ss_orders",[
        {id:uid(),order:"#1001",customer:"Jake M.",item:"Sunrise Tee M",qty:1,stage:"Shipped",date:"2026-03-08",notes:""},
        {id:uid(),order:"#1002",customer:"Coast Supply",item:"Night Mode Tee M x3",qty:3,stage:"New",date:"2026-03-10",notes:"Wholesale"},
      ]));
      setCampaigns(await load("ss_campaigns",[{id:uid(),name:"Spring Sunrise Drop",collection:"Sunrise",type:"Product Launch",start:"2026-04-01",end:"2026-04-07",status:"Planned",notes:"Main spring push"}]));
      setRevenue(await load("ss_revenue",[
        {id:uid(),amount:"114.00",source:"Shopify",desc:"3x Sunrise Tee",date:"2026-03-08",collection:"Sunrise"},
        {id:uid(),amount:"126.00",source:"Shopify",desc:"3x Night Mode Tee wholesale",date:"2026-03-10",collection:"Night Mode"},
      ]));
      setContacts(await load("ss_contacts",[
        {id:uid(),name:"Jake Martinez",role:"Customer",email:"jake@example.com",phone:"",tags:"VIP,Repeat",notes:"First customer",lastContact:"2026-03-08"},
        {id:uid(),name:"Coast Supply Co",role:"Wholesale",email:"orders@coastsupply.com",phone:"",tags:"Wholesale,B2B",notes:"3x order",lastContact:"2026-03-10"},
      ]));
      setDrops(await load("ss_drops",[
        {id:uid(),name:"Summer UV Drop",collection:"UV",date:"2026-04-15",time:"12:00",desc:"Limited UV reactive collection drop",active:true},
        {id:uid(),name:"Night Mode Restock",collection:"Night Mode",date:"2026-03-25",time:"10:00",desc:"Full restock incoming",active:true},
      ]));
      setPosts(await load("ss_posts",[]));
      setGoals(await load("ss_goals",[
        {id:uid(),name:"March Revenue",target:"500",current:"240",unit:"$",deadline:"2026-03-31",color:T.green},
        {id:uid(),name:"Total Orders",target:"50",current:"2",unit:"#",deadline:"2026-06-30",color:T.blue},
      ]));
      setSettings(await load("ss_settings",{storeName:"SOLSHOCK",ownerName:"Mike",currency:"USD",launched:"Mar 2, 2026",revenueGoal:"10000",shopifyStore:""}));
      setLoaded(true);
    })();
  },[]);

  useEffect(()=>{ if(loaded) store.set("ss_notes",notes); },[notes,loaded]);
  useEffect(()=>{ if(loaded) store.set("ss_expenses",expenses); },[expenses,loaded]);
  useEffect(()=>{ if(loaded) store.set("ss_receipts",receipts); },[receipts,loaded]);
  useEffect(()=>{ if(loaded) store.set("ss_memos",memos); },[memos,loaded]);
  useEffect(()=>{ if(loaded) store.set("ss_tasks",tasks); },[tasks,loaded]);
  useEffect(()=>{ if(loaded) store.set("ss_inventory",inventory); },[inventory,loaded]);
  useEffect(()=>{ if(loaded) store.set("ss_orders",orders); },[orders,loaded]);
  useEffect(()=>{ if(loaded) store.set("ss_campaigns",campaigns); },[campaigns,loaded]);
  useEffect(()=>{ if(loaded) store.set("ss_revenue",revenue); },[revenue,loaded]);
  useEffect(()=>{ if(loaded) store.set("ss_contacts",contacts); },[contacts,loaded]);
  useEffect(()=>{ if(loaded) store.set("ss_drops",drops); },[drops,loaded]);
  useEffect(()=>{ if(loaded) store.set("ss_posts",posts); },[posts,loaded]);
  useEffect(()=>{ if(loaded) store.set("ss_goals",goals); },[goals,loaded]);
  useEffect(()=>{ if(loaded) store.set("ss_settings",settings); },[settings,loaded]);

  const showToast = (msg,type="success")=>{ setToast({msg,type}); setTimeout(()=>setToast(null),3000); };

  if (!loaded) return (
    <div style={{background:T.navy,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}>
      <SunLogo size={80}/>
      <div style={{color:T.gold,fontSize:20,letterSpacing:3}}>LOADING SOLSHOCK HUB…</div>
      <div style={{color:T.textDim,fontSize:18,letterSpacing:2}}>PHASE 6 · ALL SYSTEMS</div>
    </div>
  );

  const allData = {notes,expenses,tasks,inventory,orders,campaigns,revenue,contacts,drops,posts,goals,settings};
  const allSetters = {setNotes,setExpenses,setReceipts,setMemos,setTasks,setInventory,setOrders,setCampaigns,setRevenue,setContacts,setDrops,setPosts,setGoals,setSettings};
  const p = {showToast,setTab};

  const groupedNav = Object.entries(NAV_GROUPS).map(([gid,ginfo])=>({
    ...ginfo,id:gid,items:NAV.filter(n=>n.group===gid),
  }));

  return (
    <div style={{display:"flex",background:T.navy,minHeight:"100vh",fontFamily:"Georgia,serif",color:T.text}}>
      <style>{`
        @keyframes summerPulse{0%,100%{opacity:0.4;transform:scale(1)}50%{opacity:0.8;transform:scale(1.1)}}
        @keyframes tickPulse{0%,100%{opacity:1}50%{opacity:0.5}}
        @keyframes fadeInUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes shimmer{0%{background-position:-200% center}100%{background-position:200% center}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes glowPulse{0%,100%{box-shadow:0 0 10px rgba(245,166,35,0.2)}50%{box-shadow:0 0 30px rgba(245,166,35,0.5)}}
        *{scrollbar-width:thin;scrollbar-color:${T.border} transparent;}
        body,div,span,p{font-weight:500;}
        .ss-body-text{font-size:12px;}
        *::-webkit-scrollbar{width:4px;}
        *::-webkit-scrollbar-thumb{background:${T.border};border-radius:2px;}
      `}</style>
      <div style={{position:"fixed",top:0,left:0,right:0,height:3,background:"linear-gradient(90deg,#FF6B00,#FFB800,#3B82F6,#FF4500,#FFB800)",zIndex:100}}/>

      <aside style={{width:side?224:60,minHeight:"100vh",background:`linear-gradient(180deg,${T.navyMid},${T.navy})`,borderRight:`1px solid ${T.border}`,display:"flex",flexDirection:"column",transition:"width 0.22s cubic-bezier(.4,0,.2,1)",overflow:"hidden",position:"sticky",top:0,height:"100vh",flexShrink:0,zIndex:50}}>
        <div style={{padding:"14px 10px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:10,cursor:"pointer"}} onClick={()=>setSide(o=>!o)}>
          <SunLogo size={34}/>
          {side&&<div><div style={{fontSize:20,fontWeight:"bold",color:T.gold,letterSpacing:2}}>SOLSHOCK</div><div style={{fontSize:17,color:T.textDim,letterSpacing:1.5}}>BUSINESS HUB · P6</div></div>}
        </div>
        <nav style={{flex:1,padding:"8px 6px",overflowY:"auto"}}>
          {groupedNav.map(g=>(
            <div key={g.id} style={{marginBottom:4}}>
              {side&&<div style={{fontSize:17,color:g.color,letterSpacing:2,padding:"8px 8px 4px",opacity:0.7}}>{g.label}</div>}
              {g.items.map(n=>{
                const active=tab===n.id;
                return (
                  <button key={n.id} onClick={()=>setTab(n.id)} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:side?"8px 10px":"10px 0",justifyContent:side?"flex-start":"center",borderRadius:8,border:"none",cursor:"pointer",marginBottom:1,background:active?T.goldDim:"transparent",borderLeft:active?`3px solid ${T.gold}`:"3px solid transparent",color:active?T.gold:T.textDim,transition:"all 0.12s",fontSize:20,fontFamily:"Georgia,serif"}}>
                    <span style={{fontSize:21,lineHeight:1,flexShrink:0}}>{n.icon}</span>
                    {side&&<span style={{fontSize:19,letterSpacing:0.3,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{n.label}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        {side&&(
          <div style={{padding:"10px 14px",borderTop:`1px solid ${T.border}`}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
              <SummerAvatar size={22}/>
              <div style={{fontSize:17,color:T.gold,letterSpacing:1}}>SUMMER AI ONLINE</div>
            </div>
            <div style={{fontSize:17,color:T.green}}>● All data synced · Auto-save on</div>
          </div>
        )}
      </aside>

      <main style={{flex:1,display:"flex",flexDirection:"column",minHeight:"100vh",overflow:"hidden"}}>
        <header style={{height:50,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 22px",borderBottom:`1px solid ${T.border}`,background:T.navyMid,position:"sticky",top:0,zIndex:40,flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <button onClick={()=>setSide(o=>!o)} style={{background:"none",border:"none",color:T.textDim,cursor:"pointer",fontSize:23,padding:4}}>☰</button>
            <div style={{fontSize:20,color:T.text,letterSpacing:1}}>
              {NAV.find(n=>n.id===tab)?.icon} {NAV.find(n=>n.id===tab)?.label}
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{fontSize:17,color:T.textDim,letterSpacing:1}}>{new Date().toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})}</div>
            <Tag color={T.green}>LIVE</Tag>
            <Tag color={T.blue}>P6</Tag>
          </div>
        </header>

        {/* ── QUICK LINKS BAR ── */}
        <div style={{display:"flex",alignItems:"center",gap:6,padding:"7px 22px",borderBottom:`1px solid ${T.border}`,background:`linear-gradient(90deg,${T.navyMid},${T.navy})`,flexShrink:0,flexWrap:"wrap"}}>
          <span style={{fontSize:17,color:T.textMuted,letterSpacing:1.5,marginRight:4,flexShrink:0}}>QUICK</span>
          {[
            {label:"📧 Gmail",        url:"https://mail.google.com/mail/u/0/#inbox"},
            {label:"📁 Drive",        url:"https://drive.google.com/drive/folders/1g0fUmW0eqDR0SbkTOJ2NEKfTGh_l45aJ"},
            {label:"📄 Docs",         url:"https://docs.google.com/document/u/0/?tgif=d"},
            {label:"🛍️ Shopify",      url:"https://admin.shopify.com/store/solshock"},
            {label:"🖨️ Apliiq",       url:"https://apliiq.com"},
            {label:"🌐 SOLSHOCK",     url:"https://solshockco.com"},
          ].map(({label,url})=>(
            <a key={url} href={url} target="_blank" rel="noopener noreferrer"
              style={{
                fontSize:18,padding:"3px 10px",borderRadius:12,
                border:`1px solid ${T.border}`,
                background:"rgba(245,166,35,0.05)",
                color:T.textDim,textDecoration:"none",
                transition:"all 0.12s",cursor:"pointer",flexShrink:0,
                letterSpacing:0.3,fontFamily:"Georgia,serif",
              }}
              onMouseEnter={e=>{e.target.style.borderColor=T.gold;e.target.style.color=T.gold;e.target.style.background="rgba(245,166,35,0.12)";}}
              onMouseLeave={e=>{e.target.style.borderColor=T.border;e.target.style.color=T.textDim;e.target.style.background="rgba(245,166,35,0.05)";}}
            >{label}</a>
          ))}
        </div>

        <div style={{flex:1,overflowY:"auto",padding:"22px 22px 60px",fontSize:20}}>
          {tab==="dashboard"  && <Dashboard {...allData} {...p}/>}
          {tab==="summer"     && <SummerChat {...allData} {...p}/>}
          {tab==="briefing"   && <Briefing tasks={tasks} inventory={inventory} orders={orders} revenue={revenue} settings={settings}/>}
          {tab==="revenue"    && <Revenue revenue={revenue} setRevenue={setRevenue} expenses={expenses} goals={goals} {...p}/>}
          {tab==="pl"         && <PL revenue={revenue} expenses={expenses}/>}
          {tab==="goals"      && <GoalTracker goals={goals} setGoals={setGoals} revenue={revenue} orders={orders} {...p}/>}
          {tab==="reports"    && <Reports revenue={revenue} expenses={expenses} orders={orders} tasks={tasks} inventory={inventory} settings={settings} {...p}/>}
          {tab==="shopify"    && <ShopifyDash settings={settings} {...p}/>}
          {tab==="drops"      && <DropTimers drops={drops} setDrops={setDrops} {...p}/>}
          {tab==="content"    && <ContentPlanner posts={posts} setPosts={setPosts} {...p}/>}
          {tab==="crm"        && <BlackBook contacts={contacts} setContacts={setContacts} {...p}/>}
          {tab==="copy"       && <CopyAI {...p}/>}
          {tab==="email"      && <EmailWriter {...p}/>}
          {tab==="campaigns"  && <Campaigns campaigns={campaigns} setCampaigns={setCampaigns} {...p}/>}
          {tab==="tasks"      && <Tasks tasks={tasks} setTasks={setTasks} {...p}/>}
          {tab==="inventory"  && <Inventory inventory={inventory} setInventory={setInventory} {...p}/>}
          {tab==="expenses"   && <Expenses expenses={expenses} setExpenses={setExpenses} {...p}/>}
          {tab==="notes"      && <Notes notes={notes} setNotes={setNotes} {...p}/>}
          {tab==="voice"      && <VoiceMemos memos={memos} setMemos={setMemos} {...p}/>}
          {tab==="receipts"   && <Receipts receipts={receipts} setReceipts={setReceipts} setExpenses={setExpenses} {...p}/>}
          {tab==="brand"      && <BrandAssets/>}
          {tab==="settings"   && <Settings settings={settings} setSettings={setSettings} tasks={tasks} inventory={inventory} orders={orders} expenses={expenses} revenue={revenue} {...p}/>}
        </div>
      </main>
      {toast&&<Toast msg={toast.msg} type={toast.type}/>}
      <FloatingChat open={floatOpen} setOpen={setFloatOpen} allData={allData} settings={settings}/>
    </div>
  );
}

// ── FLOATING SUMMER CHAT ──────────────────────────────────────────────────────
function FloatingChat({open, setOpen, allData, settings}) {
  const [messages, setMessages] = useState([{
    role:"assistant",
    content:`Hey! ☀️ I'm Summer — ask me anything about SOLSHOCK. Strategy, copy, numbers, ideas — I'm always here.`
  }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(()=>{ if(open){ setUnread(0); setTimeout(()=>inputRef.current?.focus(),100); } },[open]);
  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); },[messages]);

  const {revenue=[],expenses=[],tasks=[],inventory=[],orders=[]} = allData||{};
  const totalRev = revenue.reduce((s,r)=>s+parseFloat(r.amount||0),0);
  const totalExp = expenses.reduce((s,r)=>s+parseFloat(r.amount||0),0);
  const openTasks = tasks.filter(t=>!t.done);
  const lowStock = inventory.filter(i=>parseInt(i.qty)<=parseInt(i.reorder));

  const bizContext = `SOLSHOCK Business snapshot (${new Date().toLocaleDateString()}):
Revenue: $${totalRev.toFixed(2)} | Expenses: $${totalExp.toFixed(2)} | Profit: $${(totalRev-totalExp).toFixed(2)}
Open tasks: ${openTasks.length}${openTasks.length>0?" ("+openTasks.slice(0,3).map(t=>t.title).join(", ")+")":""}
Low stock: ${lowStock.length>0?lowStock.map(i=>`${i.name}(${i.qty})`).join(", "):"None"}
Active orders: ${orders.filter(o=>o.stage!=="Done").length}`;

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(prev=>[...prev,{role:"user",content:userMsg}]);
    setLoading(true);
    try {
      const history = messages.slice(-10).map(m=>({role:m.role,content:m.content}));
      const res = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514", max_tokens:600,
          system:`You are Summer ☀️ — SOLSHOCK's bold, coastal, sharp AI business partner. You are in a compact floating chat widget so keep replies concise and punchy (2-5 sentences max unless asked for more). Reference actual business data when relevant. Never corporate. Always coastal.\n\nBusiness data:\n${bizContext}`,
          messages:[...history,{role:"user",content:userMsg}]
        })
      });
      const data = await res.json();
      const reply = data.content.filter(b=>b.type==="text").map(b=>b.text).join("\n");
      setMessages(prev=>[...prev,{role:"assistant",content:reply}]);
      if (!open) setUnread(n=>n+1);
    } catch {
      setMessages(prev=>[...prev,{role:"assistant",content:"Signal dropped for a sec — try again ☀️"}]);
    }
    setLoading(false);
  };

  const QUICK = ["What should I focus on?","How's revenue?","Any alerts?","Give me a caption"];

  return (
    <>
      {/* Floating bubble */}
      <button
        onClick={()=>setOpen(o=>!o)}
        style={{
          position:"fixed", bottom:28, right:28, zIndex:1000,
          width:58, height:58, borderRadius:"50%",
          background:`linear-gradient(135deg,#FF6B00,#f5a623)`,
          border:`2px solid ${T.gold}`,
          boxShadow:`0 4px 24px rgba(245,166,35,0.5)`,
          cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:31, transition:"all 0.2s",
          animation: open ? "none" : "glowPulse 2.5s infinite",
        }}
        title="Chat with Summer"
      >
        {open ? "✕" : "☀️"}
        {!open && unread > 0 && (
          <div style={{
            position:"absolute", top:-4, right:-4,
            width:18, height:18, borderRadius:"50%",
            background:T.red, border:`2px solid ${T.navy}`,
            fontSize:17, color:"white", display:"flex", alignItems:"center", justifyContent:"center",
            fontWeight:"bold"
          }}>{unread}</div>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div style={{
          position:"fixed", bottom:100, right:28, zIndex:999,
          width:360, height:520,
          background:`linear-gradient(180deg,${T.navyMid},${T.navy})`,
          border:`1px solid ${T.gold}50`,
          borderRadius:18,
          boxShadow:`0 8px 40px rgba(0,0,0,0.6), 0 0 30px rgba(245,166,35,0.15)`,
          display:"flex", flexDirection:"column",
          animation:"fadeInUp 0.2s ease",
          overflow:"hidden",
        }}>
          {/* Header */}
          <div style={{padding:"12px 16px", borderBottom:`1px solid ${T.border}`, background:T.navyMid, flexShrink:0, display:"flex", alignItems:"center", gap:10}}>
            <SummerAvatar size={32} pulse={loading}/>
            <div style={{flex:1}}>
              <div style={{fontSize:21, fontWeight:"bold", color:T.gold}}>Summer AI</div>
              <div style={{fontSize:17, color:loading?T.orange:T.green, letterSpacing:1}}>{loading?"● Thinking…":"● Online — always coastal"}</div>
            </div>
            <SpeakButton
              label="▶"
              getText={()=>{
                const last = [...messages].reverse().find(m=>m.role==="assistant");
                return last?.content||"";
              }}
              style={{flexShrink:0}}
            />
          </div>

          {/* Quick prompts */}
          <div style={{padding:"8px 12px", borderBottom:`1px solid ${T.borderDim}`, display:"flex", gap:5, flexWrap:"wrap", flexShrink:0}}>
            {QUICK.map(q=>(
              <button key={q} onClick={()=>setInput(q)} style={{
                fontSize:17, padding:"3px 8px", borderRadius:12,
                border:`1px solid ${T.border}`, background:"transparent",
                color:T.textDim, cursor:"pointer", fontFamily:"Georgia,serif",
                transition:"all 0.12s",
              }}
              onMouseEnter={e=>{e.currentTarget.style.color=T.gold;e.currentTarget.style.borderColor=T.gold;}}
              onMouseLeave={e=>{e.currentTarget.style.color=T.textDim;e.currentTarget.style.borderColor=T.border;}}
              >{q}</button>
            ))}
          </div>

          {/* Messages */}
          <div style={{flex:1, overflowY:"auto", padding:"12px", display:"flex", flexDirection:"column", gap:10}}>
            {messages.map((m,i)=>(
              <div key={i} style={{display:"flex", gap:8, alignItems:"flex-end", flexDirection:m.role==="user"?"row-reverse":"row", animation:"fadeInUp 0.15s ease"}}>
                {m.role==="assistant" && <SummerAvatar size={22}/>}
                <div style={{
                  maxWidth:"82%", padding:"9px 12px",
                  background: m.role==="user" ? T.goldDim : "rgba(15,31,61,0.9)",
                  border:`1px solid ${m.role==="user"?T.gold+"60":T.border}`,
                  borderRadius: m.role==="user" ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
                  fontSize:20, color:T.text, lineHeight:1.95, whiteSpace:"pre-wrap",
                }}>{m.content}</div>
              </div>
            ))}
            {loading && (
              <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
                <SummerAvatar size={22} pulse/>
                <div style={{padding:"10px 14px",background:"rgba(15,31,61,0.9)",border:`1px solid ${T.border}`,borderRadius:"12px 12px 12px 4px",display:"flex",gap:4}}>
                  {[0,1,2].map(i=><div key={i} style={{width:5,height:5,background:T.gold,borderRadius:"50%",animation:`tickPulse 1.2s ${i*0.2}s infinite`}}/>)}
                </div>
              </div>
            )}
            <div ref={bottomRef}/>
          </div>

          {/* Input */}
          <div style={{padding:"10px 12px", borderTop:`1px solid ${T.border}`, flexShrink:0, display:"flex", gap:8}}>
            <input
              ref={inputRef}
              value={input}
              onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}
              placeholder="Ask Summer anything…"
              style={{...fld(), flex:1, padding:"9px 12px", fontSize:20, borderRadius:10}}
            />
            <button
              onClick={send}
              disabled={loading||!input.trim()}
              style={{
                background:input.trim()?`linear-gradient(135deg,#FF6B00,#f5a623)`:"rgba(245,166,35,0.1)",
                border:`1px solid ${T.gold}`,
                borderRadius:10, padding:"13px 18px",
                cursor:input.trim()?"pointer":"not-allowed",
                fontSize:22, opacity:loading?0.5:1,
                transition:"all 0.15s",
              }}
            >☀️</button>
          </div>
        </div>
      )}
    </>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function Dashboard({notes,expenses,tasks,inventory,orders,campaigns,revenue,goals,drops,settings,setTab}) {
  const totalRev=revenue.reduce((s,r)=>s+parseFloat(r.amount||0),0);
  const totalExp=expenses.reduce((s,e)=>s+parseFloat(e.amount||0),0);
  const profit=totalRev-totalExp;
  const openTasks=tasks.filter(t=>!t.done).length;
  const overdue=tasks.filter(t=>!t.done&&t.due&&t.due<today()).length;
  const lowStock=inventory.filter(i=>parseInt(i.qty)<=parseInt(i.reorder));
  const daysSince=Math.floor((Date.now()-new Date("2026-03-02"))/86400000);
  const revenueGoal=parseFloat(settings.revenueGoal||10000);
  const goalPct=Math.min((totalRev/revenueGoal)*100,100).toFixed(1);
  const nextDrop=drops.filter(d=>d.active&&new Date(`${d.date}T${d.time}`).getTime()>Date.now())
    .sort((a,b)=>new Date(`${a.date}T${a.time}`)-new Date(`${b.date}T${b.time}`))[0];
  const cards=[
    {label:"Revenue",    val:fmt$(totalRev),   icon:"💵",tab:"revenue",  color:T.green,  sub:"Total sales"},
    {label:"Profit",     val:fmt$(profit),      icon:"📈",tab:"pl",       color:profit>=0?T.green:T.red,sub:profit>=0?"In the green":"Review spend"},
    {label:"Open Tasks", val:openTasks,         icon:"✅",tab:"tasks",    color:overdue>0?T.red:T.gold,sub:overdue>0?`${overdue} overdue`:"On track"},
  ];
  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:20,marginBottom:20,background:`linear-gradient(135deg,${T.navyMid},${T.navyLight})`,border:`1px solid ${T.border}`,borderRadius:18,padding:"20px 24px",flexWrap:"wrap",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-30,right:-30,opacity:0.03,fontSize:225}}>☀️</div>
        <SunLogo size={76}/>
        <div style={{flex:1}}>
          <div style={{fontSize:25,fontWeight:"bold",color:T.gold,letterSpacing:3}}>{settings.storeName}</div>
          <div style={{fontSize:19,color:T.textDim,marginTop:2}}>Coastal Clothing Co · Business Hub · Phase 6</div>
          <div style={{display:"flex",gap:8,marginTop:10,flexWrap:"wrap"}}>
            <Tag color={T.green}>Day {daysSince} Live</Tag>
            <Tag color={profit>=0?T.green:T.red}>{profit>=0?"Profitable":"Watch spend"}</Tag>
            <Tag color={T.gold}>Big Sun Energy ☀️</Tag>
          </div>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button onClick={()=>setTab("summer")} style={{background:"linear-gradient(135deg,rgba(255,107,0,0.2),rgba(245,166,35,0.2))",border:`1px solid ${T.gold}`,color:T.gold,borderRadius:10,padding:"10px 14px",cursor:"pointer",fontFamily:"Georgia,serif",fontSize:19}}>🤖 Summer AI</button>
          <button onClick={()=>setTab("briefing")} style={{background:T.goldDim,border:`1px solid ${T.gold}`,color:T.gold,borderRadius:10,padding:"10px 14px",cursor:"pointer",fontFamily:"Georgia,serif",fontSize:19}}>📰 Briefing</button>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10,marginBottom:16}}>
        {cards.map(s=>(
          <button key={s.label} onClick={()=>setTab(s.tab)} style={{background:T.surface,border:`1px solid ${s.color}28`,borderRadius:12,padding:"14px 12px",cursor:"pointer",textAlign:"left",fontFamily:"Georgia,serif",transition:"all 0.18s"}}
            onMouseEnter={e=>e.currentTarget.style.borderColor=s.color}
            onMouseLeave={e=>e.currentTarget.style.borderColor=`${s.color}28`}>
            <div style={{fontSize:25,marginBottom:7}}>{s.icon}</div>
            <div style={{fontSize:24,fontWeight:"bold",color:s.color}}>{s.val}</div>
            <div style={{fontSize:17,color:T.textDim,letterSpacing:1.5,marginTop:2}}>{s.label.toUpperCase()}</div>
            <div style={{fontSize:18,color:s.color,marginTop:4,opacity:0.7}}>{s.sub}</div>
          </button>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
        <Card accent={`rgba(74,222,128,0.25)`} glow={T.green}>
          <SecTitle>🎯 Revenue Goal</SecTitle>
          <div style={{fontSize:19,color:T.textDim,marginBottom:8}}>{fmt$(totalRev)} of {fmt$(revenueGoal)} goal</div>
          <div style={{height:10,background:"rgba(255,255,255,0.06)",borderRadius:5,overflow:"hidden",marginBottom:8}}>
            <div style={{width:`${goalPct}%`,height:"100%",background:`linear-gradient(90deg,${T.green},${T.teal})`,borderRadius:5,transition:"width 0.6s"}}/>
          </div>
          <div style={{display:"flex",justifyContent:"space-between"}}>
            <span style={{fontSize:19,color:T.green,fontWeight:"bold"}}>{goalPct}% complete</span>
            <span style={{fontSize:18,color:T.textDim}}>{fmt$(revenueGoal-totalRev)} remaining</span>
          </div>
          {goals.slice(0,2).map(g=>{
            const pct=Math.min((parseFloat(g.current)/parseFloat(g.target))*100,100);
            return (
              <div key={g.id} style={{marginTop:10}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                  <span style={{fontSize:18,color:T.textDim}}>{g.name}</span>
                  <span style={{fontSize:18,color:g.color}}>{g.current}/{g.target}{g.unit==="$"?"":g.unit}</span>
                </div>
                <div style={{height:5,background:"rgba(255,255,255,0.06)",borderRadius:3}}>
                  <div style={{width:`${pct}%`,height:"100%",background:g.color,borderRadius:3}}/>
                </div>
              </div>
            );
          })}
        </Card>
        <Card accent={`rgba(59,130,246,0.25)`} glow={T.blue}>
          <SecTitle>⏱️ Next Drop</SecTitle>
          {nextDrop
            ? <CountdownWidget drop={nextDrop}/>
            : <div style={{textAlign:"center",padding:"20px 0",color:T.textDim,fontSize:20}}>
                No upcoming drops scheduled.<br/>
                <button onClick={()=>setTab("drops")} style={{background:"none",border:"none",color:T.blue,cursor:"pointer",fontSize:19,marginTop:8,fontFamily:"Georgia,serif"}}>+ Schedule a Drop →</button>
              </div>
          }
        </Card>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        <Card>
          <SecTitle>📦 Low Stock Alerts</SecTitle>
          {lowStock.length===0&&<div style={{color:T.textDim,fontSize:20}}>All stock healthy ✓</div>}
          {lowStock.map(i=>(
            <div key={i.id} style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
              <div><div style={{fontSize:19,color:T.text}}>{i.name} {i.size}</div><div style={{fontSize:17,color:T.textDim}}>{i.sku}</div></div>
              <div style={{fontSize:22,fontWeight:"bold",color:T.red}}>{i.qty}</div>
            </div>
          ))}
        </Card>
        <Card>
          <SecTitle>🗂️ Order Pipeline</SecTitle>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {ORDER_STAGES.map(s=>{
              const count=orders.filter(o=>o.stage===s).length;
              return (
                <div key={s} style={{flex:1,minWidth:60,background:`${STAGE_COLORS[s]}12`,border:`1px solid ${STAGE_COLORS[s]}35`,borderRadius:8,padding:"10px 6px",textAlign:"center"}}>
                  <div style={{fontSize:22,fontWeight:"bold",color:STAGE_COLORS[s]}}>{count}</div>
                  <div style={{fontSize:17,color:T.textDim,letterSpacing:1,marginTop:2}}>{s.toUpperCase()}</div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

function CountdownWidget({drop}) {
  const [timeLeft,setTimeLeft]=useState({});
  useEffect(()=>{
    const calc=()=>{
      const target=new Date(`${drop.date}T${drop.time}`).getTime();
      const diff=target-Date.now();
      if(diff<=0) return setTimeLeft({expired:true});
      setTimeLeft({d:Math.floor(diff/86400000),h:Math.floor((diff%86400000)/3600000),m:Math.floor((diff%3600000)/60000),s:Math.floor((diff%60000)/1000)});
    };
    calc();
    const t=setInterval(calc,1000);
    return()=>clearInterval(t);
  },[drop]);
  if(timeLeft.expired) return <div style={{color:T.orange,fontSize:20,textAlign:"center"}}>🔴 Drop is LIVE!</div>;
  return (
    <div>
      <div style={{fontSize:20,fontWeight:"bold",color:T.blue,marginBottom:4}}>{drop.name}</div>
      <div style={{fontSize:18,color:T.textDim,marginBottom:12}}>{drop.collection} · {drop.date} at {drop.time}</div>
      <div style={{display:"flex",gap:8,justifyContent:"center"}}>
        {[["d","DAYS"],["h","HRS"],["m","MIN"],["s","SEC"]].map(([k,label])=>(
          <div key={k} style={{textAlign:"center",background:"rgba(59,130,246,0.1)",border:`1px solid ${T.blue}40`,borderRadius:10,padding:"10px 12px",minWidth:48}}>
            <div style={{fontSize:27,fontWeight:"bold",color:T.blue,fontFamily:"monospace",animation:k==="s"?"tickPulse 1s infinite":undefined}}>{String(timeLeft[k]||0).padStart(2,"0")}</div>
            <div style={{fontSize:17,color:T.textDim,letterSpacing:1.5}}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── SUMMER AI CHAT ─────────────────────────────────────────────────────────────
function SummerChat({revenue,expenses,tasks,inventory,orders,goals,settings}) {
  const [messages,setMessages]=useState([{role:"assistant",content:`Hey! I'm Summer ☀️ — your SOLSHOCK AI business partner.\n\nI know your whole operation: revenue, inventory, orders, goals, tasks — everything. Ask me anything or just think out loud. I'm here to help you move fast and stay coastal.\n\nWhat's on your mind?`}]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const bottomRef=useRef(null);
  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); },[messages]);
  const totalRev=revenue.reduce((s,r)=>s+parseFloat(r.amount||0),0);
  const totalExp=expenses.reduce((s,e)=>s+parseFloat(e.amount||0),0);
  const openTasks=tasks.filter(t=>!t.done);
  const lowStock=inventory.filter(i=>parseInt(i.qty)<=parseInt(i.reorder));
  const bizContext=`SOLSHOCK Coastal Clothing Co — Current Business Data (${new Date().toLocaleDateString()}):\nOwner: ${settings.ownerName||"Mike"}\nRevenue: $${totalRev.toFixed(2)} | Expenses: $${totalExp.toFixed(2)} | Profit: $${(totalRev-totalExp).toFixed(2)}\nRevenue Goal: $${settings.revenueGoal}\nOrders: ${orders.length} total, ${orders.filter(o=>o.stage==="New").length} new, ${orders.filter(o=>o.stage!=="Done").length} active\nOpen Tasks: ${openTasks.length}${openTasks.length>0?" ("+openTasks.slice(0,3).map(t=>t.title).join(", ")+")":""}\nLow Stock: ${lowStock.length>0?lowStock.map(i=>`${i.name} ${i.size}(${i.qty})`).join(", "):"None"}\nCollections: ${[...new Set(inventory.map(i=>i.collection))].join(", ")}\nSKUs: ${inventory.length}\n`;
  const send=async()=>{
    if(!input.trim()||loading) return;
    const userMsg=input.trim(); setInput("");
    setMessages(prev=>[...prev,{role:"user",content:userMsg}]);
    setLoading(true);
    try {
      const history=messages.slice(-8).map(m=>({role:m.role,content:m.content}));
      const body={model:"claude-sonnet-4-20250514",max_tokens:1000,system:`You are Summer, the SOLSHOCK AI business partner — bold, coastal, smart, direct, warm, and never corporate. You speak in SOLSHOCK brand voice: confident, lifestyle-forward, Big Sun Energy.\n\nYou have FULL knowledge of the business:\n${bizContext}\n\nRules:\n- Always be direct and useful. No fluff.\n- Reference actual business data when relevant.\n- When giving advice, make it specific to SOLSHOCK's situation.\n- Keep answers focused.\n- You're a partner, not a bot. Speak naturally.`,messages:[...history,{role:"user",content:userMsg}]};
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      const data=await res.json();
      const reply=data.content.filter(b=>b.type==="text").map(b=>b.text).join("\n");
      setMessages(prev=>[...prev,{role:"assistant",content:reply}]);
    } catch { setMessages(prev=>[...prev,{role:"assistant",content:"Connection hiccup. Try again — I'm still here ☀️"}]); }
    setLoading(false);
  };
  const QUICK=["What should I focus on today?","How's my revenue tracking?","Any inventory concerns?","Write me an Instagram caption","What's my profit margin?","Give me a 30-day growth plan"];
  return (
    <div style={{maxWidth:760,display:"flex",flexDirection:"column",height:"calc(100vh - 180px)"}}>
      <Card style={{marginBottom:12,flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <SummerAvatar size={48} pulse={loading}/>
          <div style={{flex:1}}>
            <div style={{fontSize:22,fontWeight:"bold",color:T.gold}}>Summer AI</div>
            <div style={{fontSize:19,color:T.textDim}}>Your SOLSHOCK business partner · Knows your entire operation</div>
          </div>
          <div style={{textAlign:"right"}}><Tag color={T.green}>Online</Tag><div style={{fontSize:17,color:T.textDim,marginTop:4}}>Powered by Claude</div></div>
        </div>
      </Card>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12,flexShrink:0}}>
        {QUICK.map(q=>(
          <button key={q} onClick={()=>setInput(q)} style={{padding:"4px 10px",borderRadius:20,border:`1px solid ${T.border}`,background:"transparent",color:T.textDim,fontSize:18,cursor:"pointer",fontFamily:"Georgia,serif",transition:"all 0.12s"}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=T.gold;e.currentTarget.style.color=T.gold;}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.color=T.textDim;}}
          >{q}</button>
        ))}
      </div>
      <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:12,padding:"4px 0",marginBottom:8,minHeight:0}}>
        {messages.map((m,i)=>(
          <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start",flexDirection:m.role==="user"?"row-reverse":"row",animation:"fadeInUp 0.2s ease"}}>
            {m.role==="assistant"&&<SummerAvatar size={30}/>}
            {m.role==="user"&&<div style={{width:30,height:30,borderRadius:"50%",background:T.goldDim,border:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{settings.ownerName?.[0]||"M"}</div>}
            <div style={{maxWidth:"75%",padding:"12px 14px",background:m.role==="user"?T.goldDim:T.surface,border:`1px solid ${m.role==="user"?T.gold+"50":T.border}`,borderRadius:m.role==="user"?"12px 12px 4px 12px":"12px 12px 12px 4px",fontSize:20,color:T.text,lineHeight:2.2,whiteSpace:"pre-wrap"}}>{m.content}</div>
          </div>
        ))}
        {loading&&(
          <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
            <SummerAvatar size={30} pulse/>
            <div style={{padding:"12px 16px",background:T.surface,border:`1px solid ${T.border}`,borderRadius:"12px 12px 12px 4px"}}>
              <div style={{display:"flex",gap:4}}>{[0,1,2].map(i=><div key={i} style={{width:6,height:6,background:T.gold,borderRadius:"50%",animation:`tickPulse 1.2s ${i*0.2}s infinite`}}/>)}</div>
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>
      {/* ── Speak + Input bar — always visible ── */}
      <div style={{flexShrink:0,display:"flex",flexDirection:"column",gap:8,paddingTop:8,borderTop:`1px solid ${T.border}`}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:18,color:T.textDim,letterSpacing:1}}>🔊</span>
          <SpeakButton
            label="▶ Play Summer's Response"
            getText={()=>{
              const last=[...messages].reverse().find(m=>m.role==="assistant");
              return last?.content||"";
            }}
          />
        </div>
        <div style={{display:"flex",gap:8}}>
          <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}} placeholder="Ask Summer anything about your business…" style={{...fld(),flex:1,padding:"12px 16px",fontSize:20}}/>
          <Btn onClick={send} disabled={loading||!input.trim()} variant="summer" style={{padding:"12px 20px",fontSize:20}}>☀️ Send</Btn>
        </div>
      </div>
    </div>
  );
}

// ── BRIEFING ──────────────────────────────────────────────────────────────────
const BRIEF_SECTIONS = [
  {key:"☀️", label:"Morning",    color:T.gold,   bg:"rgba(245,166,35,0.06)"},
  {key:"📊", label:"Business",   color:T.green,  bg:"rgba(74,222,128,0.06)"},
  {key:"👗", label:"Fashion",    color:T.purple, bg:"rgba(167,139,250,0.06)"},
  {key:"💰", label:"Markets",    color:T.orange, bg:"rgba(251,146,60,0.06)"},
  {key:"🇺🇸", label:"Trump Watch",color:T.red,    bg:"rgba(248,113,113,0.06)"},
  {key:"🌊", label:"Coastal",    color:T.blue,   bg:"rgba(59,130,246,0.06)"},
  {key:"⚡", label:"Action",     color:T.gold,   bg:"rgba(245,166,35,0.1)"},
];

function Briefing({tasks,inventory,orders,revenue,settings}) {
  const [briefing,setBriefing]=useState(null);
  const [loading,setLoading]=useState(false);
  const [lastGen,setLastGen]=useState(null);
  const [activeSection,setActiveSection]=useState(null);
  const sectionRefs=useRef({});

  const totalRev=revenue.reduce((s,r)=>s+parseFloat(r.amount||0),0);
  const openTasks=tasks.filter(t=>!t.done);
  const overdue=tasks.filter(t=>!t.done&&t.due&&t.due<today());
  const lowStock=inventory.filter(i=>parseInt(i.qty)<=parseInt(i.reorder));
  const newOrders=orders.filter(o=>o.stage==="New");

  const generate=async()=>{
    setLoading(true); setBriefing(null); setActiveSection(null);
    try {
      const bizStatus=`SOLSHOCK status ${new Date().toLocaleDateString()}:\nRevenue: $${totalRev.toFixed(2)} | Open tasks: ${openTasks.length} (${overdue.length} overdue) | Low stock: ${lowStock.length>0?lowStock.map(i=>`${i.name}(${i.qty})`).join(","):"None"} | New orders: ${newOrders.length}`;
      const result=await callClaude(
        `You are the SOLSHOCK Daily Intelligence Briefing AI for ${settings.ownerName||"Mike"}. SOLSHOCK is an independent coastal lifestyle clothing brand, launched March 2026.
Brand voice: Bold, coastal, confident, direct. Big Sun Energy.
Use web search for current news in every section. Cite specific headlines, numbers, and sources.

Write EXACTLY these 7 sections with these EXACT headers (emoji included):

☀️ GOOD MORNING, SOLSHOCK
[Personalized opener. Today's date. One coastal affirmation. Weather vibe if relevant.]

📊 YOUR BUSINESS TODAY
[Reference the actual business data provided. Revenue status. Task alerts. Low stock warnings. New orders. Be specific.]

👗 FASHION & STREETWEAR PULSE
[Search for: independent apparel brand news today, streetwear drops this week, DTC fashion trends March 2026, coastal brand market. Real headlines.]

💰 FINANCIAL MARKETS & ECONOMY
[Search for: S&P 500 today, consumer spending news, retail sector outlook, small business economic news. What it means for a DTC brand.]

🇺🇸 TRUMP & POLICY WATCH
[Search for: Trump tariffs 2026, import tax apparel, trade policy news today, small business regulations. Direct impact on SOLSHOCK sourcing and pricing.]

🌊 COASTAL LIFESTYLE & MARKET VIBES
[Search for: surf industry news, beach culture trends, outdoor lifestyle brands, coastal tourism. Your world, your market.]

⚡ TODAY'S FOCUS — TOP 3 PRIORITIES
[3 numbered, specific, bold action items. Based on the business data AND today's news. Make them actionable.]`,
        `Generate today's briefing.\n${bizStatus}\nDate: ${new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"})}.`,
        true
      );
      setBriefing(result);
      setLastGen(new Date().toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"}));
    } catch(err) { setBriefing(`⚡ Briefing failed: ${err.message}. Check connection and try again.`); }
    setLoading(false);
  };

  const scrollTo=(key)=>{
    setActiveSection(key);
    sectionRefs.current[key]?.scrollIntoView({behavior:"smooth",block:"start"});
  };

  // Parse briefing into sections
  const parsedSections = briefing ? (() => {
    const result=[];
    const keys=["☀️","📊","👗","💰","🇺🇸","🌊","⚡"];
    // Split on lines that START with one of our emojis
    const lines=briefing.split("\n");
    let current=null;
    for(const line of lines){
      const matchKey=keys.find(k=>line.trim().startsWith(k));
      if(matchKey){
        if(current) result.push(current);
        current={key:matchKey,header:line.trim(),body:[]};
      } else if(current){
        current.body.push(line);
      }
    }
    if(current) result.push(current);
    return result;
  })() : [];

  const LoadingDots=()=>(
    <div style={{display:"flex",gap:8,justifyContent:"center",marginTop:8}}>
      {BRIEF_SECTIONS.map((s,i)=>(
        <div key={s.key} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,opacity:0.6,animation:`tickPulse 1.5s ${i*0.15}s infinite`}}>
          <div style={{fontSize:23}}>{s.key}</div>
          <div style={{fontSize:12,color:s.color,letterSpacing:1}}>{s.label.toUpperCase()}</div>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{maxWidth:860}}>
      {/* Hero header */}
      <Card style={{marginBottom:16,padding:"24px",background:`linear-gradient(135deg,${T.navyMid},${T.navyLight})`,border:`1px solid ${T.gold}30`}}>
        <div style={{display:"flex",alignItems:"center",gap:20,flexWrap:"wrap"}}>
          <SunLogo size={60}/>
          <div style={{flex:1}}>
            <div style={{fontSize:23,fontWeight:"bold",color:T.gold,letterSpacing:3}}>☀️ DAILY BRIEFING</div>
            <div style={{fontSize:19,color:T.textDim,marginTop:2}}>{new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"})}</div>
            {lastGen&&<div style={{fontSize:18,color:T.green,marginTop:4}}>● Live · Generated {lastGen} · Web search active</div>}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8,alignItems:"flex-end"}}>
            <Btn onClick={generate} disabled={loading} style={{fontSize:20,padding:"12px 24px",animation:!briefing&&!loading?"glowPulse 2s infinite":undefined}}>
              {loading?"⏳ Searching web…":"☀️ Generate Briefing"}
            </Btn>
            <SpeakButton
              getText={()=>briefing||""}
              label="▶ Play Full Briefing"
              style={{justifyContent:"flex-end"}}
            />
          </div>
        </div>

        {/* Section nav pills */}
        {(briefing||loading)&&(
          <div style={{display:"flex",gap:6,marginTop:16,flexWrap:"wrap"}}>
            {BRIEF_SECTIONS.map(s=>(
              <button key={s.key} onClick={()=>briefing&&scrollTo(s.key)}
                style={{padding:"8px 16px",borderRadius:20,border:`1px solid ${activeSection===s.key?s.color:`${s.color}40`}`,background:activeSection===s.key?`${s.color}20`:"transparent",color:activeSection===s.key?s.color:T.textDim,fontSize:18,cursor:briefing?"pointer":"default",fontFamily:"Georgia,serif",transition:"all 0.15s",display:"flex",alignItems:"center",gap:4}}>
                <span style={{fontSize:20}}>{s.key}</span>
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Loading state */}
      {loading&&(
        <Card style={{textAlign:"center",padding:"40px 24px"}}>
          <div style={{fontSize:20,color:T.gold,letterSpacing:1,marginBottom:4}}>🌐 Searching the web for today's intel…</div>
          <div style={{fontSize:19,color:T.textDim,marginBottom:20}}>Fashion · Financial Markets · Trump Policy Watch · Coastal Vibes</div>
          <LoadingDots/>
          <div style={{marginTop:20,height:3,background:`linear-gradient(90deg,${T.navy},${T.gold},${T.blue},${T.gold},${T.navy})`,borderRadius:3,backgroundSize:"200% 100%",animation:"shimmer 2s linear infinite"}}/>
        </Card>
      )}

      {/* Briefing sections */}
      {parsedSections.map((sec)=>{
        const cfg=BRIEF_SECTIONS.find(s=>s.key===sec.key)||{color:T.gold,bg:T.goldDim};
        const isAction=sec.key==="⚡";
        const bodyText=sec.body.join("\n").trim();
        return (
          <div key={sec.key} ref={el=>sectionRefs.current[sec.key]=el}
            style={{background:cfg.bg,border:`1px solid ${cfg.color}30`,borderRadius:14,padding:"18px 20px",marginBottom:10,animation:"fadeInUp 0.3s ease",scrollMarginTop:20}}>
            <div style={{fontSize:20,fontWeight:"bold",color:cfg.color,letterSpacing:1.5,marginBottom:12,paddingBottom:10,borderBottom:`1px solid ${cfg.color}20`,display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:23}}>{sec.key}</span>
              <span>{sec.header.replace(sec.key,"").trim()}</span>
            </div>
            {isAction
              ? <div>{bodyText.split("\n").map((line,li)=>{
                  const isNum=/^\d+\./.test(line.trim());
                  if(!line.trim()) return null;
                  return (
                    <div key={li} style={{padding:isNum?"12px 14px":"4px 0",background:isNum?"rgba(245,166,35,0.08)":"transparent",borderRadius:isNum?10:0,border:isNum?`1px solid rgba(245,166,35,0.25)`:"none",marginBottom:isNum?10:2,color:isNum?T.gold:T.textDim,fontWeight:isNum?"bold":"normal",fontSize:isNum?13:12,lineHeight:2.2,display:"flex",gap:isNum?10:0,alignItems:isNum?"flex-start":"inherit"}}>
                      {line}
                    </div>
                  );
                })}</div>
              : <div style={{fontSize:20,color:T.text,lineHeight:1.9,whiteSpace:"pre-wrap"}}>{bodyText}</div>
            }
          </div>
        );
      })}

      {/* Raw fallback if parsing failed */}
      {briefing&&parsedSections.length===0&&(
        <Card>
          <div style={{fontSize:20,color:T.text,lineHeight:2.2,whiteSpace:"pre-wrap"}}>{briefing}</div>
        </Card>
      )}

      {/* Empty state */}
      {!briefing&&!loading&&(
        <Card style={{textAlign:"center",padding:52}}>
          <div style={{fontSize:58,marginBottom:14}}>📰</div>
          <div style={{color:T.text,fontSize:22,fontWeight:"bold",marginBottom:6}}>Your Daily Intelligence Briefing</div>
          <div style={{color:T.textDim,fontSize:20,marginBottom:20,lineHeight:2.2}}>Hit Generate and Summer searches the live web for<br/>everything relevant to SOLSHOCK — updated daily.</div>
          <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap",marginBottom:24}}>
            {BRIEF_SECTIONS.map(s=>(
              <div key={s.key} style={{fontSize:18,color:s.color,background:`${s.color}12`,border:`1px solid ${s.color}30`,borderRadius:8,padding:"6px 12px",display:"flex",alignItems:"center",gap:4}}>
                <span>{s.key}</span><span>{s.label}</span>
              </div>
            ))}
          </div>
          <Btn onClick={generate} style={{fontSize:20,padding:"12px 32px",animation:"glowPulse 2s infinite"}}>☀️ Generate Today's Briefing</Btn>
        </Card>
      )}
    </div>
  );
}

// ── GOAL TRACKER ──────────────────────────────────────────────────────────────
function GoalTracker({goals,setGoals,revenue,orders,showToast}) {
  const [form,setForm]=useState({name:"",target:"",current:"0",unit:"$",deadline:"",color:T.green});
  const COLORS=[T.green,T.blue,T.gold,T.purple,T.orange,T.teal];
  const add=()=>{
    if(!form.name.trim()||!form.target) return showToast("Name and target required","error");
    setGoals(p=>[...p,{id:uid(),...form}]);
    setForm({name:"",target:"",current:"0",unit:"$",deadline:"",color:T.green});
    showToast("Goal added ✓");
  };
  const del=id=>{setGoals(p=>p.filter(g=>g.id!==id));showToast("Deleted");};
  const update=(id,current)=>setGoals(p=>p.map(g=>g.id===id?{...g,current}:g));
  return (
    <div style={{maxWidth:800}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,marginBottom:20}}>
        {goals.map(g=>{
          const pct=Math.min((parseFloat(g.current)/parseFloat(g.target))*100,100);
          const done=pct>=100;
          return (
            <Card key={g.id} accent={`${g.color}40`} glow={done?g.color:undefined}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                <div style={{fontSize:20,fontWeight:"bold",color:T.text}}>{g.name}</div>
                <button onClick={()=>del(g.id)} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:T.textDim}}>✕</button>
              </div>
              <div style={{fontSize:31,fontWeight:"bold",color:g.color,marginBottom:4}}>{g.unit==="$"?fmt$(g.current):`${g.current}${g.unit}`}</div>
              <div style={{fontSize:18,color:T.textDim,marginBottom:10}}>of {g.unit==="$"?fmt$(g.target):`${g.target}${g.unit}`} goal</div>
              <div style={{height:8,background:"rgba(255,255,255,0.06)",borderRadius:4,overflow:"hidden",marginBottom:8}}>
                <div style={{width:`${pct}%`,height:"100%",background:g.color,borderRadius:4,transition:"width 0.5s"}}/>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:19,color:g.color,fontWeight:"bold"}}>{pct.toFixed(0)}%</span>
                {done&&<Tag color={T.green}>COMPLETE ✓</Tag>}
                {g.deadline&&<span style={{fontSize:17,color:T.textDim}}>📅 {g.deadline}</span>}
              </div>
              <input type="number" value={g.current} onChange={e=>update(g.id,e.target.value)} style={{...fld(),marginTop:10,fontSize:20,padding:"6px 10px"}} placeholder="Update progress…"/>
            </Card>
          );
        })}
      </div>
      <Card>
        <SecTitle>+ New Goal</SecTitle>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Inp label="Goal Name" value={form.name} onChange={v=>setForm(p=>({...p,name:v}))} placeholder="March Revenue"/>
          <Sel label="Unit" value={form.unit} onChange={v=>setForm(p=>({...p,unit:v}))} options={["$","orders","units","followers","reviews"]}/>
          <Inp label="Target" value={form.target} onChange={v=>setForm(p=>({...p,target:v}))} type="number" placeholder="1000"/>
          <Inp label="Current" value={form.current} onChange={v=>setForm(p=>({...p,current:v}))} type="number" placeholder="0"/>
          <Inp label="Deadline" value={form.deadline} onChange={v=>setForm(p=>({...p,deadline:v}))} type="date"/>
          <div style={{marginBottom:12}}>
            <div style={{fontSize:18,color:T.textDim,letterSpacing:1.5,marginBottom:6,textTransform:"uppercase"}}>Color</div>
            <div style={{display:"flex",gap:8}}>{COLORS.map(c=><button key={c} onClick={()=>setForm(p=>({...p,color:c}))} style={{width:24,height:24,borderRadius:"50%",background:c,border:`2px solid ${form.color===c?"white":"transparent"}`,cursor:"pointer"}}/>)}</div>
          </div>
        </div>
        <Btn onClick={add} style={{width:"100%"}}>+ Add Goal</Btn>
      </Card>
    </div>
  );
}

// ── REPORTS ───────────────────────────────────────────────────────────────────
function Reports({revenue,expenses,orders,tasks,inventory,settings,showToast}) {
  const [report,setReport]=useState(null);
  const [loading,setLoading]=useState(false);
  const totalRev=revenue.reduce((s,r)=>s+parseFloat(r.amount||0),0);
  const totalExp=expenses.reduce((s,e)=>s+parseFloat(e.amount||0),0);
  const profit=totalRev-totalExp;
  const margin=totalRev>0?((profit/totalRev)*100).toFixed(1):0;
  const generateReport=async()=>{
    setLoading(true); setReport(null);
    try {
      const bySource=["Shopify","Wholesale","Instagram","In-Person","Other"].map(s=>({source:s,total:revenue.filter(r=>r.source===s).reduce((a,r)=>a+parseFloat(r.amount||0),0)})).filter(x=>x.total>0);
      const expByCat=EXPENSE_CATS.map(c=>({cat:c,total:expenses.filter(e=>e.cat===c).reduce((s,e)=>s+parseFloat(e.amount||0),0)})).filter(x=>x.total>0);
      const data=`SOLSHOCK BUSINESS REPORT — ${new Date().toLocaleDateString()}\nStore: ${settings.storeName} | Owner: ${settings.ownerName} | Launched: ${settings.launched}\n\nFINANCIALS:\nRevenue: $${totalRev.toFixed(2)} | Expenses: $${totalExp.toFixed(2)} | Profit: $${profit.toFixed(2)} | Margin: ${margin}%\nRevenue by source: ${bySource.map(s=>`${s.source}: $${s.total.toFixed(2)}`).join(", ")}\nTop expenses: ${expByCat.slice(0,3).map(e=>`${e.cat}: $${e.total.toFixed(2)}`).join(", ")}\n\nOPERATIONS:\nOrders: ${orders.length} total | Active: ${orders.filter(o=>o.stage!=="Done").length} | Done: ${orders.filter(o=>o.stage==="Done").length}\nTasks: ${tasks.filter(t=>!t.done).length} open | ${tasks.filter(t=>t.done).length} complete\nInventory SKUs: ${inventory.length} | Low stock: ${inventory.filter(i=>parseInt(i.qty)<=parseInt(i.reorder)).length}`;
      const result=await callClaude(
        `You are the SOLSHOCK Business Report Generator. Write a clean, executive-style business performance report in SOLSHOCK brand voice. Include:\n1. Executive Summary (3-4 sentences)\n2. Financial Performance (detailed analysis)\n3. Operational Highlights\n4. Key Wins\n5. Areas to Watch\n6. Recommended Next Steps (5 specific actions)\n\nBe direct, data-driven, and coastal in tone.`,
        `Generate full business report:\n${data}`
      );
      setReport(result);
    } catch { showToast("Report generation failed","error"); }
    setLoading(false);
  };
  const copyReport=async()=>{ try{await navigator.clipboard.writeText(report);showToast("Report copied ✓");}catch{showToast("Copy failed","error");} };
  return (
    <div style={{maxWidth:800}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:20}}>
        {[{l:"Revenue",v:fmt$(totalRev),c:T.green},{l:"Expenses",v:fmt$(totalExp),c:T.red},{l:"Profit",v:fmt$(profit),c:profit>=0?T.green:T.red},{l:"Margin",v:`${margin}%`,c:parseFloat(margin)>=30?T.green:T.orange}].map(s=>(
          <div key={s.l} style={{background:T.surface,border:`1px solid ${s.c}30`,borderRadius:10,padding:"12px",textAlign:"center"}}>
            <div style={{fontSize:23,fontWeight:"bold",color:s.c}}>{s.v}</div>
            <div style={{fontSize:17,color:T.textDim,letterSpacing:1.5,marginTop:2}}>{s.l.toUpperCase()}</div>
          </div>
        ))}
      </div>
      <Card style={{marginBottom:16,textAlign:"center"}}>
        <div style={{fontSize:22,color:T.gold,fontWeight:"bold",marginBottom:8}}>📋 AI Business Report Generator</div>
        <div style={{fontSize:19,color:T.textDim,marginBottom:16}}>One button — full executive report with analysis and next steps</div>
        <Btn onClick={generateReport} disabled={loading} style={{fontSize:20,padding:"12px 28px"}}>{loading?"⏳ Generating Report…":"📊 Generate Full Report"}</Btn>
      </Card>
      {loading&&<Card style={{textAlign:"center",padding:40}}><div style={{fontSize:37,marginBottom:10}}>📊</div><div style={{color:T.gold,fontSize:20}}>Analyzing your business data…</div></Card>}
      {report&&(
        <Card>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <div style={{fontSize:19,color:T.gold,letterSpacing:2}}>BUSINESS REPORT · {new Date().toLocaleDateString()}</div>
            <div style={{display:"flex",gap:8}}>
              <Btn onClick={copyReport} variant="secondary" style={{fontSize:18,padding:"6px 12px"}}>📋 Copy</Btn>
              <Btn onClick={()=>setReport(null)} variant="ghost" style={{fontSize:18,padding:"6px 12px"}}>Clear</Btn>
            </div>
          </div>
          <div style={{fontSize:20,color:T.text,lineHeight:2.2,whiteSpace:"pre-wrap"}}>{report}</div>
        </Card>
      )}
    </div>
  );
}

// ── SHOPIFY DASHBOARD ─────────────────────────────────────────────────────────
function ShopifyDash({settings,showToast}) {
  const [storeUrl,setStoreUrl]=useState(settings.shopifyStore||"");
  const [analysis,setAnalysis]=useState(null);
  const [loading,setLoading]=useState(false);
  const analyze=async()=>{
    if(!storeUrl.trim()) return showToast("Enter your Shopify store URL","error");
    setLoading(true); setAnalysis(null);
    try {
      const result=await callClaude(
        `You are a Shopify analytics expert and SOLSHOCK business advisor. Analyze the store and provide actionable intelligence. Be specific and coastal in tone.`,
        `Analyze this Shopify store: ${storeUrl}\n\nSearch the web for:\n1. Shopify best practices for independent apparel brands 2026\n2. Shopify apps SOLSHOCK (coastal clothing, $38-42 shirts) should use\n3. Current Shopify conversion rate benchmarks for apparel\n4. Top strategies for independent DTC clothing brands\n\nProvide:\n- Recommended Shopify apps (top 5, with why)\n- Conversion optimization tips for coastal apparel\n- Pricing strategy insights\n- Email marketing recommendations`,
        true
      );
      setAnalysis(result);
    } catch { showToast("Analysis failed","error"); }
    setLoading(false);
  };
  return (
    <div style={{maxWidth:800}}>
      <Card style={{marginBottom:20}}>
        <SecTitle>🛍️ Shopify Intelligence</SecTitle>
        <div style={{fontSize:19,color:T.textDim,marginBottom:16}}>Enter your store URL for AI-powered optimization recommendations</div>
        <div style={{display:"flex",gap:10}}>
          <input value={storeUrl} onChange={e=>setStoreUrl(e.target.value)} placeholder="yourstore.myshopify.com" style={{...fld(),flex:1}}/>
          <Btn onClick={analyze} disabled={loading}>{loading?"⏳ Analyzing…":"🔍 Analyze"}</Btn>
        </div>
      </Card>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:16}}>
        <Card>
          <SecTitle>📱 Shopify Apps for SOLSHOCK</SecTitle>
          {[{name:"Judge.me",cat:"Reviews",desc:"Best free review app"},{name:"Klaviyo",cat:"Email",desc:"Email automation king"},{name:"Loox",cat:"Social Proof",desc:"Photo reviews"},{name:"Yotpo",cat:"Loyalty",desc:"Points & rewards"},{name:"Gorgias",cat:"Support",desc:"Customer support hub"}].map(app=>(
            <div key={app.name} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,paddingBottom:8,borderBottom:`1px solid ${T.borderDim}`}}>
              <div><div style={{fontSize:20,color:T.text,fontWeight:"bold"}}>{app.name}</div><div style={{fontSize:18,color:T.textDim}}>{app.desc}</div></div>
              <Tag color={T.blue}>{app.cat}</Tag>
            </div>
          ))}
        </Card>
        <Card>
          <SecTitle>📊 DTC Benchmarks</SecTitle>
          {[{metric:"Apparel CVR",value:"1.5–3%",color:T.green},{metric:"Email Open Rate",value:"18–25%",color:T.blue},{metric:"Cart Abandonment",value:"~70%",color:T.orange},{metric:"Avg Order Value",value:"$45–65",color:T.gold},{metric:"Return Customer Rate",value:"25–35%",color:T.purple}].map(b=>(
            <div key={b.metric} style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
              <span style={{fontSize:19,color:T.textDim}}>{b.metric}</span>
              <span style={{fontSize:20,fontWeight:"bold",color:b.color}}>{b.value}</span>
            </div>
          ))}
        </Card>
      </div>
      {loading&&<Card style={{textAlign:"center",padding:40}}><div style={{fontSize:37,marginBottom:10}}>🔍</div><div style={{color:T.gold,fontSize:20}}>Analyzing + searching for recommendations…</div></Card>}
      {analysis&&<Card><SecTitle>🛍️ AI Store Analysis</SecTitle><div style={{fontSize:20,color:T.text,lineHeight:2.2,whiteSpace:"pre-wrap"}}>{analysis}</div></Card>}
    </div>
  );
}

// ── DROP TIMERS ───────────────────────────────────────────────────────────────
function DropTimers({drops,setDrops,showToast}) {
  const [form,setForm]=useState({name:"",collection:"Sunrise",date:"",time:"12:00",desc:"",active:true});
  const add=()=>{
    if(!form.name.trim()||!form.date) return showToast("Name and date required","error");
    setDrops(p=>[...p,{id:uid(),...form}]);
    setForm({name:"",collection:"Sunrise",date:"",time:"12:00",desc:"",active:true});
    showToast("Drop scheduled ✓");
  };
  const del=id=>{setDrops(p=>p.filter(d=>d.id!==id));showToast("Deleted");};
  const toggle=id=>setDrops(p=>p.map(d=>d.id===id?{...d,active:!d.active}:d));
  const upcoming=drops.filter(d=>d.active&&new Date(`${d.date}T${d.time}`).getTime()>Date.now()).sort((a,b)=>new Date(`${a.date}T${a.time}`)-new Date(`${b.date}T${b.time}`));
  const past=drops.filter(d=>!d.active||new Date(`${d.date}T${d.time}`).getTime()<=Date.now());
  return (
    <div style={{maxWidth:800}}>
      <Card style={{marginBottom:20}}>
        <SecTitle>+ Schedule Drop</SecTitle>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Inp label="Drop Name" value={form.name} onChange={v=>setForm(p=>({...p,name:v}))} placeholder="Summer UV Collection Drop"/>
          <Sel label="Collection" value={form.collection} onChange={v=>setForm(p=>({...p,collection:v}))} options={COLLECTIONS}/>
          <Inp label="Drop Date" value={form.date} onChange={v=>setForm(p=>({...p,date:v}))} type="date"/>
          <Inp label="Drop Time" value={form.time} onChange={v=>setForm(p=>({...p,time:v}))} type="time"/>
        </div>
        <Inp label="Description" value={form.desc} onChange={v=>setForm(p=>({...p,desc:v}))} placeholder="What's dropping? Limited run, restock, new collection…"/>
        <Btn onClick={add} style={{width:"100%"}}>⏱️ Schedule Drop</Btn>
      </Card>
      {upcoming.length>0&&(
        <div style={{marginBottom:20}}>
          <div style={{fontSize:18,color:T.gold,letterSpacing:2,marginBottom:12}}>UPCOMING DROPS — LIVE COUNTDOWNS</div>
          {upcoming.map(drop=>(
            <Card key={drop.id} accent={`${T.blue}40`} glow={T.blue}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
                <div><div style={{fontSize:21,fontWeight:"bold",color:T.text,marginBottom:4}}>{drop.name}</div><div style={{display:"flex",gap:6}}><Tag color={T.blue}>{drop.collection}</Tag><Tag color={T.green}>LIVE COUNTDOWN</Tag></div></div>
                <div style={{display:"flex",gap:6}}>
                  <button onClick={()=>toggle(drop.id)} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:T.textDim}}>⏸</button>
                  <button onClick={()=>del(drop.id)} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:T.textDim}}>🗑️</button>
                </div>
              </div>
              <CountdownWidget drop={drop}/>
              {drop.desc&&<div style={{fontSize:19,color:T.textDim,marginTop:12,fontStyle:"italic"}}>{drop.desc}</div>}
            </Card>
          ))}
        </div>
      )}
      {past.length>0&&(
        <div>
          <div style={{fontSize:18,color:T.textDim,letterSpacing:2,marginBottom:10}}>PAST / INACTIVE DROPS</div>
          {past.map(drop=>(
            <div key={drop.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:T.surface,border:`1px solid ${T.borderDim}`,borderRadius:10,padding:"10px 14px",marginBottom:8,opacity:0.6}}>
              <div><div style={{fontSize:20,color:T.textDim}}>{drop.name}</div><div style={{fontSize:17,color:T.textMuted}}>{drop.date} at {drop.time}</div></div>
              <div style={{display:"flex",gap:6}}>
                <button onClick={()=>toggle(drop.id)} style={{background:"none",border:"none",cursor:"pointer",fontSize:19,color:T.blue,fontFamily:"Georgia,serif"}}>Reactivate</button>
                <button onClick={()=>del(drop.id)} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:T.textDim}}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {drops.length===0&&<Card style={{textAlign:"center",padding:48}}><div style={{fontSize:58,marginBottom:12}}>⏱️</div><div style={{color:T.textDim,fontSize:20}}>No drops scheduled yet. Schedule a vault drop to start the countdown. 🌊</div></Card>}
    </div>
  );
}

// ── CONTENT PLANNER ───────────────────────────────────────────────────────────
function ContentPlanner({posts,setPosts,showToast}) {
  const [form,setForm]=useState({platform:"Instagram",type:"Product",caption:"",date:"",time:"",collection:"Sunrise",status:"Planned",aiPrompt:""});
  const [generating,setGenerating]=useState(false);
  const PLATFORMS=["Instagram","TikTok","Both"];
  const TYPES=["Product","Lifestyle","Behind the Scenes","Drop Announce","Restock","User Generated","Story","Reel"];
  const STATUSES=["Planned","Ready","Posted","Needs Edit"];
  const SC={Planned:T.blue,Ready:T.green,Posted:T.textDim,"Needs Edit":T.orange};
  const generateCaption=async()=>{
    if(!form.aiPrompt.trim()) return showToast("Describe what you want to post","error");
    setGenerating(true);
    try {
      const caption=await callClaude(
        `You are the SOLSHOCK Social Media AI. Write in SOLSHOCK brand voice: bold, coastal, confident, lifestyle-forward.\nPlatform: ${form.platform}. Post type: ${form.type}. Collection: ${form.collection}.\nNEVER use: thin, boutique, cheap, discount, rugged, tough, heavy-duty, premium, GSM.\nALWAYS use: coastal energy, born at the beach, Big Sun Energy, designed for the coast.\n${form.platform==="Instagram"?"End with 8-10 relevant hashtags starting with #SOLSHOCK":"Keep it punchy and TikTok-native with trending audio suggestion"}`,
        `Write a ${form.platform} ${form.type} post caption:\n${form.aiPrompt}`
      );
      setForm(p=>({...p,caption}));
    } catch { showToast("Generation failed","error"); }
    setGenerating(false);
  };
  const add=()=>{
    if(!form.caption.trim()) return showToast("Caption required","error");
    setPosts(p=>[{id:uid(),...form,created:nowStr()},...p]);
    setForm(f=>({platform:f.platform,type:f.type,caption:"",date:"",time:"",collection:f.collection,status:"Planned",aiPrompt:""}));
    showToast("Post added to planner ✓");
  };
  const del=id=>{setPosts(p=>p.filter(post=>post.id!==id));showToast("Deleted");};
  const upStatus=(id,status)=>setPosts(p=>p.map(post=>post.id===id?{...post,status}:post));
  const byStat=STATUSES.map(s=>({s,count:posts.filter(p=>p.status===s).length}));
  return (
    <div style={{maxWidth:900}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:20}}>
        {byStat.map(({s,count})=>(
          <div key={s} style={{background:T.surface,border:`1px solid ${SC[s]}30`,borderRadius:10,padding:"12px",textAlign:"center"}}>
            <div style={{fontSize:25,fontWeight:"bold",color:SC[s]}}>{count}</div>
            <div style={{fontSize:17,color:T.textDim,letterSpacing:1.5}}>{s.toUpperCase()}</div>
          </div>
        ))}
      </div>
      <Card>
        <SecTitle>+ New Post</SecTitle>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:10}}>
          <Sel label="Platform" value={form.platform} onChange={v=>setForm(p=>({...p,platform:v}))} options={PLATFORMS}/>
          <Sel label="Type" value={form.type} onChange={v=>setForm(p=>({...p,type:v}))} options={TYPES}/>
          <Sel label="Collection" value={form.collection} onChange={v=>setForm(p=>({...p,collection:v}))} options={COLLECTIONS}/>
        </div>
        <Inp label="Describe your post (for AI generation)" value={form.aiPrompt} onChange={v=>setForm(p=>({...p,aiPrompt:v}))} placeholder="e.g. Sunrise Tee lifestyle shot at golden hour on the beach…"/>
        <Btn onClick={generateCaption} disabled={generating} variant="secondary" style={{width:"100%",marginBottom:10}}>{generating?"⏳ Writing…":"⚡ Generate Caption with AI"}</Btn>
        <Inp label="Caption" value={form.caption} onChange={v=>setForm(p=>({...p,caption:v}))} placeholder="Write or generate caption…" multi rows={4}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
          <Inp label="Schedule Date" value={form.date} onChange={v=>setForm(p=>({...p,date:v}))} type="date"/>
          <Inp label="Time" value={form.time} onChange={v=>setForm(p=>({...p,time:v}))} type="time"/>
          <Sel label="Status" value={form.status} onChange={v=>setForm(p=>({...p,status:v}))} options={STATUSES}/>
        </div>
        <Btn onClick={add} style={{width:"100%"}}>+ Add to Planner</Btn>
      </Card>
      {posts.map(post=>(
        <Card key={post.id} accent={`${SC[post.status]}30`}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              <Tag color={post.platform==="Instagram"?T.pink:post.platform==="TikTok"?T.teal:T.blue}>{post.platform}</Tag>
              <Tag color={T.purple}>{post.type}</Tag>
              <Tag color={SC[post.status]}>{post.status}</Tag>
              {post.collection&&<Tag color={T.gold}>{post.collection}</Tag>}
            </div>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              {post.date&&<span style={{fontSize:17,color:T.textDim}}>📅 {post.date} {post.time}</span>}
              <button onClick={()=>del(post.id)} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:T.textDim}}>🗑️</button>
            </div>
          </div>
          <div style={{fontSize:20,color:T.text,lineHeight:2.2,marginBottom:10,whiteSpace:"pre-wrap"}}>{post.caption}</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {STATUSES.filter(s=>s!==post.status).map(s=><button key={s} onClick={()=>upStatus(post.id,s)} style={{fontSize:17,padding:"2px 8px",borderRadius:4,border:`1px solid ${SC[s]}50`,background:`${SC[s]}10`,color:SC[s],cursor:"pointer",fontFamily:"Georgia,serif"}}>→ {s}</button>)}
            <button onClick={async()=>{try{await navigator.clipboard.writeText(post.caption);showToast("Caption copied ✓");}catch{}}} style={{fontSize:17,padding:"2px 8px",borderRadius:4,border:`1px solid ${T.border}`,background:"transparent",color:T.textDim,cursor:"pointer",fontFamily:"Georgia,serif"}}>📋 Copy</button>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ── BLACK BOOK CRM ────────────────────────────────────────────────────────────
function BlackBook({contacts,setContacts,showToast}) {
  const [form,setForm]=useState({name:"",role:"Customer",email:"",phone:"",tags:"",notes:"",lastContact:""});
  const [search,setSearch]=useState("");
  const [roleFilter,setRoleFilter]=useState("All");
  const [selected,setSelected]=useState(null);
  const [aiNote,setAiNote]=useState("");
  const [aiLoading,setAiLoading]=useState(false);
  const ROLES=["Customer","Wholesale","Supplier","Press","Collab","Influencer","Other"];
  const add=()=>{
    if(!form.name.trim()) return showToast("Name required","error");
    setContacts(p=>[...p,{id:uid(),...form,added:nowStr()}]);
    setForm({name:"",role:"Customer",email:"",phone:"",tags:"",notes:"",lastContact:""});
    showToast("Contact added ✓");
  };
  const del=id=>{setContacts(p=>p.filter(c=>c.id!==id));setSelected(null);showToast("Deleted");};
  const generateOutreach=async(contact)=>{
    setAiLoading(true); setAiNote("");
    try {
      const msg=await callClaude(
        `You are the SOLSHOCK outreach assistant. Write a personalized message in SOLSHOCK brand voice — bold, coastal, professional but warm. Sign off as "SOLSHOCK · Coastal Clothing Co". Be concise and purposeful.`,
        `Write a personalized outreach message to: ${contact.name} (${contact.role})\nTags: ${contact.tags}\nNotes: ${contact.notes}\nLast contact: ${contact.lastContact||"Not yet contacted"}`
      );
      setAiNote(msg);
    } catch { showToast("Generation failed","error"); }
    setAiLoading(false);
  };
  const filtered=contacts.filter(c=>(roleFilter==="All"||c.role===roleFilter)&&(c.name.toLowerCase().includes(search.toLowerCase())||(c.email||"").toLowerCase().includes(search.toLowerCase())||(c.tags||"").toLowerCase().includes(search.toLowerCase())));
  const ROLE_COLORS={Customer:T.gold,Wholesale:T.green,Supplier:T.blue,Press:T.purple,Collab:T.orange,Influencer:T.pink,Other:T.textDim};
  return (
    <div style={{maxWidth:1000}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(100px,1fr))",gap:8,marginBottom:16}}>
        {["All",...ROLES].map(r=>{
          const count=r==="All"?contacts.length:contacts.filter(c=>c.role===r).length;
          if(r!=="All"&&count===0) return null;
          return <div key={r} style={{background:T.surface,border:`1px solid ${ROLE_COLORS[r]||T.gold}30`,borderRadius:8,padding:"10px 8px",textAlign:"center",cursor:"pointer"}} onClick={()=>setRoleFilter(r)}><div style={{fontSize:22,fontWeight:"bold",color:ROLE_COLORS[r]||T.gold}}>{count}</div><div style={{fontSize:17,color:T.textDim,letterSpacing:1}}>{r.toUpperCase()}</div></div>;
        })}
      </div>
      <div style={{display:"grid",gridTemplateColumns:selected?"1fr 1fr":"1fr",gap:16}}>
        <div>
          <Card style={{marginBottom:12}}>
            <SecTitle>📓 Black Book — {contacts.length} Contacts</SecTitle>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search contacts…" style={{...fld(),marginBottom:10}}/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <Inp label="Name" value={form.name} onChange={v=>setForm(p=>({...p,name:v}))} placeholder="Full name"/>
              <Sel label="Role" value={form.role} onChange={v=>setForm(p=>({...p,role:v}))} options={ROLES}/>
              <Inp label="Email" value={form.email} onChange={v=>setForm(p=>({...p,email:v}))} placeholder="email@example.com"/>
              <Inp label="Phone" value={form.phone} onChange={v=>setForm(p=>({...p,phone:v}))} placeholder="+1 555 000 0000"/>
              <Inp label="Tags" value={form.tags} onChange={v=>setForm(p=>({...p,tags:v}))} placeholder="VIP, Wholesale, Repeat…"/>
              <Inp label="Last Contact" value={form.lastContact} onChange={v=>setForm(p=>({...p,lastContact:v}))} type="date"/>
            </div>
            <Inp label="Notes" value={form.notes} onChange={v=>setForm(p=>({...p,notes:v}))} placeholder="Any notes about this contact…" multi rows={2}/>
            <Btn onClick={add} style={{width:"100%"}}>+ Add Contact</Btn>
          </Card>
          {filtered.map(c=>(
            <div key={c.id} onClick={()=>setSelected(selected?.id===c.id?null:c)} style={{display:"flex",gap:12,alignItems:"center",background:selected?.id===c.id?T.goldDim:T.surface,border:`1px solid ${selected?.id===c.id?T.gold:T.borderDim}`,borderRadius:10,padding:"12px 14px",marginBottom:8,cursor:"pointer",transition:"all 0.15s"}}>
              <div style={{width:36,height:36,borderRadius:"50%",background:`${ROLE_COLORS[c.role]||T.gold}20`,border:`2px solid ${ROLE_COLORS[c.role]||T.gold}50`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:21,flexShrink:0}}>{c.name[0]}</div>
              <div style={{flex:1,overflow:"hidden"}}>
                <div style={{fontSize:20,color:T.text,fontWeight:"bold"}}>{c.name}</div>
                <div style={{display:"flex",gap:6,marginTop:3,flexWrap:"wrap"}}><Tag color={ROLE_COLORS[c.role]||T.gold}>{c.role}</Tag>{c.tags&&c.tags.split(",").slice(0,2).map(t=><Tag key={t} color={T.textDim}>{t.trim()}</Tag>)}</div>
              </div>
              {c.email&&<div style={{fontSize:18,color:T.textDim,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:160}}>{c.email}</div>}
            </div>
          ))}
        </div>
        {selected&&(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
              <div style={{fontSize:18,color:T.gold,letterSpacing:2}}>CONTACT DETAIL</div>
              <button onClick={()=>{setSelected(null);setAiNote("");}} style={{background:"none",border:"none",color:T.textDim,cursor:"pointer"}}>✕</button>
            </div>
            <Card>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
                <div style={{width:52,height:52,borderRadius:"50%",background:`${ROLE_COLORS[selected.role]||T.gold}20`,border:`2px solid ${ROLE_COLORS[selected.role]||T.gold}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:27}}>{selected.name[0]}</div>
                <div><div style={{fontSize:22,fontWeight:"bold",color:T.text}}>{selected.name}</div><Tag color={ROLE_COLORS[selected.role]||T.gold}>{selected.role}</Tag></div>
              </div>
              {selected.email&&<div style={{fontSize:20,color:T.textDim,marginBottom:6}}>📧 {selected.email}</div>}
              {selected.phone&&<div style={{fontSize:20,color:T.textDim,marginBottom:6}}>📱 {selected.phone}</div>}
              {selected.lastContact&&<div style={{fontSize:20,color:T.textDim,marginBottom:6}}>📅 Last contact: {selected.lastContact}</div>}
              {selected.tags&&<div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:10}}>{selected.tags.split(",").map(t=><Tag key={t} color={T.blue}>{t.trim()}</Tag>)}</div>}
              {selected.notes&&<div style={{fontSize:20,color:T.text,lineHeight:2.2,background:"rgba(10,22,40,0.5)",padding:12,borderRadius:8,marginBottom:12}}>{selected.notes}</div>}
              <div style={{display:"flex",gap:8,marginTop:4}}>
                <Btn onClick={()=>generateOutreach(selected)} disabled={aiLoading} style={{flex:1}} variant="summer">{aiLoading?"⏳ Writing…":"✍️ Draft Outreach"}</Btn>
                <Btn onClick={()=>del(selected.id)} variant="danger">🗑️</Btn>
              </div>
            </Card>
            {aiNote&&(
              <Card>
                <SecTitle>✍️ AI Outreach Draft</SecTitle>
                <textarea value={aiNote} onChange={e=>setAiNote(e.target.value)} rows={8} style={{...fld(true)}}/>
                <Btn onClick={async()=>{try{await navigator.clipboard.writeText(aiNote);showToast("Copied ✓");}catch{}}} variant="secondary" style={{width:"100%",marginTop:8}}>📋 Copy</Btn>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── EMAIL WRITER ──────────────────────────────────────────────────────────────
function EmailWriter({showToast}) {
  const [form,setForm]=useState({type:"Customer Welcome",subject:"",tone:"Bold & Coastal",context:"",recipient:""});
  const [result,setResult]=useState(null);
  const [loading,setLoading]=useState(false);
  const EMAIL_TYPES=["Customer Welcome","Order Confirmation","Drop Announcement","Restock Alert","Wholesale Outreach","Abandoned Cart","Thank You","Press Inquiry Reply","Influencer Collab","Custom"];
  const generate=async()=>{
    setLoading(true); setResult(null);
    try {
      const out=await callClaude(
        `You are the SOLSHOCK Email Writer. Write emails in SOLSHOCK brand voice — bold, coastal, confident, warm.\nNEVER use: boutique, premium, thin, discount, heavy-duty.\nALWAYS: coastal energy, born at the beach, Big Sun Energy.\nFormat output as:\nSUBJECT: [subject line]\n---\n[email body]\n---\nPREVIEW TEXT: [35-45 char preview]`,
        `Write a SOLSHOCK ${form.type} email.\nTone: ${form.tone}\nRecipient: ${form.recipient||"customer"}\nContext: ${form.context||"general"}\n${form.subject?`Suggested subject: ${form.subject}`:""}`
      );
      setResult(out);
    } catch { showToast("Generation failed","error"); }
    setLoading(false);
  };
  const parts=result?(()=>{
    const subMatch=result.match(/SUBJECT:\s*(.+)/);
    const prevMatch=result.match(/PREVIEW TEXT:\s*(.+)/);
    const bodyMatch=result.match(/---\n([\s\S]+?)\n---/);
    return {subject:subMatch?.[1]?.trim()||"",body:bodyMatch?.[1]?.trim()||result,preview:prevMatch?.[1]?.trim()||""};
  })():null;
  return (
    <div style={{maxWidth:800}}>
      <Card>
        <SecTitle>📧 Summer Email Writer</SecTitle>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,padding:12,background:"rgba(245,166,35,0.06)",borderRadius:8,border:`1px solid ${T.border}`}}>
          <SummerAvatar size={32}/>
          <div style={{fontSize:20,color:T.textDim}}>Summer writes every email in SOLSHOCK voice. Pick the type and describe your context.</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Sel label="Email Type" value={form.type} onChange={v=>setForm(p=>({...p,type:v}))} options={EMAIL_TYPES}/>
          <Sel label="Tone" value={form.tone} onChange={v=>setForm(p=>({...p,tone:v}))} options={["Bold & Coastal","Warm & Personal","Professional","Urgent","Celebratory"]}/>
          <Inp label="Recipient (optional)" value={form.recipient} onChange={v=>setForm(p=>({...p,recipient:v}))} placeholder="Jake, wholesale buyer, press contact…"/>
          <Inp label="Suggested Subject (optional)" value={form.subject} onChange={v=>setForm(p=>({...p,subject:v}))} placeholder="Leave blank for AI to generate"/>
        </div>
        <Inp label="Context / Key Details" value={form.context} onChange={v=>setForm(p=>({...p,context:v}))} placeholder="What's this email about? Order #1001, drop on April 15th, collaboration offer…" multi rows={3}/>
        <Btn onClick={generate} disabled={loading} style={{width:"100%",fontSize:20,padding:"12px"}}>{loading?"⏳ Writing…":"📧 Write Email"}</Btn>
      </Card>
      {loading&&<Card style={{textAlign:"center",padding:32}}><SummerAvatar size={40} pulse/><div style={{color:T.gold,fontSize:20,marginTop:12}}>Writing in SOLSHOCK voice…</div></Card>}
      {parts&&(
        <div>
          <Card accent={`${T.blue}40`}>
            <div style={{fontSize:18,color:T.textDim,letterSpacing:1.5,marginBottom:6}}>SUBJECT LINE</div>
            <div style={{fontSize:21,fontWeight:"bold",color:T.text,marginBottom:10}}>{parts.subject}</div>
            {parts.preview&&<div style={{fontSize:18,color:T.textDim}}>Preview: <span style={{color:T.gold}}>{parts.preview}</span></div>}
          </Card>
          <Card>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div style={{fontSize:18,color:T.gold,letterSpacing:2}}>EMAIL BODY</div>
              <Btn onClick={async()=>{try{await navigator.clipboard.writeText(`Subject: ${parts.subject}\n\n${parts.body}`);showToast("Copied ✓");}catch{}}} variant="secondary" style={{fontSize:18,padding:"8px 16px"}}>📋 Copy All</Btn>
            </div>
            <textarea value={parts.body} onChange={e=>setResult(result.replace(parts.body,e.target.value))} rows={12} style={{...fld(true),lineHeight:2.2}}/>
          </Card>
        </div>
      )}
      <Card style={{marginTop:4}}>
        <SecTitle>⚡ Quick Templates</SecTitle>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
          {[{type:"Customer Welcome",icon:"👋",desc:"First order welcome"},{type:"Drop Announcement",icon:"🔥",desc:"Announce a new drop"},{type:"Restock Alert",icon:"📦",desc:"Back in stock"},{type:"Wholesale Outreach",icon:"🤝",desc:"New B2B outreach"},{type:"Abandoned Cart",icon:"🛒",desc:"Win back customers"},{type:"Thank You",icon:"🌊",desc:"Post-purchase love"}].map(t=>(
            <button key={t.type} onClick={()=>setForm(p=>({...p,type:t.type}))} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 8px",cursor:"pointer",textAlign:"center",fontFamily:"Georgia,serif",transition:"all 0.12s"}}
              onMouseEnter={e=>e.currentTarget.style.borderColor=T.gold}
              onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
              <div style={{fontSize:25,marginBottom:4}}>{t.icon}</div>
              <div style={{fontSize:18,color:T.text,fontWeight:"bold"}}>{t.type}</div>
              <div style={{fontSize:17,color:T.textDim}}>{t.desc}</div>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ── COPY AI ───────────────────────────────────────────────────────────────────
function CopyAI({showToast}) {
  const [form,setForm]=useState({product:"",collection:"Sunrise",features:"",vibe:"bold coastal lifestyle"});
  const [result,setResult]=useState(null);
  const [loading,setLoading]=useState(false);
  const [history,setHistory]=useState([]);
  const generate=async()=>{
    if(!form.product.trim()) return showToast("Enter a product name","error");
    setLoading(true); setResult(null);
    try {
      const out=await callClaude(
        `You are the SOLSHOCK Copy AI. Brand voice: bold, coastal, confident, lifestyle-forward.\nNEVER use: thin, boutique, cheap, discount, rugged, tough, heavy-duty, premium, GSM, fabric weight.\nALWAYS use: bold coastal lifestyle, born at the beach, coastal energy, designed for the coast.\n\nOUTPUT FORMAT:\n📝 PRODUCT DESCRIPTION\n(3-4 sentences lifestyle-forward)\n\n📱 INSTAGRAM CAPTION\n(2-3 lines + 8-10 hashtags)\n\n📧 EMAIL SUBJECT LINE\n(One punchy line)\n\n📧 EMAIL BODY\n(4-5 sentences, SOLSHOCK voice)\n\n🏷️ SHORT TAG LINE\n(Under 8 words)`,
        `Product: ${form.product}\nCollection: ${form.collection}\nDetails: ${form.features||"coastal lifestyle apparel"}\nVibe: ${form.vibe}`
      );
      setResult(out);
      setHistory(p=>[{id:uid(),product:form.product,collection:form.collection,output:out,date:nowStr()},...p.slice(0,9)]);
    } catch { showToast("Generation failed","error"); }
    setLoading(false);
  };
  const copy=async t=>{try{await navigator.clipboard.writeText(t);showToast("Copied ✓");}catch{showToast("Copy failed","error");}};
  const sections=result?result.split(/(?=📝|📱|📧|🏷️)/).filter(s=>s.trim()):[];
  return (
    <div style={{maxWidth:800}}>
      <Card>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
          <SummerAvatar size={32}/>
          <div><div style={{fontSize:20,fontWeight:"bold",color:T.gold}}>Copy AI</div><div style={{fontSize:18,color:T.textDim}}>Product descriptions, captions, email copy — all in SOLSHOCK voice</div></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Inp label="Product Name" value={form.product} onChange={v=>setForm(p=>({...p,product:v}))} placeholder="Night Mode Tee"/>
          <Sel label="Collection" value={form.collection} onChange={v=>setForm(p=>({...p,collection:v}))} options={COLLECTIONS}/>
        </div>
        <Inp label="Key Details" value={form.features} onChange={v=>setForm(p=>({...p,features:v}))} placeholder="100% cotton, relaxed fit, front crest graphic…"/>
        <Inp label="Vibe / Notes" value={form.vibe} onChange={v=>setForm(p=>({...p,vibe:v}))} placeholder="bold coastal lifestyle"/>
        <Btn onClick={generate} disabled={loading} style={{width:"100%",fontSize:20,padding:"12px"}}>{loading?"⏳ Writing…":"⚡ Generate SOLSHOCK Copy"}</Btn>
      </Card>
      {loading&&<Card style={{textAlign:"center",padding:32}}><div style={{fontSize:33,marginBottom:10}}>✍️</div><div style={{color:T.gold,fontSize:20}}>Writing in SOLSHOCK voice…</div></Card>}
      {sections.map((s,i)=>{
        const lines=s.trim().split("\n").filter(l=>l.trim());
        const body=lines.slice(1).join("\n").trim();
        return (
          <Card key={i}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div style={{fontSize:20,fontWeight:"bold",color:T.gold}}>{lines[0]}</div>
              <Btn onClick={()=>copy(body)} variant="ghost" style={{fontSize:18,padding:"4px 10px"}}>Copy</Btn>
            </div>
            <div style={{fontSize:20,color:T.text,lineHeight:2.2,whiteSpace:"pre-wrap"}}>{body}</div>
          </Card>
        );
      })}
      {sections.length>0&&<Btn onClick={()=>copy(result)} variant="secondary" style={{width:"100%",marginTop:4}}>📋 Copy All</Btn>}
      {history.length>0&&(
        <Card style={{marginTop:12}}>
          <SecTitle>🕒 Recent</SecTitle>
          {history.map(h=>(
            <div key={h.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:`1px solid ${T.borderDim}`,paddingBottom:8,marginBottom:8}}>
              <div><div style={{fontSize:20,color:T.text}}>{h.product}</div><div style={{display:"flex",gap:6,marginTop:2}}><Tag color={T.blue}>{h.collection}</Tag><span style={{fontSize:17,color:T.textDim}}>{h.date}</span></div></div>
              <Btn onClick={()=>setResult(h.output)} variant="ghost" style={{fontSize:18,padding:"4px 10px"}}>View</Btn>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

// ── REVENUE ───────────────────────────────────────────────────────────────────
function Revenue({revenue,setRevenue,expenses,goals,showToast}) {
  const [form,setForm]=useState({amount:"",source:"Shopify",desc:"",date:today(),collection:"Sunrise"});
  const SOURCES=["Shopify","Wholesale","Instagram","In-Person","Other"];
  const add=()=>{
    if(!form.amount||!form.desc.trim()) return showToast("Amount and description required","error");
    setRevenue(p=>[{id:uid(),...form},...p]);
    setForm(f=>({amount:"",source:f.source,desc:"",date:f.date,collection:f.collection}));
    showToast("Revenue logged ✓");
  };
  const del=id=>{setRevenue(p=>p.filter(r=>r.id!==id));showToast("Deleted");};
  const totalRev=revenue.reduce((s,r)=>s+parseFloat(r.amount||0),0);
  const totalExp=expenses.reduce((s,e)=>s+parseFloat(e.amount||0),0);
  const profit=totalRev-totalExp;
  const margin=totalRev>0?((profit/totalRev)*100).toFixed(1):0;
  const bySource=SOURCES.map(s=>({source:s,total:revenue.filter(r=>r.source===s).reduce((a,r)=>a+parseFloat(r.amount||0),0)})).filter(x=>x.total>0).sort((a,b)=>b.total-a.total);
  const byColl=[...new Set(revenue.map(r=>r.collection))].map(c=>({col:c,total:revenue.filter(r=>r.collection===c).reduce((a,r)=>a+parseFloat(r.amount||0),0)})).sort((a,b)=>b.total-a.total);
  return (
    <div style={{maxWidth:800}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:20}}>
        {[{l:"Total Revenue",v:fmt$(totalRev),c:T.green},{l:"Net Profit",v:fmt$(profit),c:profit>=0?T.green:T.red},{l:"Margin",v:`${margin}%`,c:parseFloat(margin)>=30?T.green:T.orange}].map(s=>(
          <div key={s.l} style={{background:T.surface,border:`1px solid ${s.c}30`,borderRadius:12,padding:"16px",textAlign:"center"}}>
            <div style={{fontSize:29,fontWeight:"bold",color:s.c}}>{s.v}</div>
            <div style={{fontSize:17,color:T.textDim,letterSpacing:1.5,marginTop:4}}>{s.l.toUpperCase()}</div>
          </div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
        <Card accent={`rgba(74,222,128,0.2)`}>
          <SecTitle>💵 By Source</SecTitle>
          {bySource.map(({source,total})=>(
            <div key={source} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
              <div style={{fontSize:19,color:T.textDim,width:80,flexShrink:0}}>{source}</div>
              <div style={{flex:1,height:5,background:"rgba(255,255,255,0.06)",borderRadius:3}}><div style={{width:`${(total/totalRev)*100}%`,height:"100%",background:T.green,borderRadius:3}}/></div>
              <div style={{fontSize:19,color:T.green,width:70,textAlign:"right"}}>{fmt$(total)}</div>
            </div>
          ))}
          {bySource.length===0&&<div style={{color:T.textDim,fontSize:20}}>No revenue logged yet.</div>}
        </Card>
        <Card>
          <SecTitle>🌊 By Collection</SecTitle>
          {byColl.map(({col,total})=>(
            <div key={col} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
              <div style={{fontSize:19,color:T.textDim,width:80,flexShrink:0}}>{col}</div>
              <div style={{flex:1,height:5,background:"rgba(255,255,255,0.06)",borderRadius:3}}><div style={{width:`${(total/totalRev)*100}%`,height:"100%",background:T.gold,borderRadius:3}}/></div>
              <div style={{fontSize:19,color:T.gold,width:70,textAlign:"right"}}>{fmt$(total)}</div>
            </div>
          ))}
        </Card>
      </div>
      <Card>
        <SecTitle>+ Log Revenue</SecTitle>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Inp label="Amount ($)" value={form.amount} onChange={v=>setForm(p=>({...p,amount:v}))} type="number" placeholder="0.00"/>
          <Sel label="Source" value={form.source} onChange={v=>setForm(p=>({...p,source:v}))} options={SOURCES}/>
          <Inp label="Description" value={form.desc} onChange={v=>setForm(p=>({...p,desc:v}))} placeholder="3x Sunrise Tee M"/>
          <Inp label="Date" value={form.date} onChange={v=>setForm(p=>({...p,date:v}))} type="date"/>
          <Sel label="Collection" value={form.collection} onChange={v=>setForm(p=>({...p,collection:v}))} options={COLLECTIONS}/>
        </div>
        <Btn onClick={add} style={{width:"100%"}}>+ Log Revenue</Btn>
      </Card>
      {revenue.map(r=>(
        <div key={r.id} style={{display:"flex",alignItems:"center",gap:12,background:T.surface,border:`1px solid rgba(74,222,128,0.12)`,borderRadius:10,padding:"10px 14px",marginBottom:8}}>
          <div style={{flex:1}}><div style={{fontSize:20,color:T.text}}>{r.desc}</div><div style={{display:"flex",gap:8,marginTop:3}}><Tag color={T.blue}>{r.source}</Tag><Tag color={T.purple}>{r.collection}</Tag><span style={{fontSize:17,color:T.textDim}}>{r.date}</span></div></div>
          <div style={{fontSize:21,fontWeight:"bold",color:T.green}}>{fmt$(r.amount)}</div>
          <button onClick={()=>del(r.id)} style={{background:"none",border:"none",cursor:"pointer",fontSize:22}}>🗑️</button>
        </div>
      ))}
    </div>
  );
}

// ── P&L ───────────────────────────────────────────────────────────────────────
function PL({revenue,expenses}) {
  const totalRev=revenue.reduce((s,r)=>s+parseFloat(r.amount||0),0);
  const totalExp=expenses.reduce((s,e)=>s+parseFloat(e.amount||0),0);
  const profit=totalRev-totalExp;
  const margin=totalRev>0?((profit/totalRev)*100).toFixed(1):0;
  const monthlyData=MONTHS.map((m,mi)=>{
    const rev=revenue.filter(r=>r.date&&parseInt(r.date.split("-")[1])-1===mi).reduce((s,r)=>s+parseFloat(r.amount||0),0);
    const exp=expenses.filter(e=>e.date&&parseInt(e.date.split("-")[1])-1===mi).reduce((s,e)=>s+parseFloat(e.amount||0),0);
    return {month:m,rev,exp,profit:rev-exp};
  }).filter(d=>d.rev>0||d.exp>0);
  const maxVal=Math.max(...monthlyData.map(d=>Math.max(d.rev,d.exp)),1);
  const expByCat=EXPENSE_CATS.map(c=>({cat:c,total:expenses.filter(e=>e.cat===c).reduce((s,e)=>s+parseFloat(e.amount||0),0)})).filter(x=>x.total>0).sort((a,b)=>b.total-a.total);
  return (
    <div style={{maxWidth:900}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:24}}>
        {[{l:"Gross Revenue",v:fmt$(totalRev),c:T.green,icon:"💵"},{l:"Total Expenses",v:fmt$(totalExp),c:T.red,icon:"💸"},{l:"Net Profit",v:fmt$(profit),c:profit>=0?T.green:T.red,icon:"📊"},{l:"Profit Margin",v:`${margin}%`,c:parseFloat(margin)>=30?T.green:parseFloat(margin)>=0?T.orange:T.red,icon:"📈"}].map(s=>(
          <div key={s.l} style={{background:T.surface,border:`1px solid ${s.c}30`,borderRadius:12,padding:"16px",textAlign:"center"}}>
            <div style={{fontSize:29,marginBottom:6}}>{s.icon}</div>
            <div style={{fontSize:27,fontWeight:"bold",color:s.c}}>{s.v}</div>
            <div style={{fontSize:17,color:T.textDim,letterSpacing:1.5,marginTop:4}}>{s.l.toUpperCase()}</div>
          </div>
        ))}
      </div>
      {monthlyData.length>0&&(
        <Card style={{marginBottom:16}}>
          <SecTitle>📊 Monthly Revenue vs Expenses</SecTitle>
          <div style={{display:"flex",alignItems:"flex-end",gap:8,height:160,padding:"0 8px"}}>
            {monthlyData.map(d=>(
              <div key={d.month} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                <div style={{width:"100%",display:"flex",gap:2,alignItems:"flex-end",height:130}}>
                  <div style={{flex:1,background:T.green,borderRadius:"3px 3px 0 0",height:`${(d.rev/maxVal)*120+4}px`,minHeight:4}}/>
                  <div style={{flex:1,background:T.red,borderRadius:"3px 3px 0 0",height:`${(d.exp/maxVal)*120+4}px`,minHeight:4,opacity:0.8}}/>
                </div>
                <div style={{fontSize:17,color:T.textDim}}>{d.month}</div>
                <div style={{fontSize:17,color:d.profit>=0?T.green:T.red}}>{d.profit>=0?"+":""}{fmt$(d.profit)}</div>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:16,marginTop:8,justifyContent:"center"}}>
            <div style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:10,height:10,background:T.green,borderRadius:2}}/><span style={{fontSize:17,color:T.textDim}}>Revenue</span></div>
            <div style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:10,height:10,background:T.red,borderRadius:2,opacity:0.8}}/><span style={{fontSize:17,color:T.textDim}}>Expenses</span></div>
          </div>
        </Card>
      )}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <Card accent={`rgba(248,113,113,0.2)`}>
          <SecTitle>💸 Expense Breakdown</SecTitle>
          {expByCat.map(({cat,total})=>(
            <div key={cat} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
              <div style={{fontSize:19,color:T.textDim,width:90,flexShrink:0}}>{cat}</div>
              <div style={{flex:1,height:5,background:"rgba(255,255,255,0.06)",borderRadius:3}}><div style={{width:`${(total/totalExp)*100}%`,height:"100%",background:T.red,borderRadius:3,opacity:0.8}}/></div>
              <div style={{fontSize:19,color:T.red,width:70,textAlign:"right"}}>{fmt$(total)}</div>
            </div>
          ))}
          {expByCat.length===0&&<div style={{color:T.textDim,fontSize:20}}>No expenses logged.</div>}
        </Card>
        <Card accent={`rgba(74,222,128,0.2)`}>
          <SecTitle>📋 P&L Summary</SecTitle>
          {[["Gross Revenue",fmt$(totalRev),T.green],[" − Total Expenses",fmt$(totalExp),T.red],["= Net Profit",fmt$(profit),profit>=0?T.green:T.red],["Profit Margin",`${margin}%`,parseFloat(margin)>=30?T.green:T.orange]].map(([l,v,c])=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${T.borderDim}`}}>
              <div style={{fontSize:20,color:T.textDim}}>{l}</div>
              <div style={{fontSize:20,fontWeight:"bold",color:c}}>{v}</div>
            </div>
          ))}
          <div style={{marginTop:12,padding:10,background:profit>=0?"rgba(74,222,128,0.08)":"rgba(248,113,113,0.08)",borderRadius:8,border:`1px solid ${profit>=0?T.green:T.red}30`}}>
            <div style={{fontSize:18,color:profit>=0?T.green:T.red,letterSpacing:1}}>{profit>=0?"✅ PROFITABLE":"⚠️ WATCH SPEND"}</div>
            <div style={{fontSize:19,color:T.textDim,marginTop:4}}>{profit>=0?`Keeping ${margin}% of every dollar.`:`Expenses exceed revenue by ${fmt$(Math.abs(profit))}.`}</div>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── CAMPAIGNS ─────────────────────────────────────────────────────────────────
function Campaigns({campaigns,setCampaigns,showToast}) {
  const [form,setForm]=useState({name:"",collection:"Sunrise",type:"Product Launch",start:today(),end:"",status:"Planned",notes:""});
  const [filter,setFilter]=useState("All");
  const TYPES=["Product Launch","Restock","Sale","Collab","Email Drop","Social Push","Other"];
  const STATUSES=["Planned","Active","Complete","Paused"];
  const SC={Planned:T.blue,Active:T.green,Complete:T.textDim,Paused:T.orange};
  const add=()=>{
    if(!form.name.trim()) return showToast("Name required","error");
    setCampaigns(p=>[{id:uid(),...form},...p]);
    setForm(f=>({name:"",collection:f.collection,type:f.type,start:today(),end:"",status:"Planned",notes:""}));
    showToast("Campaign added ✓");
  };
  const del=id=>{setCampaigns(p=>p.filter(c=>c.id!==id));showToast("Deleted");};
  const upStatus=(id,status)=>setCampaigns(p=>p.map(c=>c.id===id?{...c,status}:c));
  const filtered=filter==="All"?campaigns:campaigns.filter(c=>c.status===filter);
  return (
    <div style={{maxWidth:800}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:20}}>
        {STATUSES.map(s=><div key={s} style={{background:T.surface,border:`1px solid ${SC[s]}30`,borderRadius:10,padding:"12px",textAlign:"center"}}><div style={{fontSize:25,fontWeight:"bold",color:SC[s]}}>{campaigns.filter(c=>c.status===s).length}</div><div style={{fontSize:17,color:T.textDim,letterSpacing:1.5}}>{s.toUpperCase()}</div></div>)}
      </div>
      <Card>
        <SecTitle>+ New Campaign</SecTitle>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Inp label="Campaign Name" value={form.name} onChange={v=>setForm(p=>({...p,name:v}))} placeholder="Spring Sunrise Drop"/>
          <Sel label="Collection" value={form.collection} onChange={v=>setForm(p=>({...p,collection:v}))} options={COLLECTIONS}/>
          <Sel label="Type" value={form.type} onChange={v=>setForm(p=>({...p,type:v}))} options={TYPES}/>
          <Sel label="Status" value={form.status} onChange={v=>setForm(p=>({...p,status:v}))} options={STATUSES}/>
          <Inp label="Start Date" value={form.start} onChange={v=>setForm(p=>({...p,start:v}))} type="date"/>
          <Inp label="End Date" value={form.end} onChange={v=>setForm(p=>({...p,end:v}))} type="date"/>
        </div>
        <Inp label="Notes" value={form.notes} onChange={v=>setForm(p=>({...p,notes:v}))} placeholder="Goals, channels, details…" multi rows={2}/>
        <Btn onClick={add} style={{width:"100%"}}>+ Add Campaign</Btn>
      </Card>
      <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
        {["All",...STATUSES].map(s=><button key={s} onClick={()=>setFilter(s)} style={{padding:"8px 16px",borderRadius:20,border:`1px solid ${filter===s?T.gold:"rgba(245,166,35,0.2)"}`,background:filter===s?T.goldDim:"transparent",color:filter===s?T.gold:T.textDim,fontSize:18,cursor:"pointer"}}>{s}</button>)}
      </div>
      {filtered.map(c=>(
        <Card key={c.id} accent={`${SC[c.status]}30`}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
            <div><div style={{fontSize:22,fontWeight:"bold",color:T.text,marginBottom:6}}>{c.name}</div><div style={{display:"flex",gap:6,flexWrap:"wrap"}}><Tag color={T.purple}>{c.collection}</Tag><Tag color={T.blue}>{c.type}</Tag><Tag color={SC[c.status]}>{c.status}</Tag></div></div>
            <button onClick={()=>del(c.id)} style={{background:"none",border:"none",cursor:"pointer",fontSize:22,color:T.textDim}}>🗑️</button>
          </div>
          <div style={{display:"flex",gap:12,marginBottom:8,fontSize:19,color:T.textDim}}>
            {c.start&&<span>📅 {c.start}</span>}{c.end&&<span>🏁 {c.end}</span>}
          </div>
          {c.notes&&<div style={{fontSize:19,color:T.textDim,fontStyle:"italic",marginBottom:10}}>{c.notes}</div>}
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {STATUSES.filter(s=>s!==c.status).map(s=><button key={s} onClick={()=>upStatus(c.id,s)} style={{fontSize:17,padding:"3px 8px",borderRadius:4,border:`1px solid ${SC[s]}50`,background:`${SC[s]}10`,color:SC[s],cursor:"pointer"}}>→ {s}</button>)}
          </div>
        </Card>
      ))}
    </div>
  );
}

// ── TASKS ─────────────────────────────────────────────────────────────────────
function Tasks({tasks,setTasks,showToast}) {
  const [form,setForm]=useState({title:"",priority:"🔴 High",due:"",notes:""});
  const [filter,setFilter]=useState("All");
  const [showDone,setShowDone]=useState(false);
  const add=()=>{
    if(!form.title.trim()) return showToast("Required","error");
    setTasks(p=>[{id:uid(),...form,done:false},...p]);
    setForm(f=>({title:"",priority:f.priority,due:"",notes:""}));
    showToast("Added ✓");
  };
  const toggle=id=>setTasks(p=>p.map(t=>t.id===id?{...t,done:!t.done}:t));
  const del=id=>{setTasks(p=>p.filter(t=>t.id!==id));showToast("Deleted");};
  const filtered=tasks.filter(t=>(showDone?true:!t.done)&&(filter==="All"||t.priority===filter));
  return (
    <div style={{maxWidth:750}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:20}}>
        {[{l:"Open",v:tasks.filter(t=>!t.done).length,c:T.gold},{l:"Done",v:tasks.filter(t=>t.done).length,c:T.green},{l:"Overdue",v:tasks.filter(t=>!t.done&&t.due&&t.due<today()).length,c:T.red}].map(s=>(
          <div key={s.l} style={{background:T.surface,border:`1px solid ${s.c}30`,borderRadius:10,padding:"12px",textAlign:"center"}}>
            <div style={{fontSize:27,fontWeight:"bold",color:s.c}}>{s.v}</div>
            <div style={{fontSize:17,color:T.textDim,letterSpacing:1.5}}>{s.l.toUpperCase()}</div>
          </div>
        ))}
      </div>
      <Card>
        <SecTitle>+ New Task</SecTitle>
        <Inp value={form.title} onChange={v=>setForm(p=>({...p,title:v}))} placeholder="What needs to get done…" label="Task"/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Sel label="Priority" value={form.priority} onChange={v=>setForm(p=>({...p,priority:v}))} options={PRIORITIES}/>
          <Inp label="Due Date" value={form.due} onChange={v=>setForm(p=>({...p,due:v}))} type="date"/>
        </div>
        <Inp value={form.notes} onChange={v=>setForm(p=>({...p,notes:v}))} placeholder="Notes…" label="Notes" multi rows={2}/>
        <Btn onClick={add} style={{width:"100%"}}>+ Add Task</Btn>
      </Card>
      <div style={{display:"flex",gap:8,marginBottom:14,alignItems:"center",flexWrap:"wrap"}}>
        {["All",...PRIORITIES].map(f=><button key={f} onClick={()=>setFilter(f)} style={{padding:"8px 16px",borderRadius:20,border:`1px solid ${filter===f?T.gold:"rgba(245,166,35,0.2)"}`,background:filter===f?T.goldDim:"transparent",color:filter===f?T.gold:T.textDim,fontSize:18,cursor:"pointer"}}>{f}</button>)}
        <button onClick={()=>setShowDone(o=>!o)} style={{marginLeft:"auto",padding:"8px 16px",borderRadius:20,border:`1px solid ${showDone?T.green:"rgba(74,222,128,0.2)"}`,background:showDone?"rgba(74,222,128,0.1)":"transparent",color:showDone?T.green:T.textDim,fontSize:18,cursor:"pointer"}}>{showDone?"Hide Done":"Show Done"}</button>
      </div>
      {filtered.map(t=>(
        <div key={t.id} style={{display:"flex",gap:12,alignItems:"flex-start",background:T.surface,border:`1px solid ${t.done?T.green+"30":t.due&&t.due<today()?T.red+"40":T.border}`,borderRadius:10,padding:"12px 14px",marginBottom:8,opacity:t.done?0.6:1}}>
          <button onClick={()=>toggle(t.id)} style={{background:t.done?"rgba(74,222,128,0.2)":"transparent",border:`2px solid ${t.done?T.green:T.textDim}`,borderRadius:6,width:24,height:24,cursor:"pointer",color:T.green,fontSize:22,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>{t.done?"✓":""}</button>
          <div style={{flex:1}}>
            <div style={{fontSize:20,color:t.done?T.textDim:T.text,textDecoration:t.done?"line-through":"none"}}>{t.title}</div>
            <div style={{display:"flex",gap:6,marginTop:4,flexWrap:"wrap"}}>
              <Tag color={t.priority==="🔴 High"?T.red:t.priority==="🟡 Medium"?T.gold:T.green}>{t.priority}</Tag>
              {t.due&&<span style={{fontSize:17,color:t.due<today()&&!t.done?T.red:T.textDim}}>📅 {t.due}</span>}
            </div>
            {t.notes&&<div style={{fontSize:19,color:T.textDim,marginTop:4,fontStyle:"italic"}}>{t.notes}</div>}
          </div>
          <button onClick={()=>del(t.id)} style={{background:"none",border:"none",cursor:"pointer",fontSize:22,color:T.textDim}}>🗑️</button>
        </div>
      ))}
    </div>
  );
}

// ── INVENTORY ─────────────────────────────────────────────────────────────────
function Inventory({inventory,setInventory,showToast}) {
  const [form,setForm]=useState({sku:"",name:"",size:"",qty:"",reorder:"10",price:"",collection:"Sunrise"});
  const [editing,setEditing]=useState(null);
  const [filter,setFilter]=useState("All");
  const cols=["All",...[...new Set(inventory.map(i=>i.collection))]];
  const lowStock=inventory.filter(i=>parseInt(i.qty)<=parseInt(i.reorder));
  const save=()=>{
    if(!form.name.trim()||!form.sku.trim()) return showToast("Name and SKU required","error");
    if(editing){setInventory(p=>p.map(i=>i.id===editing?{...i,...form}:i));showToast("Updated ✓");}
    else{setInventory(p=>[{id:uid(),...form},...p]);showToast("Added ✓");}
    setForm({sku:"",name:"",size:"",qty:"",reorder:"10",price:"",collection:"Sunrise"});
    setEditing(null);
  };
  const del=id=>{setInventory(p=>p.filter(i=>i.id!==id));showToast("Deleted");};
  const edit=i=>{setForm({sku:i.sku,name:i.name,size:i.size,qty:i.qty,reorder:i.reorder,price:i.price,collection:i.collection});setEditing(i.id);};
  const filtered=filter==="All"?inventory:inventory.filter(i=>i.collection===filter);
  const totalVal=inventory.reduce((s,i)=>s+(parseFloat(i.price||0)*parseInt(i.qty||0)),0);
  return (
    <div style={{maxWidth:900}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:20}}>
        {[{l:"Total SKUs",v:inventory.length,c:T.gold},{l:"Low Stock",v:lowStock.length,c:lowStock.length>0?T.red:T.green},{l:"Inventory Value",v:fmt$(totalVal),c:T.blue}].map(s=>(
          <div key={s.l} style={{background:T.surface,border:`1px solid ${s.c}30`,borderRadius:10,padding:"14px",textAlign:"center"}}>
            <div style={{fontSize:25,fontWeight:"bold",color:s.c}}>{s.v}</div>
            <div style={{fontSize:17,color:T.textDim,letterSpacing:1.5,marginTop:2}}>{s.l.toUpperCase()}</div>
          </div>
        ))}
      </div>
      {lowStock.length>0&&(
        <Card accent="rgba(251,146,60,0.3)" style={{marginBottom:16}}>
          <SecTitle>⚠️ Reorder Alerts</SecTitle>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {lowStock.map(i=><div key={i.id} style={{background:"rgba(248,113,113,0.1)",border:`1px solid ${T.red}40`,borderRadius:8,padding:"6px 12px"}}><div style={{fontSize:19,color:T.text}}>{i.name} {i.size}</div><div style={{fontSize:18,color:T.red}}>Only {i.qty} left (reorder at {i.reorder})</div></div>)}
          </div>
        </Card>
      )}
      <Card>
        <SecTitle>{editing?"✏️ Edit":"+ Add Item"}</SecTitle>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Inp label="SKU" value={form.sku} onChange={v=>setForm(p=>({...p,sku:v}))} placeholder="SS-SUN-SM"/>
          <Inp label="Product Name" value={form.name} onChange={v=>setForm(p=>({...p,name:v}))} placeholder="Sunrise Tee"/>
          <Inp label="Size" value={form.size} onChange={v=>setForm(p=>({...p,size:v}))} placeholder="S/M/L/XL"/>
          <Inp label="Collection" value={form.collection} onChange={v=>setForm(p=>({...p,collection:v}))} placeholder="Sunrise"/>
          <Inp label="Qty in Stock" value={form.qty} onChange={v=>setForm(p=>({...p,qty:v}))} type="number" placeholder="0"/>
          <Inp label="Reorder At" value={form.reorder} onChange={v=>setForm(p=>({...p,reorder:v}))} type="number" placeholder="10"/>
          <Inp label="Price ($)" value={form.price} onChange={v=>setForm(p=>({...p,price:v}))} type="number" placeholder="0.00"/>
        </div>
        <div style={{display:"flex",gap:8}}>
          <Btn onClick={save} style={{flex:1}}>{editing?"Update":"+ Add"}</Btn>
          {editing&&<Btn onClick={()=>{setEditing(null);setForm({sku:"",name:"",size:"",qty:"",reorder:"10",price:"",collection:"Sunrise"});}} variant="ghost">Cancel</Btn>}
        </div>
      </Card>
      <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
        {cols.map(c=><button key={c} onClick={()=>setFilter(c)} style={{padding:"8px 16px",borderRadius:20,border:`1px solid ${filter===c?T.gold:"rgba(245,166,35,0.2)"}`,background:filter===c?T.goldDim:"transparent",color:filter===c?T.gold:T.textDim,fontSize:18,cursor:"pointer"}}>{c}</button>)}
      </div>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:20}}>
          <thead><tr style={{borderBottom:`1px solid ${T.border}`}}>{["SKU","Product","Size","Collection","Stock","Reorder","Price","Value",""].map(h=><th key={h} style={{padding:"8px 10px",textAlign:"left",fontSize:17,color:T.textDim,letterSpacing:1.5,fontWeight:"normal"}}>{h}</th>)}</tr></thead>
          <tbody>{filtered.map(i=>{const low=parseInt(i.qty)<=parseInt(i.reorder);return(<tr key={i.id} style={{borderBottom:`1px solid ${T.borderDim}`}}><td style={{padding:"10px",color:T.textDim,fontSize:18,fontFamily:"monospace"}}>{i.sku}</td><td style={{padding:"10px",color:T.text,fontWeight:"bold"}}>{i.name}</td><td style={{padding:"10px",color:T.textDim}}>{i.size}</td><td style={{padding:"10px"}}><Tag color={T.blue}>{i.collection}</Tag></td><td style={{padding:"10px",color:low?T.red:T.green,fontWeight:"bold"}}>{i.qty}</td><td style={{padding:"10px",color:T.textDim}}>{i.reorder}</td><td style={{padding:"10px",color:T.gold}}>{fmt$(i.price)}</td><td style={{padding:"10px",color:T.textDim}}>{fmt$(parseFloat(i.price||0)*parseInt(i.qty||0))}</td><td style={{padding:"10px"}}><div style={{display:"flex",gap:6}}><button onClick={()=>edit(i)} style={{background:"none",border:"none",cursor:"pointer",fontSize:20}}>✏️</button><button onClick={()=>del(i.id)} style={{background:"none",border:"none",cursor:"pointer",fontSize:20}}>🗑️</button></div></td></tr>);})}</tbody>
        </table>
      </div>
    </div>
  );
}

// ── ORDERS ────────────────────────────────────────────────────────────────────

// ── EXPENSES ──────────────────────────────────────────────────────────────────
function Expenses({expenses,setExpenses,showToast}) {
  const [form,setForm]=useState({desc:"",amount:"",cat:"Other",date:today()});
  const [fCat,setFCat]=useState("All");
  const add=()=>{
    if(!form.desc.trim()||!form.amount) return showToast("Fill in all fields","error");
    setExpenses(p=>[{id:uid(),...form},...p]);
    setForm(f=>({desc:"",amount:"",cat:f.cat,date:f.date}));
    showToast("Logged ✓");
  };
  const del=id=>{setExpenses(p=>p.filter(e=>e.id!==id));showToast("Deleted");};
  const filtered=fCat==="All"?expenses:expenses.filter(e=>e.cat===fCat);
  const total=expenses.reduce((s,e)=>s+parseFloat(e.amount||0),0);
  const byCat=EXPENSE_CATS.map(c=>({cat:c,total:expenses.filter(e=>e.cat===c).reduce((s,e)=>s+parseFloat(e.amount||0),0)})).filter(x=>x.total>0).sort((a,b)=>b.total-a.total);
  return (
    <div style={{maxWidth:800}}>
      <Card style={{marginBottom:20}}>
        <div style={{fontSize:18,color:T.textDim,letterSpacing:1.5,marginBottom:4}}>TOTAL BUSINESS SPEND</div>
        <div style={{fontSize:41,fontWeight:"bold",color:T.gold}}>{fmt$(total)}</div>
        {byCat.length>0&&<div style={{marginTop:14}}>{byCat.map(({cat,total:t})=><div key={cat} style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}><div style={{fontSize:19,color:T.textDim,width:100,flexShrink:0}}>{cat}</div><div style={{flex:1,height:5,background:"rgba(255,255,255,0.06)",borderRadius:3}}><div style={{width:`${(t/total)*100}%`,height:"100%",background:T.gold,borderRadius:3}}/></div><div style={{fontSize:19,color:T.gold,width:70,textAlign:"right"}}>{fmt$(t)}</div></div>)}</div>}
      </Card>
      <Card>
        <SecTitle>Log Expense</SecTitle>
        <Inp value={form.desc} onChange={v=>setForm(p=>({...p,desc:v}))} placeholder="Description…" label="Description"/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Inp value={form.amount} onChange={v=>setForm(p=>({...p,amount:v}))} placeholder="0.00" type="number" label="Amount ($)"/>
          <Inp value={form.date} onChange={v=>setForm(p=>({...p,date:v}))} type="date" label="Date"/>
        </div>
        <Sel value={form.cat} onChange={v=>setForm(p=>({...p,cat:v}))} options={EXPENSE_CATS} label="Category"/>
        <Btn onClick={add} style={{width:"100%"}}>+ Log Expense</Btn>
      </Card>
      <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
        {["All",...EXPENSE_CATS.filter(c=>expenses.some(e=>e.cat===c))].map(c=><button key={c} onClick={()=>setFCat(c)} style={{padding:"8px 16px",borderRadius:20,border:`1px solid ${fCat===c?T.gold:"rgba(245,166,35,0.2)"}`,background:fCat===c?T.goldDim:"transparent",color:fCat===c?T.gold:T.textDim,fontSize:18,cursor:"pointer"}}>{c}</button>)}
      </div>
      {filtered.map(e=>(
        <div key={e.id} style={{display:"flex",alignItems:"center",gap:12,background:T.surface,border:`1px solid ${T.borderDim}`,borderRadius:10,padding:"10px 14px",marginBottom:8}}>
          <div style={{flex:1}}><div style={{fontSize:20,color:T.text}}>{e.desc}</div><div style={{display:"flex",gap:8,marginTop:3}}><Tag>{e.cat}</Tag><span style={{fontSize:17,color:T.textDim}}>{e.date}</span></div></div>
          <div style={{fontSize:21,fontWeight:"bold",color:T.red}}>{fmt$(e.amount)}</div>
          <button onClick={()=>del(e.id)} style={{background:"none",border:"none",cursor:"pointer",fontSize:22}}>🗑️</button>
        </div>
      ))}
    </div>
  );
}

// ── NOTES ─────────────────────────────────────────────────────────────────────
function Notes({notes,setNotes,showToast}) {
  const [view,setView]   = useState("list");
  const [editing,setEdit]= useState(null);
  const [fCat,setFCat]   = useState("All");
  const [search,setSearch]= useState("");
  const [form,setForm]   = useState({title:"",body:"",cat:"General",image:null,favorite:false});
  const [listening,setListening] = useState(false);
  const recogRef = useRef(null);
  const fileRef  = useRef(null);
  const camRef   = useRef(null);

  // ── Voice-to-text ──
  const startListen = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return showToast("Speech recognition not supported in this browser","error");
    const r = new SR();
    r.continuous = true;
    r.interimResults = false;
    r.lang = "en-US";
    r.onresult = e => {
      const transcript = Array.from(e.results).map(r=>r[0].transcript).join(" ");
      setForm(p=>({...p, body: p.body ? p.body+" "+transcript : transcript}));
    };
    r.onerror = () => { setListening(false); showToast("Mic error — check permissions","error"); };
    r.onend   = () => setListening(false);
    r.start();
    recogRef.current = r;
    setListening(true);
  };
  const stopListen = () => { try{recogRef.current?.stop();}catch{} setListening(false); };

  // ── Photo capture/upload ──
  const handlePhoto = (e, mode) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => setForm(p=>({...p, image: ev.target.result}));
    reader.readAsDataURL(f);
  };

  // ── Download photo ──
  const downloadPhoto = (dataUrl, title) => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = (title||"solshock-photo").replace(/\s+/g,"-")+".jpg";
    a.click();
  };

  const startNew  = () => { setForm({title:"",body:"",cat:"General",image:null,favorite:false}); setEdit("new"); setView("edit"); };
  const startEdit = n  => { setForm({title:n.title,body:n.body,cat:n.cat,image:n.image||null,favorite:!!n.favorite}); setEdit(n.id); setView("edit"); };
  const save = () => {
    if (!form.title.trim()) return showToast("Title required","error");
    if (editing==="new") setNotes(p=>[{id:uid(),...form,date:nowStr(),pinned:false},...p]);
    else setNotes(p=>p.map(n=>n.id===editing?{...n,...form}:n));
    stopListen();
    showToast("Saved ✓"); setView("list");
  };
  const del  = id => { setNotes(p=>p.filter(n=>n.id!==id)); showToast("Deleted"); };
  const pin  = id => setNotes(p=>p.map(n=>n.id===id?{...n,pinned:!n.pinned}:n));
  const fav  = id => setNotes(p=>p.map(n=>n.id===id?{...n,favorite:!n.favorite}:n));

  const filtered = notes.filter(n=>
    (fCat==="All"||(fCat==="⭐ Favorites"?n.favorite:n.cat===fCat)) &&
    (n.title.toLowerCase().includes(search.toLowerCase())||
     (n.body||"").toLowerCase().includes(search.toLowerCase()))
  );

  // ── EDIT VIEW ──
  if (view==="edit") return (
    <div style={{maxWidth:700}}>
      <div style={{display:"flex",gap:8,marginBottom:16,alignItems:"center",flexWrap:"wrap"}}>
        <Btn onClick={()=>{stopListen();setView("list");}} variant="ghost">← Back</Btn>
        <Btn onClick={save} style={{flex:1}}>💾 Save</Btn>
      </div>
      <Card>
        <Inp label="Title" value={form.title} onChange={v=>setForm(p=>({...p,title:v}))} placeholder="Note title…"/>
        <Sel label="Category" value={form.cat} onChange={v=>setForm(p=>({...p,cat:v}))} options={NOTE_CATS}/>

        {/* Body + Voice toolbar */}
        <div style={{marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <div style={{fontSize:19,color:T.textDim,letterSpacing:1,textTransform:"uppercase"}}>Content</div>
            <div style={{display:"flex",gap:8}}>
              {/* Voice-to-text */}
              <button onClick={listening?stopListen:startListen} style={{
                display:"flex",alignItems:"center",gap:5,padding:"9px 16px",borderRadius:16,
                border:`1.5px solid ${listening?T.red:T.gold}`,
                background:listening?"rgba(248,113,113,0.12)":T.goldDim,
                color:listening?T.red:T.gold, fontSize:19, cursor:"pointer",
              }}>
                {listening ? <><span style={{width:8,height:8,background:T.red,borderRadius:"50%",animation:"tickPulse 1s infinite",display:"inline-block"}}/>Stop</> : <>🎤 Dictate</>}
              </button>
              {/* Camera */}
              <button onClick={()=>camRef.current?.click()} style={{padding:"9px 16px",borderRadius:16,border:`1.5px solid ${T.blue}`,background:"rgba(59,130,246,0.1)",color:T.blue,fontSize:19,cursor:"pointer"}}>
                📷 Camera
              </button>
              {/* Upload */}
              <button onClick={()=>fileRef.current?.click()} style={{padding:"9px 16px",borderRadius:16,border:`1.5px solid ${T.teal}`,background:"rgba(45,212,191,0.1)",color:T.teal,fontSize:19,cursor:"pointer"}}>
                ⬆️ Upload
              </button>
              <input ref={camRef}  type="file" accept="image/*" capture="camera"    style={{display:"none"}} onChange={e=>handlePhoto(e,"camera")}/>
              <input ref={fileRef} type="file" accept="image/*"                     style={{display:"none"}} onChange={e=>handlePhoto(e,"upload")}/>
            </div>
          </div>
          {listening && (
            <div style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",background:"rgba(248,113,113,0.06)",border:`1px solid ${T.red}40`,borderRadius:8,marginBottom:8,fontSize:19,color:T.red}}>
              <span style={{width:8,height:8,background:T.red,borderRadius:"50%",animation:"tickPulse 0.8s infinite",display:"inline-block"}}/>
              Listening… speak now. Words appear in the note automatically.
            </div>
          )}
          <textarea
            value={form.body}
            onChange={e=>setForm(p=>({...p,body:e.target.value}))}
            placeholder="Write, dictate, or snap a photo…"
            rows={10}
            style={{...fld(),width:"100%",resize:"vertical",fontFamily:"Georgia,serif",lineHeight:2.2,boxSizing:"border-box"}}
          />
        </div>

        {/* Photo preview */}
        {form.image && (
          <div style={{position:"relative",marginTop:8}}>
            <img src={form.image} alt="note" style={{width:"100%",maxHeight:320,objectFit:"cover",borderRadius:10,border:`1px solid ${T.border}`}}/>
            <div style={{display:"flex",gap:8,marginTop:8}}>
              <button onClick={()=>downloadPhoto(form.image,form.title)} style={{flex:1,padding:"8px",borderRadius:8,border:`1px solid ${T.green}50`,background:"rgba(74,222,128,0.08)",color:T.green,fontSize:19,cursor:"pointer"}}>
                ⬇️ Download Photo
              </button>
              <button onClick={()=>setForm(p=>({...p,image:null}))} style={{padding:"8px 14px",borderRadius:8,border:`1px solid ${T.red}50`,background:"rgba(248,113,113,0.08)",color:T.red,fontSize:19,cursor:"pointer"}}>
                ✕ Remove
              </button>
            </div>
          </div>
        )}

        {/* Favorite toggle */}
        <div style={{display:"flex",alignItems:"center",gap:8,marginTop:14,padding:"8px 12px",background:form.favorite?"rgba(245,166,35,0.06)":"transparent",border:`1px solid ${form.favorite?T.gold:T.border}`,borderRadius:8,cursor:"pointer"}} onClick={()=>setForm(p=>({...p,favorite:!p.favorite}))}>
          <span style={{fontSize:23}}>{form.favorite?"⭐":"☆"}</span>
          <span style={{fontSize:20,color:form.favorite?T.gold:T.textDim}}>{form.favorite?"Saved to Favorites":"Add to Favorites"}</span>
        </div>
      </Card>
    </div>
  );

  // ── LIST VIEW ──
  return (
    <div>
      <div style={{display:"flex",gap:10,marginBottom:16,alignItems:"center"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search notes…" style={{...fld(),flex:1}}/>
        <Btn onClick={startNew}>+ New</Btn>
      </div>
      <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>
        {["All","⭐ Favorites",...NOTE_CATS].map(c=>(
          <button key={c} onClick={()=>setFCat(c)} style={{padding:"8px 16px",borderRadius:20,border:`1px solid ${fCat===c?T.gold:"rgba(245,166,35,0.2)"}`,background:fCat===c?T.goldDim:"transparent",color:fCat===c?T.gold:T.textDim,fontSize:18,cursor:"pointer"}}>
            {c}
          </button>
        ))}
      </div>
      {filtered.length===0 && <div style={{textAlign:"center",color:T.textDim,fontSize:20,padding:40}}>No notes yet. Hit + New to start.</div>}
      {filtered.map(n=>(
        <Card key={n.id} accent={n.pinned?`${T.gold}40`:undefined} style={{marginBottom:12}}>
          {/* Photo thumbnail */}
          {n.image && (
            <div style={{position:"relative",marginBottom:10}}>
              <img src={n.image} alt="note" style={{width:"100%",maxHeight:200,objectFit:"cover",borderRadius:8,border:`1px solid ${T.border}`}}/>
              <button onClick={()=>downloadPhoto(n.image,n.title)} style={{position:"absolute",bottom:8,right:8,padding:"5px 10px",borderRadius:8,border:"none",background:"rgba(0,0,0,0.6)",color:"#fff",fontSize:19,cursor:"pointer",backdropFilter:"blur(4px)"}}>
                ⬇️
              </button>
            </div>
          )}
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              <Tag>{n.cat}</Tag>
              {n.pinned&&<Tag color={T.blue}>Pinned</Tag>}
              {n.favorite&&<Tag color={T.gold}>⭐</Tag>}
            </div>
            <div style={{display:"flex",gap:4}}>
              <button onClick={()=>fav(n.id)}  title="Favorite" style={{background:"none",border:"none",cursor:"pointer",fontSize:21}}>{n.favorite?"⭐":"☆"}</button>
              <button onClick={()=>pin(n.id)}  title="Pin"      style={{background:"none",border:"none",cursor:"pointer",fontSize:22}}>{n.pinned?"📌":"📍"}</button>
              <button onClick={()=>startEdit(n)} style={{background:"none",border:"none",cursor:"pointer",fontSize:22}}>✏️</button>
              <button onClick={()=>del(n.id)}  style={{background:"none",border:"none",cursor:"pointer",fontSize:22}}>🗑️</button>
            </div>
          </div>
          <div style={{fontSize:22,fontWeight:"bold",color:T.text,marginBottom:5}}>{n.title}</div>
          <div style={{fontSize:20,color:T.textDim,lineHeight:2.2}}>{(n.body||"").slice(0,200)}{(n.body||"").length>200?"…":""}</div>
          <div style={{fontSize:17,color:T.textMuted,marginTop:8}}>{n.date}</div>
        </Card>
      ))}
    </div>
  );
}

// ── VOICE MEMOS ───────────────────────────────────────────────────────────────
function VoiceMemos({memos,setMemos,showToast}) {
  const [recording,setRecording]=useState(false);
  const [elapsed,setElapsed]=useState(0);
  const [label,setLabel]=useState("");
  const recRef=useRef(null);
  const chunksRef=useRef([]);
  const timerRef=useRef(null);
  const startRec=async()=>{
    try {
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      const rec=new MediaRecorder(stream);
      chunksRef.current=[];
      rec.ondataavailable=e=>{if(e.data.size>0)chunksRef.current.push(e.data);};
      rec.onstop=()=>{
        const blob=new Blob(chunksRef.current,{type:"audio/webm"});
        const url=URL.createObjectURL(blob);
        setMemos(p=>[{id:uid(),url,label:label||"Voice Memo",date:nowStr(),duration:elapsed},...p]);
        showToast("Saved ✓");stream.getTracks().forEach(t=>t.stop());setElapsed(0);setLabel("");
      };
      rec.start();recRef.current=rec;setRecording(true);
      timerRef.current=setInterval(()=>setElapsed(e=>e+1),1000);
    } catch{showToast("Microphone access denied","error");}
  };
  const stopRec=()=>{if(recRef.current)recRef.current.stop();clearInterval(timerRef.current);setRecording(false);};
  const del=id=>{const m=memos.find(m=>m.id===id);if(m)URL.revokeObjectURL(m.url);setMemos(p=>p.filter(m=>m.id!==id));showToast("Deleted");};
  return (
    <div style={{maxWidth:700}}>
      <Card style={{textAlign:"center",padding:28,marginBottom:20}}>
        {recording&&<div style={{marginBottom:16}}><div style={{width:14,height:14,background:T.red,borderRadius:"50%",margin:"0 auto 10px",animation:"tickPulse 1s infinite"}}/><div style={{fontSize:48,fontWeight:"bold",color:T.red,fontFamily:"monospace"}}>{fmtS(elapsed)}</div></div>}
        {!recording&&<div style={{marginBottom:16}}><div style={{fontSize:58,marginBottom:12}}>🎤</div><Inp value={label} onChange={setLabel} placeholder="Label this memo…" style={{textAlign:"center"}}/></div>}
        <button onClick={recording?stopRec:startRec} style={{background:recording?"rgba(248,113,113,0.15)":T.goldDim,border:`2px solid ${recording?T.red:T.gold}`,color:recording?T.red:T.gold,borderRadius:"50%",width:76,height:76,fontSize:35,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto"}}>{recording?"⏹":"⏺"}</button>
        <div style={{fontSize:17,color:T.textDim,marginTop:10,letterSpacing:1.5}}>{recording?"TAP TO STOP":"TAP TO RECORD"}</div>
      </Card>
      {memos.map(m=>(
        <Card key={m.id}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
            <div><div style={{fontSize:20,fontWeight:"bold",color:T.text}}>{m.label}</div><div style={{fontSize:17,color:T.textDim,marginTop:2}}>{m.date} · {fmtS(m.duration)}</div></div>
            <button onClick={()=>del(m.id)} style={{background:"none",border:"none",cursor:"pointer",fontSize:21}}>🗑️</button>
          </div>
          <audio controls src={m.url} style={{width:"100%",height:36}}/>
        </Card>
      ))}
    </div>
  );
}

// ── RECEIPTS ──────────────────────────────────────────────────────────────────
function Receipts({receipts,setReceipts,setExpenses,showToast}) {
  const [camOpen,setCamOpen]=useState(false);
  const [streamObj,setStream]=useState(null);
  const [scanning,setScanning]=useState(null); // receipt id being scanned
  const [preview,setPreview]=useState(null);   // {url, base64} pending confirmation
  const [parsed,setParsed]=useState(null);     // AI-extracted data
  const videoRef=useRef(null);
  const canvasRef=useRef(null);
  const fileRef=useRef(null);

  const openCam=async()=>{
    try{const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}});setStream(s);setCamOpen(true);setTimeout(()=>{if(videoRef.current)videoRef.current.srcObject=s;},100);}
    catch{showToast("Camera denied — use upload","error");}
  };
  const closeCam=()=>{if(streamObj)streamObj.getTracks().forEach(t=>t.stop());setStream(null);setCamOpen(false);};

  const processImage=async(url,base64,filename)=>{
    // Save receipt image first
    const id=uid();
    setReceipts(p=>[{id,url,label:filename||"Receipt",date:nowStr()},...p]);
    showToast("Receipt saved — reading with AI…");
    setScanning(id);
    try {
      const res=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:300,
          messages:[{
            role:"user",
            content:[
              {type:"image",source:{type:"base64",media_type:"image/jpeg",data:base64}},
              {type:"text",text:`Extract expense data from this receipt. Respond ONLY with valid JSON, no markdown, no explanation:
{"vendor":"store name","amount":"total amount as number string","category":"one of: Inventory,Printing,Shipping,Marketing,Software,Office,Samples,Other","date":"YYYY-MM-DD format or today if unclear","description":"short one-line description"}`}
            ]
          }]
        })
      });
      const data=await res.json();
      const text=data.content?.[0]?.text||"{}";
      const clean=text.replace(/```json|```/g,"").trim();
      const result=JSON.parse(clean);
      setParsed({...result,receiptId:id});
      showToast("Receipt read ✓ — review and confirm");
    } catch(err) {
      console.error("Receipt scan error:",err);
      showToast("Couldn't read receipt — add expense manually","error");
    }
    setScanning(null);
  };

  const snap=()=>{
    const v=videoRef.current,c=canvasRef.current;
    if(!v||!c) return;
    c.width=v.videoWidth;c.height=v.videoHeight;
    c.getContext("2d").drawImage(v,0,0);
    const url=c.toDataURL("image/jpeg",0.85);
    const base64=url.split(",")[1];
    closeCam();
    processImage(url,base64,"Receipt");
  };

  const upload=e=>{
    const f=e.target.files[0];if(!f) return;
    const r=new FileReader();
    r.onload=ev=>{
      const url=ev.target.result;
      const base64=url.split(",")[1];
      processImage(url,base64,f.name.replace(/\.[^.]+$/,""));
    };
    r.readAsDataURL(f);e.target.value="";
  };

  const confirmExpense=()=>{
    if(!parsed) return;
    setExpenses(p=>[{id:uid(),desc:parsed.description||parsed.vendor||"Receipt expense",amount:parsed.amount||"0",cat:parsed.category||"Other",date:parsed.date||today()},...p]);
    setParsed(null);
    showToast("Expense logged from receipt ✓");
  };

  const del=id=>{setReceipts(p=>p.filter(r=>r.id!==id));showToast("Deleted");};

  return (
    <div style={{maxWidth:700}}>
      <canvas ref={canvasRef} style={{display:"none"}}/>

      {/* AI Parsed Result — confirm banner */}
      {parsed && (
        <Card accent={T.green} style={{marginBottom:20,border:`1px solid ${T.green}50`}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
            <div style={{fontSize:29}}>🧾</div>
            <div>
              <div style={{fontSize:21,color:T.green,fontWeight:"bold"}}>Receipt Read by AI</div>
              <div style={{fontSize:19,color:T.textDim}}>Review and confirm to log to Expenses</div>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
            <div style={{background:"rgba(74,222,128,0.06)",borderRadius:8,padding:"10px 12px",border:`1px solid ${T.green}20`}}>
              <div style={{fontSize:17,color:T.textDim,letterSpacing:1.5,marginBottom:4}}>VENDOR</div>
              <div style={{fontSize:21,color:T.text,fontWeight:"bold"}}>{parsed.vendor||"—"}</div>
            </div>
            <div style={{background:"rgba(74,222,128,0.06)",borderRadius:8,padding:"10px 12px",border:`1px solid ${T.green}20`}}>
              <div style={{fontSize:17,color:T.textDim,letterSpacing:1.5,marginBottom:4}}>AMOUNT</div>
              <div style={{fontSize:23,color:T.green,fontWeight:"bold"}}>${parsed.amount||"0.00"}</div>
            </div>
            <div style={{background:"rgba(74,222,128,0.06)",borderRadius:8,padding:"10px 12px",border:`1px solid ${T.green}20`}}>
              <div style={{fontSize:17,color:T.textDim,letterSpacing:1.5,marginBottom:4}}>CATEGORY</div>
              <div style={{fontSize:21,color:T.gold}}>{parsed.category||"Other"}</div>
            </div>
            <div style={{background:"rgba(74,222,128,0.06)",borderRadius:8,padding:"10px 12px",border:`1px solid ${T.green}20`}}>
              <div style={{fontSize:17,color:T.textDim,letterSpacing:1.5,marginBottom:4}}>DATE</div>
              <div style={{fontSize:21,color:T.text}}>{parsed.date||today()}</div>
            </div>
          </div>
          <div style={{fontSize:19,color:T.textDim,marginBottom:14,padding:"8px 12px",background:"rgba(255,255,255,0.03)",borderRadius:6}}>{parsed.description||"—"}</div>
          <div style={{display:"flex",gap:10}}>
            <Btn onClick={confirmExpense} style={{flex:1}}>✓ Log to Expenses</Btn>
            <Btn onClick={()=>setParsed(null)} variant="ghost" style={{flex:1}}>Dismiss</Btn>
          </div>
        </Card>
      )}

      {/* Camera or Upload */}
      {camOpen
        ? <Card style={{marginBottom:20}}>
            <video ref={videoRef} autoPlay playsInline style={{width:"100%",borderRadius:8,background:"#000",display:"block"}}/>
            <div style={{display:"flex",gap:10,marginTop:12}}>
              <Btn onClick={snap} style={{flex:1}}>📸 Capture & Read</Btn>
              <Btn onClick={closeCam} variant="ghost">Cancel</Btn>
            </div>
          </Card>
        : <Card style={{textAlign:"center",padding:28,marginBottom:20}}>
            <div style={{fontSize:48,marginBottom:8}}>📷</div>
            <div style={{fontSize:20,color:T.textDim,marginBottom:16}}>Snap or upload a receipt — Summer reads it and fills in your expense automatically</div>
            <div style={{display:"flex",gap:10,justifyContent:"center"}}>
              <Btn onClick={openCam}>📷 Camera</Btn>
              <Btn onClick={()=>fileRef.current.click()} variant="secondary">📂 Upload</Btn>
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={upload} style={{display:"none"}}/>
          </Card>
      }

      {receipts.length===0 && !parsed && (
        <div style={{textAlign:"center",color:T.textDim,fontSize:20,padding:40}}>No receipts yet.</div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:12}}>
        {receipts.map(r=>(
          <div key={r.id} style={{background:T.surface,border:`1px solid ${scanning===r.id?T.gold:T.border}`,borderRadius:12,overflow:"hidden",position:"relative"}}>
            {scanning===r.id && (
              <div style={{position:"absolute",inset:0,background:"rgba(10,22,40,0.85)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",zIndex:2,borderRadius:12}}>
                <div style={{fontSize:29,marginBottom:8}}>🤖</div>
                <div style={{fontSize:19,color:T.gold}}>Reading receipt…</div>
              </div>
            )}
            <img src={r.url} alt={r.label} style={{width:"100%",aspectRatio:"4/3",objectFit:"cover",display:"block"}}/>
            <div style={{padding:"8px 10px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div><div style={{fontSize:19,fontWeight:"bold",color:T.text}}>{r.label}</div><div style={{fontSize:17,color:T.textDim,marginTop:2}}>{r.date}</div></div>
              <button onClick={()=>del(r.id)} style={{background:"none",border:"none",cursor:"pointer",fontSize:22}}>🗑️</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── BRAND ASSETS ──────────────────────────────────────────────────────────────
function BrandAssets() {
  const vocab=["bold coastal lifestyle","born at the beach","the coast is home","from sunrise to sunset","coastal energy","bold graphics","top of the line","coastal apparel","we love it here","designed for the coast","the lifestyle","coastal people","fun and bold","expressive","rooted in the coast","Sunrise Collection","Sunset Collection","Night Mode","Big Sun Energy","Always Coastal","UV Collection"];
  const kill=["thin","boutique","cheap","discount","rugged","tough","heavy-duty","premium","GSM","fabric weight","didn't make the heat worse","when the humidity won't quit","surviving the coast"];
  const palette=[{n:"Dark Navy",h:"#0a1628"},{n:"Navy Mid",h:"#0f1f3d"},{n:"Gold",h:"#f5a623"},{n:"Electric Blue",h:"#3b82f6"},{n:"Flame Orange",h:"#FF4500"},{n:"Warm Text",h:"#e8d5a3"}];
  return (
    <div style={{maxWidth:800}}>
      <div style={{display:"flex",justifyContent:"center",marginBottom:28}}><div style={{textAlign:"center"}}><SunLogo size={120}/><div style={{fontSize:17,color:T.gold,marginTop:8,letterSpacing:2}}>PRIMARY MARK</div></div></div>
      <Card style={{marginBottom:16}}><SecTitle>🎨 Brand Palette</SecTitle><div style={{display:"flex",gap:10,flexWrap:"wrap"}}>{palette.map(p=><div key={p.h} style={{textAlign:"center"}}><div style={{width:52,height:52,borderRadius:10,background:p.h,border:"1px solid rgba(255,255,255,0.1)",marginBottom:6}}/><div style={{fontSize:17,color:T.textDim}}>{p.n}</div><div style={{fontSize:17,color:T.textMuted,fontFamily:"monospace"}}>{p.h}</div></div>)}</div></Card>
      <Card style={{marginBottom:16,border:"1px solid rgba(74,222,128,0.2)"}}><SecTitle>✅ Golden Vocabulary</SecTitle><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{vocab.map(v=><Tag key={v} color={T.green}>{v}</Tag>)}</div></Card>
      <Card style={{border:"1px solid rgba(248,113,113,0.2)"}}><SecTitle>🚫 Kill List</SecTitle><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{kill.map(v=><span key={v} style={{fontSize:17,background:"rgba(248,113,113,0.08)",border:"1px solid rgba(248,113,113,0.2)",color:T.red,borderRadius:4,padding:"2px 7px",textDecoration:"line-through",letterSpacing:0.5}}>{v}</span>)}</div></Card>
    </div>
  );
}

// ── SETTINGS ──────────────────────────────────────────────────────────────────
const VOICE_OPTIONS = [
  {name:"en-US-Journey-F",    label:"Journey F  ⭐ Most Natural",  desc:"Google's most human-sounding voice. Warm, conversational."},
  {name:"en-US-Journey-O",    label:"Journey O",                   desc:"Slightly different Journey female tone."},
  {name:"en-US-Neural2-F",    label:"Neural2 F",                   desc:"Clear and professional American female."},
  {name:"en-US-Neural2-C",    label:"Neural2 C",                   desc:"Softer Neural2 female variant."},
  {name:"en-US-Neural2-E",    label:"Neural2 E",                   desc:"Brighter Neural2 female variant."},
  {name:"en-US-Wavenet-F",    label:"Wavenet F",                   desc:"Classic Google female voice."},
  {name:"en-US-Wavenet-H",    label:"Wavenet H",                   desc:"Softer Wavenet female variant."},
  {name:"en-US-Studio-O",     label:"Studio O  🎙️ Premium",        desc:"Studio-quality, very natural. Same free tier applies."},
];

function Settings({settings,setSettings,showToast,tasks,inventory,orders,expenses,revenue}) {
  const [form,setForm]=useState({...settings});
  const [openAiKey,setOpenAiKey]=useState(ttsKeyStore.key||"");
  const [anthropicKey,setAnthropicKey]=useState(apiKeyStore.key||"");
  const [selectedVoice,setSelectedVoice]=useState(ttsKeyStore.voice||"en-US-Journey-F");
  const [keyVisible,setKeyVisible]=useState(false);
  const [anthropicVisible,setAnthropicVisible]=useState(false);
  const [testing,setTesting]=useState(false);

  const save=async()=>{
    setSettings(form);
    const trimKey = openAiKey.trim();
    const trimAnthropicKey = anthropicKey.trim();
    ttsKeyStore.key = trimKey;
    ttsKeyStore.voice = selectedVoice;
    apiKeyStore.key = trimAnthropicKey;
    try { localStorage.setItem("ss_tts_key", trimKey); } catch {}
    try { localStorage.setItem("ss_tts_voice", selectedVoice); } catch {}
    try { localStorage.setItem("ss_anthropic_key", trimAnthropicKey); } catch {}
    showToast("Saved ✓");
  };

  useEffect(()=>{
    (async()=>{
      try {
        const k = localStorage.getItem("ss_tts_key")||""; setOpenAiKey(k); ttsKeyStore.key=k;
        const v = localStorage.getItem("ss_tts_voice")||"en-US-Journey-F"; setSelectedVoice(v); ttsKeyStore.voice=v;
        const ak = localStorage.getItem("ss_anthropic_key")||""; setAnthropicKey(ak); apiKeyStore.key=ak;
      } catch {}
    })();
  },[]);

  const testVoice = () => {
    try { window.speechSynthesis.cancel(); } catch {}
    const VOICE_PRIORITY = [
      "Samantha","Serena","Karen","Moira","Tessa",
      "Aria","Jenny","Ana",
      "Google US English","Google UK English Female",
      "Microsoft Zira","Microsoft Eva",
    ];
    const voices = window.speechSynthesis.getVoices();
    let voice = null;
    for (const name of VOICE_PRIORITY) {
      const v = voices.find(v => v.name.includes(name) && v.lang.startsWith("en"));
      if (v) { voice = v; break; }
    }
    if (!voice) voice = voices.find(v=>v.lang.startsWith("en-US")) || voices.find(v=>v.lang.startsWith("en"));
    const utt = new SpeechSynthesisUtterance(
      "Hey! I'm Summer, your SOLSHOCK business partner. Big Sun Energy. Always coastal."
    );
    if (voice) utt.voice = voice;
    utt.rate = 0.88; utt.pitch = 1.1; utt.volume = 1;
    utt.onstart = () => setTesting(true);
    utt.onend   = () => setTesting(false);
    utt.onerror = () => setTesting(false);
    setTesting(true);
    window.speechSynthesis.speak(utt);
  };

  const clearAll=async()=>{
    if(!window.confirm("Clear ALL Hub data? Cannot be undone.")) return;
    try {
      for(const k of ["ss_notes","ss_expenses","ss_receipts","ss_memos","ss_tasks","ss_inventory","ss_orders","ss_campaigns","ss_revenue","ss_settings","ss_contacts","ss_drops","ss_posts","ss_goals"])
        await store.del(k);
      showToast("Cleared — refresh to reset","error");
    } catch{showToast("Error","error");}
  };
  const totalRev=revenue.reduce((s,r)=>s+parseFloat(r.amount||0),0);
  const totalExp=expenses.reduce((s,e)=>s+parseFloat(e.amount||0),0);
  const daysSince=Math.floor((Date.now()-new Date("2026-03-02"))/86400000);
  return (
    <div style={{maxWidth:560}}>
      <Card>
        <SecTitle>🏪 Store Info</SecTitle>
        <Inp label="Store Name" value={form.storeName} onChange={v=>setForm(p=>({...p,storeName:v}))} placeholder="SOLSHOCK"/>
        <Inp label="Owner Name" value={form.ownerName} onChange={v=>setForm(p=>({...p,ownerName:v}))} placeholder="Your name"/>
        <Inp label="Launch Date" value={form.launched} onChange={v=>setForm(p=>({...p,launched:v}))} placeholder="Mar 2, 2026"/>
        <Inp label="Revenue Goal ($)" value={form.revenueGoal} onChange={v=>setForm(p=>({...p,revenueGoal:v}))} type="number" placeholder="10000"/>
        <Inp label="Shopify Store URL" value={form.shopifyStore||""} onChange={v=>setForm(p=>({...p,shopifyStore:v}))} placeholder="yourstore.myshopify.com"/>
        <Btn onClick={save} style={{width:"100%",marginTop:4}}>Save Settings</Btn>
      </Card>

      {/* ── ANTHROPIC API KEY ── */}
      <Card accent={`${T.blue}40`} style={{border:`1px solid ${anthropicKey?T.blue+"50":T.border}`}}>
        <SecTitle>🤖 Anthropic API Key</SecTitle>
        <div style={{padding:"10px 14px",background:"rgba(59,130,246,0.06)",borderRadius:8,border:`1px solid ${T.border}`,marginBottom:16,fontSize:18,color:T.textDim,lineHeight:1.9}}>
          Required to use <span style={{color:T.gold}}>Summer AI Chat</span>, <span style={{color:T.gold}}>Daily Briefing</span>, <span style={{color:T.gold}}>Copy AI</span>, <span style={{color:T.gold}}>Email Writer</span>, and <span style={{color:T.gold}}>Reports</span> on your live site.
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:12}}>
          <input value={anthropicKey} onChange={e=>{setAnthropicKey(e.target.value);apiKeyStore.key=e.target.value.trim();}}
            placeholder="sk-ant-..." type={anthropicVisible?"text":"password"}
            style={{...fld(),flex:1,fontFamily:"monospace",fontSize:16}}/>
          <button onClick={()=>setAnthropicVisible(o=>!o)} style={{background:"none",border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 12px",color:T.textDim,cursor:"pointer",fontSize:16,flexShrink:0}}>
            {anthropicVisible?"🙈":"👁"}
          </button>
        </div>
        <div style={{fontSize:16,color:T.textDim,lineHeight:1.9,marginBottom:14}}>
          <div style={{color:T.gold,fontWeight:"bold",marginBottom:4}}>Get your key:</div>
          <div>1. Go to <span style={{color:T.blue}}>console.anthropic.com</span></div>
          <div>2. Settings → API Keys → Create Key</div>
          <div>3. Paste above → Save 🌊</div>
        </div>
        {anthropicKey && <div style={{padding:"8px 12px",background:"rgba(74,222,128,0.08)",border:`1px solid ${T.green}30`,borderRadius:8,fontSize:16,color:T.green,marginBottom:12}}>✓ API key set — all AI features active</div>}
        <Btn onClick={save} style={{width:"100%"}}>💾 Save API Key</Btn>
      </Card>

      {/* ── VOICE SETTINGS ── */}
      <Card accent={`${T.gold}40`} glow={openAiKey?T.gold:undefined} style={{border:`1px solid ${openAiKey?T.gold+"50":T.border}`}}>
        <SecTitle>🔊 Summer's Voice</SecTitle>

        {/* Status bar */}
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:"rgba(245,166,35,0.06)",borderRadius:8,border:`1px solid ${T.border}`,marginBottom:16}}>
          <SummerAvatar size={28}/>
          <div style={{flex:1}}>
            <div style={{fontSize:20,color:T.gold,fontWeight:"bold"}}>{openAiKey ? VOICE_OPTIONS.find(v=>v.name===selectedVoice)?.label||selectedVoice : "Browser TTS (robot voice)"}</div>
            <div style={{fontSize:18,color:T.textDim}}>{openAiKey?"Google Cloud TTS — sounds like a real person":"Paste your API key below to unlock Summer's real voice"}</div>
          </div>
          <Tag color={openAiKey?T.green:T.orange}>{openAiKey?"ACTIVE":"NOT SET"}</Tag>
        </div>

        {/* API Key */}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:19,color:T.textDim,letterSpacing:1.5,marginBottom:6,textTransform:"uppercase"}}>Google Cloud API Key</div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <input value={openAiKey} onChange={e=>{setOpenAiKey(e.target.value);ttsKeyStore.key=e.target.value.trim();}}
              placeholder="AIza..." type={keyVisible?"text":"password"}
              style={{...fld(),flex:1,fontFamily:"monospace",fontSize:20}}/>
            <button onClick={()=>setKeyVisible(o=>!o)} style={{background:"none",border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 12px",color:T.textDim,cursor:"pointer",fontSize:20,flexShrink:0}}>
              {keyVisible?"🙈":"👁"}
            </button>
          </div>
        </div>

        {/* Voice Picker */}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:19,color:T.textDim,letterSpacing:1.5,marginBottom:8,textTransform:"uppercase"}}>Choose Summer's Voice</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {VOICE_OPTIONS.map(v=>(
              <div key={v.name} onClick={()=>{setSelectedVoice(v.name);ttsKeyStore.voice=v.name;}}
                style={{
                  display:"flex",alignItems:"center",gap:10,padding:"10px 12px",
                  background:selectedVoice===v.name?T.goldDim:"rgba(10,22,40,0.5)",
                  border:`1px solid ${selectedVoice===v.name?T.gold:T.border}`,
                  borderRadius:8,cursor:"pointer",transition:"all 0.12s",
                }}>
                <div style={{width:16,height:16,borderRadius:"50%",border:`2px solid ${selectedVoice===v.name?T.gold:T.textDim}`,background:selectedVoice===v.name?T.gold:"transparent",flexShrink:0}}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:20,color:selectedVoice===v.name?T.gold:T.text,fontWeight:selectedVoice===v.name?"bold":"normal"}}>{v.label}</div>
                  <div style={{fontSize:18,color:T.textDim}}>{v.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Test + Save */}
        <div style={{display:"flex",gap:8}}>
          <Btn onClick={testVoice} disabled={testing||!openAiKey.trim()} variant="secondary" style={{flex:1}}>
            {testing?"🔊 Playing…":"▶ Test This Voice"}
          </Btn>
          <Btn onClick={save} style={{flex:1}}>💾 Save</Btn>
        </div>

        {!openAiKey && (
          <div style={{marginTop:12,fontSize:18,color:T.textDim,lineHeight:2.2}}>
            <div style={{marginBottom:4,color:T.gold,fontWeight:"bold"}}>No key? Get one free:</div>
            <div>1. <span style={{color:T.blue}}>console.cloud.google.com</span></div>
            <div>2. New Project → Enable <span style={{color:T.gold}}>Cloud Text-to-Speech API</span></div>
            <div>3. APIs & Services → Credentials → Create API Key</div>
            <div>4. Paste above → Test → Save 🌊</div>
          </div>
        )}
      </Card>

      <Card>
        <SecTitle>📊 Hub Stats</SecTitle>
        <div style={{fontSize:20,color:T.textDim,lineHeight:2.2}}>
          <div>Days live: <span style={{color:T.gold}}>{daysSince}</span></div>
          <div>Open tasks: <span style={{color:T.gold}}>{tasks.filter(t=>!t.done).length}</span></div>
          <div>Inventory SKUs: <span style={{color:T.gold}}>{inventory.length}</span></div>
          <div>Active orders: <span style={{color:T.gold}}>{orders.filter(o=>o.stage!=="Done").length}</span></div>
          <div>Total revenue: <span style={{color:T.green}}>{fmt$(totalRev)}</span></div>
          <div>Total expenses: <span style={{color:T.red}}>{fmt$(totalExp)}</span></div>
          <div>Net profit: <span style={{color:totalRev-totalExp>=0?T.green:T.red}}>{fmt$(totalRev-totalExp)}</span></div>
        </div>
      </Card>
      <Card style={{border:"1px solid rgba(248,113,113,0.2)"}}>
        <SecTitle>⚠️ Danger Zone</SecTitle>
        <div style={{fontSize:20,color:T.textDim,marginBottom:14,lineHeight:1.9}}>Permanently deletes all Hub data. Cannot be undone.</div>
        <Btn onClick={clearAll} variant="danger">🗑️ Clear All Hub Data</Btn>
      </Card>
      <Card>
        <SecTitle>ℹ️ Phase 6 — Feature List</SecTitle>
        <div style={{fontSize:19,color:T.textDim,lineHeight:2.2}}>
          {[["🤖",T.gold,"Summer AI Chat"],["📰",T.blue,"Daily Briefing (Live Web Search)"],["🎯",T.green,"Goal Tracker"],["⏱️",T.blue,"Drop Countdown Timers"],["📓",T.purple,"Black Book CRM"],["📸",T.orange,"Content Planner"],["📧",T.teal,"Email Writer"],["📋",T.gold,"Report Generator"],["🛍️",T.green,"Shopify Intelligence"],["💵",T.green,"Revenue Tracker"],["📈",T.gold,"P&L Dashboard"],["📅",T.blue,"Campaigns"],["✅",T.gold,"Tasks"],["📦",T.orange,"Inventory"],["🗂️",T.blue,"Orders (Kanban)"],["💰",T.red,"Expenses"],["📝",T.textDim,"Notes"],["🎤",T.gold,"Voice Memos"],["📷",T.blue,"Receipts"],["🌊",T.teal,"Brand Assets"],["🔊",T.gold,"Nova TTS Voice (OpenAI)"]].map(([icon,color,label])=>(
            <div key={label} style={{color}}>{icon} {label}</div>
          ))}
        </div>
      </Card>
    </div>
  );
}
