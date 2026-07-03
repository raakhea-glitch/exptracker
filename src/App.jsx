import React, { useState, useEffect, useMemo, useRef } from "react";

// ─── Gondola config ────────────────────────────────────────────────────────
const GONDOLAS = {
  A: { label:"Gondola A", color:"#818CF8", dim:"rgba(129,140,248,.13)", border:"rgba(129,140,248,.32)" },
  B: { label:"Gondola B", color:"#38BDF8", dim:"rgba(56,189,248,.13)",  border:"rgba(56,189,248,.32)"  },
  C: { label:"Gondola C", color:"#34D399", dim:"rgba(52,211,153,.13)", border:"rgba(52,211,153,.32)"  },
  D: { label:"Gondola D", color:"#FBBF24", dim:"rgba(251,191,36,.13)", border:"rgba(251,191,36,.32)"  },
};
const SECTIONS = {
  A: ["A1","A2","A3","A4","A5","A6"],
  B: ["B1","B2","B3","B4","B5","B6"],
  C: ["C1","C2","C3","C4","C5","C6"],
  D: ["D1","D2","D3","D4","D5","D6"],
};

// ─── Business logic ────────────────────────────────────────────────────────
function getDays(expDate) {
  const t = new Date(); t.setHours(0,0,0,0);
  const e = new Date(expDate); e.setHours(0,0,0,0);
  return Math.ceil((e - t) / 86400000);
}
function getMd(days, isImport) {
  if (days < 0) return { pct:0, tier:null };
  if (isImport) return days <= 30 ? { pct:70, tier:"md70", noRetur:true } : { pct:0, tier:null };
  if (days <= 30) return { pct:70, tier:"md70", noRetur:true };
  if (days <= 60) return { pct:50, tier:"md50", noRetur:false };
  if (days <= 90) return { pct:30, tier:"md30", noRetur:false };
  return { pct:0, tier:null };
}
function getUrgency(days) {
  if (days < 0)   return { level:5, tag:"Expired",  color:"#64748B" };
  if (days <= 3)   return { level:4, tag:"Kritis",   color:"#FB7185" };
  if (days <= 7)   return { level:3, tag:"Tarik",    color:"#FB923C" };
  if (days <= 30)  return { level:2, tag:"Markdown", color:"#FBBF24" };
  if (days <= 90)  return { level:1, tag:"Pantau",   color:"#60A5FA" };
  return                { level:0, tag:"Aman",     color:"#34D399" };
}
function enrich(item) {
  const days     = getDays(item.expDate);
  const md       = getMd(days, item.isImport);
  const urg      = getUrgency(days);
  const qty      = parseInt(item.qty) || 0;
  const orig     = parseFloat(item.price) || 0;
  const effRetur = md.noRetur ? false : item.canReturn;

  // Auto-upgrade: tier naik dari saat diceklis → perlu update harga lagi
  const needsUpgrade = !!(item.markedDown && md.pct > 0
    && item.lastMdPct != null && md.pct > item.lastMdPct);

  let phase = "normal";
  if (days < 0)                                       phase = effRetur ? "return" : "expired";
  else if (days <= 7)                                 phase = "pull";
  else if (item.markedDown && qty===0 && !needsUpgrade) phase = "sold_out";
  else if (item.markedDown && !needsUpgrade)          phase = "done_md";
  else if (md.pct > 0 && effRetur)                    phase = "return";
  else if (md.pct > 0)                                phase = "pending_md";
  return { ...item, days, md, urg, phase, qty, orig, effRetur, skipMd: effRetur && md.pct > 0, needsUpgrade,
    disc: orig>0 ? orig*(1-md.pct/100) : 0 };
}

// ─── Storage ────────────────────────────────────────────────────────────────
const SK = "expt_v8";
const OLD_KEYS = ["expt_v7","expt_v6","expt_v5","expt_v4"];
const load = () => {
  try {
    const cur = localStorage.getItem(SK);
    if (cur) return JSON.parse(cur);
    // Migrasi otomatis dari key versi lama jika ada
    for (const k of OLD_KEYS) {
      const old = localStorage.getItem(k);
      if (old) {
        const parsed = JSON.parse(old);
        localStorage.setItem(SK, old); // simpan ke key baru
        return parsed;
      }
    }
    return [];
  } catch { return []; }
};
const persist = d  => { try { localStorage.setItem(SK, JSON.stringify(d)); } catch {} };

// ─── Utils ────────────────────────────────────────────────────────────────────
const fmtRp = n => "Rp "+Number(n).toLocaleString("id-ID");
const fmtD  = d => new Date(d).toLocaleDateString("id-ID",{day:"numeric",month:"short"});
const todayStr = () => new Date().toLocaleDateString("id-ID",{weekday:"long",day:"numeric",month:"long"});

// ─── Design tokens ───────────────────────────────────────────────────────────
const DARK = {
  bg:"#080B12", bgSoft:"#0B0F18", card:"#11161F", cardHi:"#141A25",
  line:"rgba(255,255,255,.06)", lineHi:"rgba(255,255,255,.1)",
  text:"#E7EAF0", sub:"#8993A8", faint:"#4A536A",
  accent:"#818CF8", accentDim:"rgba(129,140,248,.14)", accentBorder:"rgba(129,140,248,.32)",
  purple:"#C084FC", purpleDim:"rgba(192,132,252,.14)", purpleBorder:"rgba(192,132,252,.32)",
  green:"#34D399",  greenDim:"rgba(52,211,153,.14)",   greenBorder:"rgba(52,211,153,.32)",
  amber:"#FBBF24",  amberDim:"rgba(251,191,36,.14)",   amberBorder:"rgba(251,191,36,.32)",
  orange:"#FB923C", orangeDim:"rgba(251,146,60,.14)",  orangeBorder:"rgba(251,146,60,.32)",
  rose:"#FB7185",   roseDim:"rgba(251,113,133,.14)",   roseBorder:"rgba(251,113,133,.32)",
  blue:"#60A5FA",   blueDim:"rgba(96,165,250,.14)",    blueBorder:"rgba(96,165,250,.32)",
  slate:"#64748B",  slateDim:"rgba(100,116,139,.12)",  slateBorder:"rgba(100,116,139,.25)",
};
const LIGHT = {
  bg:"#F1F5F9", bgSoft:"#E8EDF4", card:"#FFFFFF", cardHi:"#F8FAFC",
  line:"rgba(0,0,0,.08)", lineHi:"rgba(0,0,0,.14)",
  text:"#0F172A", sub:"#475569", faint:"#94A3B8",
  accent:"#4F46E5", accentDim:"rgba(79,70,229,.1)", accentBorder:"rgba(79,70,229,.3)",
  purple:"#7C3AED", purpleDim:"rgba(124,58,237,.1)", purpleBorder:"rgba(124,58,237,.3)",
  green:"#059669",  greenDim:"rgba(5,150,105,.1)",   greenBorder:"rgba(5,150,105,.3)",
  amber:"#D97706",  amberDim:"rgba(217,119,6,.1)",   amberBorder:"rgba(217,119,6,.3)",
  orange:"#EA580C", orangeDim:"rgba(234,88,12,.1)",  orangeBorder:"rgba(234,88,12,.3)",
  rose:"#E11D48",   roseDim:"rgba(225,29,72,.1)",    roseBorder:"rgba(225,29,72,.3)",
  blue:"#2563EB",   blueDim:"rgba(37,99,235,.1)",    blueBorder:"rgba(37,99,235,.3)",
  slate:"#64748B",  slateDim:"rgba(100,116,139,.1)", slateBorder:"rgba(100,116,139,.25)",
};

// C is set at runtime based on theme (default dark)
let C = DARK;
const setTheme = (isDark) => { C = isDark ? DARK : LIGHT; };
const getMDC = () => ({
  md30:{ t:C.amber,  d:C.amberDim,  b:C.amberBorder },
  md50:{ t:C.orange, d:C.orangeDim, b:C.orangeBorder },
  md70:{ t:C.rose,   d:C.roseDim,   b:C.roseBorder },
});

// ─── Icons (thin, consistent stroke) ─────────────────────────────────────────
const Ic = {
  plus:   <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  search: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16" y2="16"/></svg>,
  trash:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16Z"/></svg>,
  edit:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>,
  check:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
  alert:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg>,
  tag:    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8Z"/><circle cx="7" cy="7" r="1"/></svg>,
  ret:    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="1 4 1 10 7 10"/><path d="M3.5 15a9 9 0 1 0 .5-3.5"/></svg>,
  chart:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  pin:    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 10c0 6-9 12-9 12S3 16 3 10a9 9 0 0 1 18 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>,
  map:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>,
  close:  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  home:   <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/></svg>,
  globe:  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z"/></svg>,
  camera: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2Z"/><circle cx="12" cy="13" r="4"/></svg>,
  chevR:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>,
  bag:    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18M16 10a4 4 0 0 1-8 0"/></svg>,
};

// ─── Micro components ─────────────────────────────────────────────────────────
function Pill({ ch, color, dim, bdr, solid }) {
  return (
    <span style={{
      background: solid ? color : dim, color: solid ? "#08090D" : color,
      border: solid ? "none" : `1px solid ${bdr}`,
      borderRadius:20, padding:"3px 9px", fontSize:10.5, fontWeight:700,
      display:"inline-flex", alignItems:"center", gap:4, whiteSpace:"nowrap", flexShrink:0,
      letterSpacing:".1px",
    }}>{ch}</span>
  );
}

function LocBadge({ gondola, section }) {
  if (!gondola) return null;
  const g = GONDOLAS[gondola];
  return (
    <span style={{ background:g.dim,color:g.color,border:`1px solid ${g.border}`,borderRadius:7,padding:"3px 8px",fontSize:10.5,fontWeight:700,display:"inline-flex",alignItems:"center",gap:4,flexShrink:0 }}>
      {Ic.pin}{section||gondola}
    </span>
  );
}

function Toggle({ on, onChange, disabled, color=C.purple }) {
  return (
    <div onClick={()=>!disabled&&onChange(!on)} style={{ width:40,height:23,borderRadius:12,position:"relative",cursor:disabled?"default":"pointer",background:on?color:"rgba(255,255,255,.1)",transition:"background .2s",opacity:disabled?.4:1,flexShrink:0 }}>
      <div style={{ width:17,height:17,borderRadius:9,background:"#fff",position:"absolute",top:3,left:on?20:3,transition:"left .2s",boxShadow:"0 1px 3px rgba(0,0,0,.4)" }}/>
    </div>
  );
}

function QtyPicker({ qty, onChange, accent=C.accent }) {
  const q = parseInt(qty)||0;
  const btn = (label,fn) => (
    <button onClick={fn} style={{ width:30,height:30,borderRadius:9,background:C.cardHi,border:`1px solid ${C.line}`,color:C.text,fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:400,lineHeight:1 }}>{label}</button>
  );
  return (
    <div style={{ display:"flex",alignItems:"center",gap:7 }}>
      {btn("–",()=>onChange(Math.max(0,q-1)))}
      <div style={{ minWidth:28,textAlign:"center",fontSize:15,fontWeight:800,color:q===0?C.rose:C.text,fontVariantNumeric:"tabular-nums" }}>{q}</div>
      {btn("+",()=>onChange(q+1))}
    </div>
  );
}

// ─── Signature element: Ring countdown ────────────────────────────────────────
// A radial progress ring around the day-count, evoking a shelf-life gauge.
// Ring fills based on urgency window (90 days = full circle of "life" remaining).
function DayRing({ days, color, size=58 }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const pct = days < 0 ? 0 : Math.min(1, Math.max(0, days / 90));
  const offset = circ * (1 - pct);
  const isExpired = days < 0;

  return (
    <div style={{ position:"relative", width:size, height:size, flexShrink:0 }}>
      <svg width={size} height={size} style={{ transform:"rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="3.5"/>
        {!isExpired && (
          <circle
            cx={size/2} cy={size/2} r={r} fill="none"
            stroke={color} strokeWidth="3.5" strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={offset}
            style={{ transition:"stroke-dashoffset .4s ease" }}
          />
        )}
      </svg>
      <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
        <div style={{ fontSize: isExpired ? 11 : (days>99?15:19), fontWeight:800, color, lineHeight:1, fontVariantNumeric:"tabular-nums" }}>
          {isExpired ? "Exp" : days}
        </div>
        {!isExpired && <div style={{ fontSize:8, color:C.faint, fontWeight:600, marginTop:1 }}>hari</div>}
      </div>
    </div>
  );
}

// ─── Barcode Scanner ───────────────────────────────────────────────────────────
function BarcodeScanner({ onResult, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => { startCamera(); return () => stopCamera(); }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode:"environment", width:{ideal:1280}, height:{ideal:720} }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setScanning(true);
        scanFrame();
      }
    } catch(e) {
      setError("Tidak bisa akses kamera. Izinkan akses kamera di browser.");
    }
  };
  const stopCamera = () => { if (streamRef.current) streamRef.current.getTracks().forEach(t=>t.stop()); };

  const scanFrame = () => {
    if (!videoRef.current) return;
    if ("BarcodeDetector" in window) {
      const detector = new window.BarcodeDetector({ formats:["ean_13","ean_8","code_128","code_39","qr_code","upc_a","upc_e"] });
      const detect = async () => {
        if (!videoRef.current || videoRef.current.readyState !== 4) { requestAnimationFrame(detect); return; }
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length > 0) { stopCamera(); onResult(codes[0].rawValue); return; }
        } catch(e) {}
        requestAnimationFrame(detect);
      };
      videoRef.current.addEventListener("playing", detect);
    } else {
      setError("Browser tidak mendukung scan otomatis. Ketik manual atau gunakan Chrome di Android.");
    }
  };

  return (
    <div style={{ position:"fixed",inset:0,zIndex:500,background:"#000",display:"flex",flexDirection:"column" }}>
      <div style={{ padding:"16px",display:"flex",alignItems:"center",justifyContent:"space-between",background:"rgba(8,9,13,.7)",backdropFilter:"blur(8px)" }}>
        <span style={{ fontWeight:700,fontSize:15,color:"#fff",display:"flex",alignItems:"center",gap:8 }}>{Ic.camera} Pindai Barcode</span>
        <button onClick={()=>{stopCamera();onClose();}} style={{ background:"rgba(255,255,255,.12)",border:"none",color:"#fff",width:32,height:32,borderRadius:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>{Ic.close}</button>
      </div>

      <div style={{ flex:1,position:"relative",overflow:"hidden" }}>
        <video ref={videoRef} style={{ width:"100%",height:"100%",objectFit:"cover" }} playsInline muted/>
        {scanning && !error && (
          <div style={{ position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center" }}>
            <div style={{ position:"absolute",inset:0,background:"rgba(0,0,0,.45)" }}/>
            <div style={{ position:"relative",width:"74%",maxWidth:300,aspectRatio:"3/2",zIndex:10,boxShadow:"0 0 0 2000px rgba(0,0,0,.45)",borderRadius:14 }}>
              {[0,1,2,3].map(i=>(
                <div key={i} style={{ position:"absolute",width:22,height:22,
                  top:i<2?-2:undefined, bottom:i>=2?-2:undefined,
                  left:i%2===0?-2:undefined, right:i%2===1?-2:undefined,
                  borderTop:i<2?`3px solid ${C.accent}`:undefined,
                  borderBottom:i>=2?`3px solid ${C.accent}`:undefined,
                  borderLeft:i%2===0?`3px solid ${C.accent}`:undefined,
                  borderRight:i%2===1?`3px solid ${C.accent}`:undefined,
                  borderRadius:6,
                }}/>
              ))}
              <div style={{ position:"absolute",left:0,right:0,height:2,background:C.accent,boxShadow:`0 0 10px ${C.accent}`,animation:"scanline 1.6s ease-in-out infinite" }}/>
            </div>
          </div>
        )}
        {error && (
          <div style={{ position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:14,padding:28,textAlign:"center" }}>
            <div style={{ width:48,height:48,borderRadius:24,background:C.roseDim,display:"flex",alignItems:"center",justifyContent:"center" }}>{Ic.alert}</div>
            <div style={{ color:C.rose,fontWeight:600,fontSize:13.5,lineHeight:1.5 }}>{error}</div>
            <button onClick={()=>{stopCamera();onClose();}} style={{ background:C.accent,border:"none",color:"#08090D",padding:"10px 22px",borderRadius:10,fontWeight:700,cursor:"pointer",fontSize:13 }}>Ketik Manual</button>
          </div>
        )}
      </div>

      {scanning && !error && (
        <div style={{ padding:"16px",textAlign:"center",background:"rgba(8,9,13,.7)",backdropFilter:"blur(8px)" }}>
          <div style={{ color:C.sub,fontSize:12.5 }}>Arahkan kamera ke barcode produk</div>
        </div>
      )}
      <style>{`@keyframes scanline{0%{top:0%}50%{top:calc(100% - 2px)}100%{top:0%}}`}</style>
    </div>
  );
}

// ─── Gondola Picker (in form) ───────────────────────────────────────────────────
function GondolaPicker({ gondola, section, onChange }) {
  return (
    <div>
      <div style={{ fontSize:10.5,color:C.sub,fontWeight:600,marginBottom:8,letterSpacing:".3px" }}>LOKASI GONDOLA</div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:8 }}>
        {Object.entries(GONDOLAS).map(([key,g])=>(
          <div key={key} onClick={()=>onChange(key, SECTIONS[key][0])} style={{ padding:"9px 4px",borderRadius:10,border:`1.5px solid ${gondola===key?g.color:C.line}`,background:gondola===key?g.dim:"transparent",cursor:"pointer",textAlign:"center",transition:"all .15s" }}>
            <div style={{ fontSize:13,fontWeight:800,color:gondola===key?g.color:C.sub }}>{key}</div>
          </div>
        ))}
      </div>
      {gondola && (
        <div>
          <div style={{ fontSize:10,color:C.faint,marginBottom:6 }}>Sub-bagian {gondola}</div>
          <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
            {SECTIONS[gondola].map(s=>{
              const g = GONDOLAS[gondola];
              return (
                <div key={s} onClick={()=>onChange(gondola,s)} style={{ padding:"6px 13px",borderRadius:8,border:`1px solid ${section===s?g.color:C.line}`,background:section===s?g.dim:"transparent",cursor:"pointer",fontSize:12,fontWeight:600,color:section===s?g.color:C.sub }}>
                  {s}
                </div>
              );
            })}
            <div onClick={()=>onChange(gondola,null)} style={{ padding:"6px 13px",borderRadius:8,border:`1px solid ${!section?C.lineHi:C.line}`,cursor:"pointer",fontSize:12,color:C.faint }}>
              Semua {gondola}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Gondola Map View ────────────────────────────────────────────────────────
function GondolaMapView({ items, onFilter }) {
  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ fontWeight:700,fontSize:12.5,color:C.sub,marginBottom:11,display:"flex",alignItems:"center",gap:7,letterSpacing:".2px" }}>{Ic.map} Peta Gondola</div>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
        {Object.entries(GONDOLAS).map(([gKey,g])=>{
          const gItems = items.filter(i=>i.gondola===gKey);
          const urgent = gItems.filter(i=>i.urg.level>=2);
          const sections = SECTIONS[gKey];
          return (
            <div key={gKey} style={{ background:C.card,border:`1px solid ${C.line}`,borderRadius:14,overflow:"hidden" }}>
              <div style={{ padding:"10px 12px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:`1px solid ${C.line}` }}>
                <span style={{ fontWeight:700,fontSize:12.5,color:g.color }}>{g.label}</span>
                <div style={{ display:"flex",gap:5,alignItems:"center" }}>
                  {urgent.length>0 && <Pill ch={urgent.length} color={C.rose} dim={C.roseDim} bdr={C.roseBorder}/>}
                  <span style={{ fontSize:10,color:C.faint,fontWeight:600 }}>{gItems.length}</span>
                </div>
              </div>
              <div style={{ padding:"7px 9px",display:"flex",flexDirection:"column",gap:3 }}>
                {sections.map(sec=>{
                  const sItems = gItems.filter(i=>i.section===sec);
                  const sUrgent = sItems.filter(i=>i.urg.level>=2);
                  const hasKritis = sItems.some(i=>i.urg.level>=3);
                  if (!sItems.length) return (
                    <div key={sec} style={{ display:"flex",justifyContent:"space-between",padding:"5px 8px" }}>
                      <span style={{ fontSize:11,color:C.faint,opacity:.4 }}>{sec}</span>
                      <span style={{ fontSize:10,color:C.faint,opacity:.3 }}>—</span>
                    </div>
                  );
                  return (
                    <div key={sec} onClick={()=>onFilter(gKey,sec)} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 8px",borderRadius:8,background:hasKritis?C.roseDim:sUrgent.length?C.amberDim:"transparent",cursor:"pointer" }}>
                      <span style={{ fontSize:11.5,fontWeight:700,color:hasKritis?C.rose:sUrgent.length?C.amber:g.color }}>{sec}</span>
                      <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                        <span style={{ fontSize:10.5,color:C.faint }}>{sItems.length}</span>
                        <span style={{ color:C.faint }}>{Ic.chevR}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


// ─── Quick Widget — ringkasan di atas tab "Hari Ini" ──────────────────────────
function QuickWidget({ items, onNavigate }) {
  const now = new Date().toLocaleDateString("id-ID",{weekday:"short",day:"numeric",month:"short"});

  // Statistik kritis
  const kritis   = items.filter(i=>i.urg.level>=3 && i.days>=0);
  const mdReady  = items.filter(i=>i.phase==="pending_md");
  const pullReady= items.filter(i=>i.phase==="pull");
  const retReady = items.filter(i=>i.phase==="return" && i.days>=0);

  // Gondola paling urgent
  const gondolaScore = Object.keys(GONDOLAS).map(k=>({
    k,
    g: GONDOLAS[k],
    score: items.filter(i=>i.gondola===k&&i.urg.level>=2).length,
    pull:  items.filter(i=>i.gondola===k&&i.phase==="pull").length,
    md:    items.filter(i=>i.gondola===k&&i.phase==="pending_md").length,
  })).filter(g=>g.score>0).sort((a,b)=>b.score-a.score);

  const allSafe = kritis.length===0 && mdReady.length===0;

  return (
    <div style={{ background:C.card, border:`1px solid ${C.line}`, borderRadius:18, overflow:"hidden", marginBottom:14, boxShadow:`0 4px 24px rgba(0,0,0,.12)` }}>
      {/* Top bar — tanggal + status */}
      <div style={{ padding:"13px 15px 10px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <div style={{ fontSize:11, color:C.faint, fontWeight:600, letterSpacing:".3px" }}>{now.toUpperCase()}</div>
          <div style={{ fontSize:16, fontWeight:800, color:C.text, marginTop:2 }}>
            {allSafe ? "Semua gondola aman ✅" : "Perlu tindakan hari ini"}
          </div>
        </div>
        {!allSafe && (
          <div style={{ textAlign:"center", background:C.roseDim, border:`1px solid ${C.roseBorder}`, borderRadius:12, padding:"6px 12px" }}>
            <div style={{ fontSize:22, fontWeight:900, color:C.rose, lineHeight:1, fontVariantNumeric:"tabular-nums" }}>
              {kritis.length + mdReady.length}
            </div>
            <div style={{ fontSize:9, color:C.rose, fontWeight:600, marginTop:2 }}>BUTUH AKSI</div>
          </div>
        )}
      </div>

      {/* Stats row */}
      {!allSafe && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:1, background:C.line, margin:"0 0 0 0" }}>
          {[
            { l:"Kritis",  v:kritis.length,    c:C.rose,   bg:C.roseDim,   phase:"all",        urg:4 },
            { l:"Tarik",   v:pullReady.length, c:C.orange, bg:C.orangeDim, phase:"pull",       urg:null },
            { l:"Markdown",v:mdReady.length,   c:C.amber,  bg:C.amberDim,  phase:"pending_md", urg:null },
            { l:"Retur",   v:retReady.length,  c:C.purple, bg:C.purpleDim, phase:"return",     urg:null },
          ].map(s=>(
            <div key={s.l}
              onClick={()=>s.v>0 && onNavigate(s.phase, s.urg)}
              style={{ background:C.card, padding:"10px 8px", textAlign:"center", cursor:s.v>0?"pointer":"default", transition:"opacity .15s", position:"relative" }}>
              <div style={{ fontSize:20, fontWeight:900, color:s.v>0?s.c:C.faint, fontVariantNumeric:"tabular-nums" }}>{s.v}</div>
              <div style={{ fontSize:9.5, color:s.v>0?s.c:C.faint, fontWeight:600, marginTop:2 }}>{s.l}</div>
              {s.v>0 && <div style={{ fontSize:8, color:s.c, opacity:.6, marginTop:1 }}>tap →</div>}
            </div>
          ))}
        </div>
      )}

      {/* Gondola urgency bar */}
      {gondolaScore.length > 0 && (
        <div style={{ padding:"10px 15px 13px" }}>
          <div style={{ fontSize:10, color:C.faint, fontWeight:600, marginBottom:8, letterSpacing:".2px" }}>GONDOLA BUTUH PERHATIAN</div>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {gondolaScore.map(({k,g,score,pull,md})=>{
              const maxScore = gondolaScore[0].score;
              return (
                <div key={k}
                  onClick={()=>onNavigate("gondola_"+k)}
                  style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer", padding:"3px 0" }}>
                  {/* Label */}
                  <div style={{ width:24, height:24, borderRadius:7, background:g.dim, border:`1px solid ${g.border}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    <span style={{ fontSize:11, fontWeight:800, color:g.color }}>{k}</span>
                  </div>
                  {/* Progress bar */}
                  <div style={{ flex:1, height:6, background:C.cardHi, borderRadius:3, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${(score/maxScore)*100}%`, background:g.color, borderRadius:3, transition:"width .4s" }}/>
                  </div>
                  {/* Detail chips */}
                  <div style={{ display:"flex", gap:5, flexShrink:0, alignItems:"center" }}>
                    {pull>0 && (
                      <span style={{ background:C.roseDim, color:C.rose, borderRadius:6, padding:"2px 7px", fontSize:10, fontWeight:700 }}>
                        🚨{pull}
                      </span>
                    )}
                    {md>0 && (
                      <span style={{ background:C.amberDim, color:C.amber, borderRadius:6, padding:"2px 7px", fontSize:10, fontWeight:700 }}>
                        🏷️{md}
                      </span>
                    )}
                    <span style={{ fontSize:9, color:C.faint, opacity:.6 }}>→</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Safe state illustration */}
      {allSafe && (
        <div style={{ padding:"6px 15px 16px", display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ display:"flex", gap:6 }}>
            {Object.entries(GONDOLAS).map(([k,g])=>(
              <div key={k} style={{ width:32, height:32, borderRadius:9, background:g.dim, border:`1px solid ${g.border}`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                <span style={{ fontSize:12, fontWeight:800, color:g.color }}>{k}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize:11.5, color:C.faint }}>Semua gondola tidak ada yang kritis</div>
        </div>
      )}
    </div>
  );
}

// ─── Daily Hero ──────────────────────────────────────────────────────────────
function DailyHero({ items }) {
  const actions = [
    items.filter(i=>i.urg.level>=3).length && { txt:`${items.filter(i=>i.urg.level>=3).length} barang kritis atau siap tarik`, col:C.rose, bg:C.roseDim },
    items.filter(i=>i.phase==="pending_md").length && { txt:`${items.filter(i=>i.phase==="pending_md").length} barang perlu dimarkdown`, col:C.amber, bg:C.amberDim },
    items.filter(i=>i.phase==="sold_out").length && { txt:`${items.filter(i=>i.phase==="sold_out").length} markdown habis terjual`, col:C.orange, bg:C.orangeDim },
    items.filter(i=>i.days<0).length && { txt:`${items.filter(i=>i.days<0).length} barang sudah expired`, col:C.slate, bg:C.slateDim },
  ].filter(Boolean);

  if (!actions.length) return (
    <div style={{ background:C.greenDim,border:`1px solid ${C.greenBorder}`,borderRadius:16,padding:"16px 18px",marginBottom:14,display:"flex",alignItems:"center",gap:14 }}>
      <div style={{ width:40,height:40,borderRadius:20,background:"rgba(52,211,153,.18)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,color:C.green }}>{Ic.check}</div>
      <div>
        <div style={{ fontWeight:700,fontSize:14,color:C.green }}>Semua gondola aman</div>
        <div style={{ fontSize:11.5,color:C.sub,marginTop:1 }}>{todayStr()}</div>
      </div>
    </div>
  );

  return (
    <div style={{ background:C.card,border:`1px solid ${C.roseBorder}`,borderRadius:16,padding:"14px 15px",marginBottom:14 }}>
      <div style={{ display:"flex",alignItems:"center",gap:7,marginBottom:11 }}>
        <span style={{ color:C.rose }}>{Ic.alert}</span>
        <span style={{ fontWeight:700,fontSize:12.5,color:C.text }}>Perlu tindakan hari ini</span>
        <span style={{ fontSize:10.5,color:C.faint,marginLeft:"auto" }}>{todayStr()}</span>
      </div>
      <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
        {actions.map((a,i)=>(
          <div key={i} style={{ display:"flex",alignItems:"center",gap:9,background:a.bg,borderRadius:10,padding:"8px 11px" }}>
            <div style={{ width:6,height:6,borderRadius:3,background:a.col,flexShrink:0 }}/>
            <span style={{ fontSize:12.5,fontWeight:600,color:a.col }}>{a.txt}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Analytics ────────────────────────────────────────────────────────────────
function Analytics({ items }) {
  if (!items.length) return (
    <div style={{ textAlign:"center",padding:60,color:C.faint }}>
      <div style={{ fontSize:36,marginBottom:10,opacity:.4 }}>{Ic.chart}</div>
      Tambahkan barang untuk melihat analitik
    </div>
  );
  const totalVal = items.reduce((s,i)=>s+i.orig*i.qty,0);
  const mdLoss   = items.filter(i=>i.md.pct>0).reduce((s,i)=>s+(i.orig-i.disc)*i.qty,0);
  const bars = [
    { l:"Aman",    v:items.filter(i=>i.urg.level===0).length, c:C.green },
    { l:"Pantau",  v:items.filter(i=>i.urg.level===1).length, c:C.blue },
    { l:"Markdown",v:items.filter(i=>i.urg.level===2).length, c:C.amber },
    { l:"Kritis",  v:items.filter(i=>i.urg.level>=3&&i.urg.level<5).length, c:C.rose },
    { l:"Expired", v:items.filter(i=>i.days<0).length, c:C.slate },
  ];
  const gBreak = Object.entries(GONDOLAS).map(([k,g])=>{
    const gi = items.filter(i=>i.gondola===k);
    return { k, g, total:gi.length, urgent:gi.filter(i=>i.urg.level>=2).length };
  });

  return (
    <div>
      <div style={{ background:C.card,border:`1px solid ${C.line}`,borderRadius:16,padding:"16px 17px",marginBottom:12 }}>
        <div style={{ fontWeight:700,fontSize:12.5,color:C.sub,marginBottom:13,display:"flex",alignItems:"center",gap:7 }}>{Ic.chart} Ringkasan Stok</div>
        <div style={{ display:"flex",borderRadius:5,overflow:"hidden",height:6,marginBottom:11,gap:1.5 }}>
          {bars.map(b=>b.v>0&&<div key={b.l} style={{ flex:b.v,background:b.c,borderRadius:3 }}/>)}
        </div>
        <div style={{ display:"flex",gap:13,flexWrap:"wrap",marginBottom:15 }}>
          {bars.map(b=>(
            <div key={b.l} style={{ display:"flex",alignItems:"center",gap:5 }}>
              <div style={{ width:6,height:6,borderRadius:3,background:b.c }}/>
              <span style={{ fontSize:10.5,color:C.faint }}>{b.l}</span>
              <span style={{ fontSize:10.5,fontWeight:700,color:b.c }}>{b.v}</span>
            </div>
          ))}
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:9 }}>
          {[
            { l:"Total SKU",    v:items.length,     c:C.text },
            { l:"Nilai stok",   v:fmtRp(totalVal),  c:C.blue },
            { l:"Potensi loss", v:fmtRp(mdLoss),    c:C.rose },
          ].map(m=>(
            <div key={m.l} style={{ background:C.cardHi,borderRadius:11,padding:"10px 11px" }}>
              <div style={{ fontSize:9.5,color:C.faint,marginBottom:4 }}>{m.l}</div>
              <div style={{ fontSize:12.5,fontWeight:800,color:m.c,lineHeight:1.25 }}>{m.v}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background:C.card,border:`1px solid ${C.line}`,borderRadius:16,padding:"16px 17px" }}>
        <div style={{ fontWeight:700,fontSize:12.5,color:C.sub,marginBottom:13,display:"flex",alignItems:"center",gap:7 }}>{Ic.map} Per Gondola</div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:9 }}>
          {gBreak.map(({k,g,total,urgent})=>(
            <div key={k} style={{ background:g.dim,border:`1px solid ${g.border}`,borderRadius:12,padding:"11px 13px" }}>
              <div style={{ fontWeight:700,fontSize:12.5,color:g.color,marginBottom:7 }}>{g.label}</div>
              <div style={{ fontSize:20,fontWeight:800,color:g.color,fontVariantNumeric:"tabular-nums" }}>{total}</div>
              <div style={{ fontSize:10,color:C.faint }}>item</div>
              {urgent>0 && <div style={{ fontSize:10.5,color:C.rose,fontWeight:700,marginTop:5 }}>{urgent} butuh perhatian</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Action Card ───────────────────────────────────────────────────────────────
function ActionCard({ item, onMd, onQty, onPull, onRet, onBatalRetur, onEdit, onDel }) {
  const [open, setOpen] = useState(false);
  const mdc = item.md.tier ? getMDC()[item.md.tier] : null;
  const urg = item.urg;
  const g   = item.gondola ? GONDOLAS[item.gondola] : null;
  const hasDisc = item.md.pct > 0 && item.days >= 0;

  return (
    <div style={{ background:C.card, border:`1px solid ${C.line}`, borderRadius:16, overflow:"hidden" }}>
      <div style={{ padding:"13px 14px", display:"flex", gap:12, alignItems:"flex-start" }}>
        <div onClick={()=>setOpen(x=>!x)} style={{ cursor:"pointer" }}>
          <DayRing days={item.days} color={urg.color}/>
        </div>

        <div style={{ flex:1, minWidth:0 }} onClick={()=>setOpen(x=>!x)}>
          <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:6 }}>
            <Pill ch={urg.tag} color={urg.color} dim={`${urg.color}20`} bdr={`${urg.color}40`}/>
            {item.gondola && <LocBadge gondola={item.gondola} section={item.section}/>}
            {mdc && <Pill ch={<>{Ic.tag}−{item.md.pct}%</>} color={mdc.t} dim={mdc.d} bdr={mdc.b}/>}
          </div>
          {/* Action hint — selalu tampil, langsung tau harus ngapain */}
          {(()=>{
            const hints = {
              pending_md: { txt:"👉 Update harga di rak sekarang",   col:C.amber  },
              done_md:    { txt:"⏳ Menunggu H-7 untuk ditarik",      col:C.green  },
              sold_out:   { txt:"🎉 Stok markdown sudah habis",       col:C.orange },
              pull:       { txt:"🚨 Tarik dari rak hari ini!",        col:C.rose   },
              return:     { txt:"🔄 Kembalikan ke supplier",          col:C.purple },
              expired:    { txt:"💀 Sudah expired — segera proses",   col:C.slate  },
              normal:     null,
            };
            const h = hints[item.phase];
            if (!h) return null;
            return (
              <div style={{ fontSize:11.5, color:h.col, fontWeight:600, marginBottom:6, display:"flex", alignItems:"center", gap:5 }}>
                {h.txt}
              </div>
            );
          })()}
          <div style={{ fontWeight:700, fontSize:14.5, color:C.text, lineHeight:1.3, marginBottom:3 }}>{item.name}</div>
          <div style={{ fontSize:10.5, color:C.faint, fontFamily:"ui-monospace,monospace" }}>{item.barcode}</div>
        </div>

        <div style={{ color:C.faint, paddingTop:2, cursor:"pointer" }} onClick={()=>setOpen(x=>!x)}>
          <div style={{ transform: open ? "rotate(90deg)" : "none", transition:"transform .15s" }}>{Ic.chevR}</div>
        </div>
      </div>

      {/* Inline metrics row */}
      <div style={{ padding:"0 14px 13px", display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, background:C.cardHi, borderRadius:10, padding:"5px 10px" }}>
          <span style={{ fontSize:9.5, color:C.faint, fontWeight:600 }}>QTY</span>
          <QtyPicker qty={item.qty} onChange={v=>onQty(item.id,v)}/>
          {item.qty===0 && <Pill ch="Habis" color={C.rose} dim={C.roseDim} bdr={C.roseBorder}/>}
        </div>
        {item.orig>0 && (
          <div style={{ fontSize:12 }}>
            {hasDisc
              ? <><span style={{ color:C.faint, textDecoration:"line-through", fontSize:10.5 }}>{fmtRp(item.orig)}</span>{" "}<span style={{ color:mdc?.t, fontWeight:800 }}>{fmtRp(item.disc)}</span></>
              : <span style={{ color:C.sub }}>{fmtRp(item.orig)}</span>
            }
          </div>
        )}
        <div style={{ marginLeft:"auto" }}>
          {item.effRetur
            ? <Pill ch={<>{Ic.ret} Retur</>} color={C.purple} dim={C.purpleDim} bdr={C.purpleBorder}/>
            : <Pill ch="Tidak retur" color={C.faint} dim={"transparent"} bdr={C.line}/>
          }
        </div>
      </div>

      {/* Expanded actions */}
      {open && (
        <div style={{ padding:"13px 14px", borderTop:`1px solid ${C.line}`, background:C.bgSoft, display:"flex", flexDirection:"column", gap:8 }}>
          {item.phase==="pending_md" && (
            <button onClick={()=>onMd(item.id, item.md.pct)} style={{ width:"100%", background:C.accent, border:"none", color:"#08090D", padding:"11px", borderRadius:11, fontSize:13, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", gap:7, cursor:"pointer" }}>
              {Ic.check} Tandai sudah dimarkdown -{item.md.pct}%
            </button>
          )}
          {item.phase==="done_md" && (
            <button onClick={()=>onMd(item.id)} style={{ width:"100%", background:"transparent", border:`1px solid ${C.greenBorder}`, color:C.green, padding:"10px", borderRadius:11, fontSize:12.5, fontWeight:600, cursor:"pointer" }}>
              Batalkan markdown
            </button>
          )}
          {item.needsUpgrade && (
            <div style={{ background:C.amberDim, border:`1px solid ${C.amberBorder}`, borderRadius:10, padding:"9px 12px", display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:16 }}>⬆️</span>
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:C.amber }}>Diskon naik ke {item.md.pct}%!</div>
                <div style={{ fontSize:11, color:C.sub, marginTop:2 }}>Perlu update harga di rak — ceklis ulang setelah update</div>
              </div>
            </div>
          )}
          {item.needsUpgrade && (
            <button onClick={()=>onMd(item.id, item.md.pct)} style={{ width:"100%", background:C.amber, border:"none", color:"#08090D", padding:"10px", borderRadius:11, fontSize:12.5, fontWeight:700, cursor:"pointer" }}>
              ✅ Sudah update harga ke -{item.md.pct}%
            </button>
          )}
          {item.phase==="sold_out" && (
            <div style={{ background:C.orangeDim, borderRadius:11, padding:"10px 12px", fontSize:12, color:C.orange, textAlign:"center", fontWeight:600 }}>
              Stok markdown habis terjual
            </div>
          )}
          {item.phase==="pull" && (
            <button onClick={()=>onPull(item.id, item.name)} style={{ width:"100%", background:C.rose, border:"none", color:"#08090D", padding:"11px", borderRadius:11, fontSize:13, fontWeight:700, cursor:"pointer" }}>
              Tandai sudah ditarik dari rak
            </button>
          )}
          {item.phase==="return" && (
            <>
              {item.skipMd && (
                <div style={{ background:C.purpleDim, border:`1px solid ${C.purpleBorder}`, borderRadius:10, padding:"8px 11px", fontSize:11.5, color:C.purple, fontWeight:600, textAlign:"center" }}>
                  🔄 Barang ini bisa diretur — tidak perlu dimarkdown
                </div>
              )}
              <button onClick={()=>onRet(item.id, item.name)} style={{ width:"100%", background:"transparent", border:`1px solid ${C.purpleBorder}`, color:C.purple, padding:"10px", borderRadius:11, fontSize:12.5, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                {Ic.ret} Proses retur ke supplier
              </button>
            </>
          )}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:7 }}>
            <button onClick={()=>onEdit(item)} style={{ background:"transparent", border:`1px solid ${C.line}`, color:C.sub, padding:"9px", borderRadius:10, fontSize:12, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:5 }}>
              {Ic.edit} Edit
            </button>
            <button onClick={()=>onDel(item.id)} style={{ background:"transparent", border:`1px solid ${C.roseBorder}`, color:C.rose, padding:"9px", borderRadius:10, fontSize:12, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:5 }}>
              {Ic.trash} Hapus
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Form Modal ────────────────────────────────────────────────────────────────
function FormModal({ initial, onSave, onClose, allItems=[] }) {
  const [f, setF] = useState(initial);
  const [showScanner,  setShowScanner]  = useState(false);
  const [isListening,  setIsListening]  = useState(false);
  const recognRef = useRef(null);

  const startVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Browser tidak support input suara. Coba Chrome di Android."); return; }
    const r = new SR();
    r.lang = "id-ID";
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onstart  = () => setIsListening(true);
    r.onend    = () => setIsListening(false);
    r.onerror  = () => setIsListening(false);
    r.onresult = (e) => {
      const txt = e.results[0][0].transcript;
      set("name", txt);
      setIsListening(false);
    };
    recognRef.current = r;
    r.start();
  };

  const stopVoice = () => {
    recognRef.current?.stop();
    setIsListening(false);
  };
  const [forceAdd,   setForceAdd]   = useState(false);
  const set = (k,v) => {
    setF(p=>({...p,[k]:v}));
    if (k==="barcode") setForceAdd(false); // reset saat barcode berubah
  };

  // Cek duplikat barcode
  const dupItem = f.barcode.trim().length > 0 && !forceAdd
    ? allItems.find(i => i.barcode === f.barcode.trim() && i.id !== (initial.id||null))
    : null;
  const days   = f.expDate ? getDays(f.expDate) : null;
  const mdPrev = days!==null ? getMd(days, f.isImport) : null;

  const submit = () => {
    if (!f.barcode.trim()||!f.name.trim()||!f.expDate) return;
    onSave({ ...f, qty:parseInt(f.qty)||0, price:parseFloat(f.price)||0 });
  };

  return (
    <>
      {showScanner && (
        <BarcodeScanner
          onResult={code => { set("barcode", code); setShowScanner(false); }}
          onClose={() => setShowScanner(false)}
        />
      )}
      <div style={{ position:"fixed",inset:0,zIndex:300,background:"rgba(4,5,8,.85)",display:"flex",alignItems:"flex-end" }}>
        <div style={{ width:"100%",maxHeight:"94vh",overflowY:"auto",background:C.bgSoft,borderRadius:"20px 20px 0 0",padding:"18px 16px 36px",borderTop:`1px solid ${C.lineHi}` }}>
          <div style={{ width:36,height:4,background:C.line,borderRadius:2,margin:"0 auto 16px" }}/>
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16 }}>
            <span style={{ fontWeight:700,fontSize:16,color:C.text }}>{f.id?"Edit barang":"Tambah barang"}</span>
            <button onClick={onClose} style={{ background:C.cardHi,border:"none",color:C.sub,width:30,height:30,borderRadius:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>{Ic.close}</button>
          </div>

          {/* Tipe */}
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14 }}>
            {[{v:false,l:"Lokal",s:"Diskon 30–70%",c:C.green},{v:true,l:"Impor",s:"Diskon 70% di H-30",c:C.purple}].map(t=>(
              <div key={t.v} onClick={()=>set("isImport",t.v)} style={{ padding:"11px 12px",borderRadius:12,border:`1.5px solid ${f.isImport===t.v?t.c:C.line}`,background:f.isImport===t.v?`${t.c}15`:"transparent",cursor:"pointer" }}>
                <div style={{ fontWeight:700,fontSize:13,color:f.isImport===t.v?t.c:C.sub }}>{t.l}</div>
                <div style={{ fontSize:10,color:C.faint,marginTop:2 }}>{t.s}</div>
              </div>
            ))}
          </div>

          <div style={{ display:"grid",gap:11,marginBottom:11 }}>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
              <div>
                <div style={{ fontSize:10.5,color:C.sub,marginBottom:5,fontWeight:600 }}>Barcode</div>
                <div style={{ display:"flex",gap:7 }}>
                  <input value={f.barcode} onChange={e=>set("barcode",e.target.value)} placeholder="Scan / ketik" style={{ flex:1,minWidth:0,background:C.bg,border:`1px solid ${C.line}`,borderRadius:10,padding:"10px 11px",color:C.text,fontSize:12.5,fontFamily:"ui-monospace,monospace" }}/>
                  <button type="button" onClick={()=>setShowScanner(true)} style={{ width:42,height:42,background:C.accent,border:"none",borderRadius:10,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,color:"#08090D" }} title="Pindai barcode">
                    {Ic.camera}
                  </button>
                </div>
              </div>

              {/* Duplicate barcode warning */}
              {dupItem && (
                <div style={{ gridColumn:"1/-1", background:C.amberDim, border:`1px solid ${C.amberBorder}`, borderRadius:11, padding:"11px 13px" }}>
                  <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
                    <div style={{ fontSize:18, flexShrink:0 }}>⚠️</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, fontSize:12.5, color:C.amber, marginBottom:4 }}>
                        Barcode ini sudah ada di sistem!
                      </div>
                      <div style={{ fontSize:12, color:C.text, fontWeight:600, marginBottom:2 }}>{dupItem.name}</div>
                      <div style={{ fontSize:11, color:C.sub, marginBottom:8 }}>
                        Exp: {dupItem.expDate && new Date(dupItem.expDate).toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"})}
                        {dupItem.gondola ? ` · ${dupItem.section||dupItem.gondola}` : ""}
                        {" · "}{getDays(dupItem.expDate) >= 0 ? `Sisa ${getDays(dupItem.expDate)} hari` : "Sudah expired"}
                      </div>
                      <div style={{ display:"flex", gap:7 }}>
                        <button onClick={()=>setForceAdd(true)} style={{ flex:1, background:"transparent", border:`1px solid ${C.amberBorder}`, color:C.amber, padding:"7px", borderRadius:8, fontSize:11.5, fontWeight:700, cursor:"pointer" }}>
                          Tetap Tambah (Beda Batch)
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <div style={{ fontSize:10.5,color:C.sub,marginBottom:5,fontWeight:600 }}>Tanggal exp</div>
                <input type="date" value={f.expDate} onChange={e=>set("expDate",e.target.value)} style={{ width:"100%",background:C.bg,border:`1px solid ${C.line}`,borderRadius:10,padding:"10px 11px",color:C.text,fontSize:12.5,colorScheme:"dark" }}/>
              </div>
            </div>

            <div>
              <div style={{ fontSize:10.5,color:C.sub,marginBottom:5,fontWeight:600 }}>Nama barang</div>
              <div style={{ display:"flex", gap:7 }}>
                <input
                  value={f.name}
                  onChange={e=>set("name",e.target.value)}
                  placeholder={isListening?"🎤 Mendengarkan...":"Nama produk"}
                  style={{ flex:1, background:isListening?`${C.rose}18`:C.bg, border:`1px solid ${isListening?C.rose:C.line}`, borderRadius:10, padding:"10px 11px", color:C.text, fontSize:14, transition:"all .2s" }}
                />
                <button
                  type="button"
                  onClick={isListening ? stopVoice : startVoice}
                  style={{ width:44, height:44, borderRadius:10, border:`1px solid ${isListening?C.rose:C.line}`, background:isListening?C.roseDim:C.cardHi, color:isListening?C.rose:C.sub, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:20, transition:"all .2s", animation:isListening?"micPulse 1s ease-in-out infinite":"none" }}
                  title={isListening?"Tap untuk stop":"Tap untuk input suara"}
                >
                  🎤
                </button>
              </div>
              {isListening && (
                <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:5 }}>
                  <div style={{ display:"flex", gap:2 }}>
                    {[0,1,2,3].map(i=>(
                      <div key={i} style={{ width:3, background:C.rose, borderRadius:2, animation:`voiceBar .6s ease-in-out ${i*0.12}s infinite alternate`, minHeight:3 }}/>
                    ))}
                  </div>
                  <span style={{ fontSize:11, color:C.rose, fontWeight:600 }}>Sedang mendengarkan — ucapkan nama barang</span>
                </div>
              )}
            </div>

            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
              <div>
                <div style={{ fontSize:10.5,color:C.sub,marginBottom:5,fontWeight:600 }}>Harga normal</div>
                <input type="number" value={f.price} onChange={e=>set("price",e.target.value)} placeholder="0" style={{ width:"100%",background:C.bg,border:`1px solid ${C.line}`,borderRadius:10,padding:"10px 11px",color:C.text,fontSize:12.5 }}/>
              </div>
              <div>
                <div style={{ fontSize:10.5,color:C.sub,marginBottom:5,fontWeight:600 }}>Qty / stok</div>
                <input type="number" value={f.qty} onChange={e=>set("qty",e.target.value)} min="0" placeholder="1" style={{ width:"100%",background:C.bg,border:`1px solid ${C.line}`,borderRadius:10,padding:"10px 11px",color:C.text,fontSize:12.5 }}/>
              </div>
            </div>

            <div style={{ background:C.bg,border:`1px solid ${C.line}`,borderRadius:12,padding:"12px 13px" }}>
              <GondolaPicker gondola={f.gondola||null} section={f.section||null} onChange={(g,s)=>setF(p=>({...p,gondola:g,section:s}))}/>
            </div>

            <div style={{ display:"flex",alignItems:"center",gap:10 }}>
              <Toggle on={mdPrev?.noRetur?false:f.canReturn} onChange={v=>set("canReturn",v)} disabled={!!mdPrev?.noRetur}/>
              <span style={{ fontSize:12.5,color:mdPrev?.noRetur?C.rose:f.canReturn?C.purple:C.faint,fontWeight:600 }}>
                {mdPrev?.noRetur?"Tidak bisa retur — diskon 70%":f.canReturn?"Bisa diretur":"Tidak bisa diretur"}
              </span>
            </div>

            {/* Warning tanggal backdate / expired */}
            {days !== null && days < 0 && (
              <div style={{ background:C.roseDim,border:`1px solid ${C.roseBorder}`,borderRadius:11,padding:"10px 13px",display:"flex",alignItems:"center",gap:8 }}>
                <span style={{ fontSize:16 }}>⚠️</span>
                <div>
                  <div style={{ fontSize:12.5,color:C.rose,fontWeight:700 }}>Tanggal sudah lewat!</div>
                  <div style={{ fontSize:11,color:C.sub,marginTop:2 }}>Barang sudah expired {Math.abs(days)} hari lalu. Pastikan tanggal benar.</div>
                </div>
              </div>
            )}
            {mdPrev?.pct>0 && days!==null && days>=0 && (
              <div style={{ background:getMDC()[mdPrev.tier].d,border:`1px solid ${getMDC()[mdPrev.tier].b}`,borderRadius:11,padding:"10px 13px",display:"flex",alignItems:"center",gap:8 }}>
                <span style={{ color:getMDC()[mdPrev.tier].t }}>{Ic.tag}</span>
                <span style={{ fontSize:12.5,color:getMDC()[mdPrev.tier].t,fontWeight:700 }}>
                  Otomatis diskon {mdPrev.pct}%{f.price>0&&` — ${fmtRp(f.price*(1-mdPrev.pct/100))}`}
                </span>
              </div>
            )}
          </div>

          <div style={{ display:"grid",gridTemplateColumns:"1fr auto",gap:8,marginTop:6 }}>
            <button onClick={submit} disabled={!!dupItem} style={{ background:dupItem?C.slateDim:C.accent,border:"none",color:dupItem?"#475569":"#08090D",padding:13,borderRadius:12,fontWeight:700,fontSize:14,cursor:dupItem?"not-allowed":"pointer",opacity:dupItem?.6:1 }}>
              {f.id?"Simpan perubahan":"Tambah barang"}
            </button>
            <button onClick={onClose} style={{ background:"transparent",border:`1px solid ${C.line}`,color:C.sub,padding:"13px 18px",borderRadius:12,fontSize:13,cursor:"pointer" }}>
              Batal
            </button>
          </div>
        </div>
      </div>
    </>
  );
}


// ─── Laporan View ─────────────────────────────────────────────────────────────
function LaporanView({ items, onBatalRetur }) {
  const [bulan, setBulan] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  });

  const fmtBulan = b => new Date(b+"-01").toLocaleDateString("id-ID",{month:"long",year:"numeric"});
  const fmtTgl   = s => s ? new Date(s).toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"}) : "-";
  const fmtRp2   = n => "Rp "+Number(n).toLocaleString("id-ID");

  // Semua bulan yang ada data
  const allMonths = [...new Set(items.flatMap(i => {
    const ms = [];
    if (i.pulledAt)   ms.push(i.pulledAt.slice(0,7));
    if (i.returnedAt) ms.push(i.returnedAt.slice(0,7));
    if (i.addedAt)    ms.push(i.addedAt.slice(0,7));
    return ms;
  }))].sort().reverse();

  if (!allMonths.length) allMonths.push(bulan);

  // Filter item berdasarkan bulan dipilih
  const inMonth = (dateStr) => dateStr && dateStr.slice(0,7) === bulan;

  const pulled   = items.filter(i => inMonth(i.pulledAt));
  const returned = items.filter(i => inMonth(i.returnedAt));
  const expired  = items.filter(i => {
    const d = getDays(i.expDate);
    return d < 0 && inMonth(i.addedAt);
  });

  // Nilai total diretur (diselamatkan)
  const nilaiRetur = returned.reduce((s,i) => s+(parseFloat(i.price)||0)*(parseInt(i.qty)||1), 0);
  // Nilai total ditarik (loss)
  const nilaiTarik = pulled.filter(i=>!i.canReturn).reduce((s,i) => s+(parseFloat(i.price)||0)*(parseInt(i.qty)||1), 0);

  // Per gondola breakdown
  const gondolaBreakdown = Object.entries(GONDOLAS).map(([k,g]) => ({
    k, g,
    ditarik:   pulled.filter(i=>i.gondola===k).length,
    diretur:   returned.filter(i=>i.gondola===k).length,
    tanpaLokasi: pulled.filter(i=>!i.gondola).length,
  }));

  // Chart data — tarik vs retur per minggu dalam bulan
  const getWeek = dateStr => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return Math.ceil(d.getDate() / 7);
  };
  const weekData = [1,2,3,4,5].map(w => ({
    w,
    label: `Minggu ${w}`,
    tarik:  pulled.filter(i=>getWeek(i.pulledAt)===w).length,
    retur:  returned.filter(i=>getWeek(i.returnedAt)===w).length,
  })).filter(w => w.tarik > 0 || w.retur > 0);

  const maxBar = Math.max(...weekData.map(w=>Math.max(w.tarik,w.retur)), 1);

  // Share laporan sebagai teks
  const shareReport = () => {
    const text = `📊 *LAPORAN EKSPIRASI — ${fmtBulan(bulan)}*

` +
      `🚨 Ditarik dari rak : ${pulled.length} item
` +
      `🔄 Diretur supplier : ${returned.length} item
` +
      `💀 Expired          : ${expired.length} item
` +
      `💰 Nilai diretur    : ${fmtRp2(nilaiRetur)}

` +
      `*Per Gondola:*
` +
      gondolaBreakdown.map(g=>
        `${g.g.label}: ${g.ditarik} ditarik, ${g.diretur} diretur`
      ).join("\n") +
      "\n\n_Dibuat dari ExpTracker_";

    if (navigator.share) {
      navigator.share({ title:"Laporan ExpTracker", text });
    } else {
      navigator.clipboard?.writeText(text);
      alert("Laporan disalin ke clipboard!");
    }
  };

  return (
    <div>
      {/* Pilih bulan */}
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14 }}>
        <div style={{ fontWeight:700,fontSize:15,color:C.text }}>Laporan Bulanan</div>
        <select value={bulan} onChange={e=>setBulan(e.target.value)} style={{ background:C.card,border:`1px solid ${C.line}`,borderRadius:9,padding:"7px 11px",color:C.text,fontSize:12,cursor:"pointer" }}>
          {allMonths.map(m=>(
            <option key={m} value={m}>{fmtBulan(m)}</option>
          ))}
        </select>
      </div>

      {/* Summary cards */}
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:9,marginBottom:12 }}>
        {[
          { l:"Ditarik dari rak", v:pulled.length,   ic:"🚨", c:C.rose,   sub:"item" },
          { l:"Diretur supplier", v:returned.length, ic:"🔄", c:C.purple, sub:"item" },
          { l:"Expired",          v:expired.length,  ic:"💀", c:C.slate,  sub:"item" },
          { l:"Nilai diretur",    v:fmtRp2(nilaiRetur), ic:"💰", c:C.green, sub:"diselamatkan" },
        ].map(s=>(
          <div key={s.l} style={{ background:C.card,border:`1px solid ${C.line}`,borderRadius:14,padding:"13px 14px" }}>
            <div style={{ fontSize:20,marginBottom:6 }}>{s.ic}</div>
            <div style={{ fontSize:18,fontWeight:800,color:s.c,lineHeight:1,fontVariantNumeric:"tabular-nums" }}>{s.v}</div>
            <div style={{ fontSize:10,color:C.faint,marginTop:3 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Tabel per Gondola */}
      <div style={{ background:C.card,border:`1px solid ${C.line}`,borderRadius:14,padding:"14px",marginBottom:12 }}>
        <div style={{ fontWeight:700,fontSize:12.5,color:C.sub,marginBottom:12 }}>Breakdown per Gondola</div>
        <div style={{ display:"grid",gridTemplateColumns:"auto 1fr 1fr 1fr",gap:"8px 12px",alignItems:"center" }}>
          <div style={{ fontSize:10,color:C.faint }}>Gondola</div>
          <div style={{ fontSize:10,color:C.faint,textAlign:"center" }}>Ditarik</div>
          <div style={{ fontSize:10,color:C.faint,textAlign:"center" }}>Diretur</div>
          <div style={{ fontSize:10,color:C.faint,textAlign:"center" }}>Total</div>
          {Object.entries(GONDOLAS).map(([k,g])=>{
            const dit = pulled.filter(i=>i.gondola===k).length;
            const dir = returned.filter(i=>i.gondola===k).length;
            return (
              <React.Fragment key={k}>
                <div style={{ fontWeight:700,fontSize:13,color:g.color }}>{g.label}</div>
                <div style={{ textAlign:"center",fontWeight:700,fontSize:14,color:dit>0?C.rose:C.faint }}>{dit}</div>
                <div style={{ textAlign:"center",fontWeight:700,fontSize:14,color:dir>0?C.purple:C.faint }}>{dir}</div>
                <div style={{ textAlign:"center",fontWeight:700,fontSize:14,color:C.text }}>{dit+dir}</div>
              </React.Fragment>
            );
          })}
          <div style={{ fontSize:11,color:C.faint,gridColumn:"1/-1",borderTop:`1px solid ${C.line}`,paddingTop:8,marginTop:4 }}>
            {pulled.filter(i=>!i.gondola).length > 0 && `*${pulled.filter(i=>!i.gondola).length} item tanpa lokasi gondola`}
          </div>
        </div>
      </div>

      {/* Bar Chart minggu */}
      {weekData.length > 0 && (
        <div style={{ background:C.card,border:`1px solid ${C.line}`,borderRadius:14,padding:"14px",marginBottom:12 }}>
          <div style={{ fontWeight:700,fontSize:12.5,color:C.sub,marginBottom:14 }}>Aktivitas per Minggu</div>
          <div style={{ display:"flex",alignItems:"flex-end",gap:10,height:120,paddingBottom:4 }}>
            {weekData.map(w=>(
              <div key={w.w} style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3,height:"100%",justifyContent:"flex-end" }}>
                <div style={{ width:"100%",display:"flex",gap:2,alignItems:"flex-end",height:100,justifyContent:"center" }}>
                  {/* Bar tarik */}
                  <div style={{ flex:1,background:C.rose,borderRadius:"4px 4px 0 0",height:`${(w.tarik/maxBar)*100}%`,minHeight:w.tarik>0?4:0,transition:"height .4s" }}/>
                  {/* Bar retur */}
                  <div style={{ flex:1,background:C.purple,borderRadius:"4px 4px 0 0",height:`${(w.retur/maxBar)*100}%`,minHeight:w.retur>0?4:0,transition:"height .4s" }}/>
                </div>
                <div style={{ fontSize:10,color:C.faint }}>{w.label.replace("Minggu ","Mg ")}</div>
                <div style={{ fontSize:9,color:C.faint }}>{w.tarik>0?`${w.tarik}↑`:""}{w.retur>0?` ${w.retur}↩`:""}</div>
              </div>
            ))}
          </div>
          <div style={{ display:"flex",gap:14,marginTop:8,justifyContent:"center" }}>
            <div style={{ display:"flex",alignItems:"center",gap:5 }}>
              <div style={{ width:10,height:10,borderRadius:3,background:C.rose }}/>
              <span style={{ fontSize:11,color:C.faint }}>Ditarik</span>
            </div>
            <div style={{ display:"flex",alignItems:"center",gap:5 }}>
              <div style={{ width:10,height:10,borderRadius:3,background:C.purple }}/>
              <span style={{ fontSize:11,color:C.faint }}>Diretur</span>
            </div>
          </div>
        </div>
      )}

      {/* Riwayat list */}
      <div style={{ background:C.card,border:`1px solid ${C.line}`,borderRadius:14,padding:"14px",marginBottom:12 }}>
        <div style={{ fontWeight:700,fontSize:12.5,color:C.sub,marginBottom:12 }}>Riwayat Tindakan</div>
        {[...pulled.map(i=>({...i,_aksi:"tarik",_tgl:i.pulledAt})),
          ...returned.map(i=>({...i,_aksi:"retur",_tgl:i.returnedAt}))
        ].sort((a,b)=>new Date(b._tgl)-new Date(a._tgl)).length === 0 ? (
          <div style={{ textAlign:"center",padding:"20px 0",color:C.faint,fontSize:12.5 }}>
            Belum ada riwayat di bulan {fmtBulan(bulan)}
          </div>
        ) : (
          [...pulled.map(i=>({...i,_aksi:"tarik",_tgl:i.pulledAt})),
           ...returned.map(i=>({...i,_aksi:"retur",_tgl:i.returnedAt}))
          ].sort((a,b)=>new Date(b._tgl)-new Date(a._tgl)).map((item,idx)=>(
            <div key={idx} style={{ display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:idx<([...pulled.map(i=>({...i,_aksi:"tarik",_tgl:i.pulledAt})),...returned.map(i=>({...i,_aksi:"retur",_tgl:i.returnedAt}))].length-1)?`1px solid ${C.line}`:"none" }}>
              <div style={{ width:32,height:32,borderRadius:16,background:item._aksi==="tarik"?C.roseDim:C.purpleDim,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:14 }}>
                {item._aksi==="tarik"?"🚨":"🔄"}
              </div>
              <div style={{ flex:1,minWidth:0 }}>
                <div style={{ fontWeight:600,fontSize:13,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{item.name}</div>
                <div style={{ fontSize:10.5,color:C.faint,marginTop:1 }}>
                  {item._aksi==="tarik"?"Ditarik dari rak":"Diretur ke supplier"} · {fmtTgl(item._tgl)}
                  {item.returNote && <span style={{ color:C.sub }}> · {item.returNote}</span>}
                </div>
              </div>
              {item.gondola && <LocBadge gondola={item.gondola} section={item.section}/>}
              {item._aksi==="retur" && onBatalRetur && (
                <button onClick={()=>onBatalRetur(item.id)} style={{ background:"transparent",border:`1px solid ${C.line}`,color:C.faint,padding:"4px 9px",borderRadius:7,fontSize:10.5,fontWeight:600,cursor:"pointer",flexShrink:0,whiteSpace:"nowrap" }}>
                  ↩ Batal
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Share button */}
      <button onClick={shareReport} style={{ width:"100%",background:C.accent,border:"none",color:"#08090D",padding:"13px",borderRadius:12,fontWeight:700,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:16 }}>
        📤 Bagikan Laporan
      </button>
    </div>
  );
}


// ─── Catatan View — list sederhana buat referensi form kertas ─────────────────
function CatatanView({ items, onEdit }) {
  const [sortG,   setSortG]   = useState("all");   // filter gondola
  const [sortCol, setSortCol] = useState("exp");   // sort kolom
  const [phase,   setPhase]   = useState("all");   // filter status
  const [search,  setSearch]  = useState("");

  const fmtExp = d => new Date(d).toLocaleDateString("id-ID",{day:"2-digit",month:"2-digit",year:"2-digit"});

  // Filter & sort
  const list = items
    .filter(i => {
      if (sortG !== "all" && i.gondola !== sortG) return false;
      if (phase === "md"  && i.md.pct === 0) return false;
      if (phase === "pull"&& i.phase !== "pull") return false;
      if (phase === "retur"&& i.phase !== "return") return false;
      if (search) {
        const q = search.toLowerCase();
        return i.name.toLowerCase().includes(q) || i.barcode.includes(q);
      }
      return true;
    })
    .sort((a,b) => {
      if (sortCol === "gondola") return (a.gondola||"Z").localeCompare(b.gondola||"Z") || (a.section||"").localeCompare(b.section||"");
      if (sortCol === "exp")     return a.days - b.days;
      if (sortCol === "name")    return a.name.localeCompare(b.name);
      if (sortCol === "disc")    return b.md.pct - a.md.pct;
      return 0;
    });

  // Status label singkat
  const statusLabel = item => {
    if (item.days < 0)            return { l:"EXP",   c:C.slate  };
    if (item.phase==="pull")      return { l:"TARIK", c:C.rose   };
    if (item.phase==="return")    return { l:"RETUR", c:C.purple };
    if (item.phase==="done_md")   return { l:"MD✓",   c:C.green  };
    if (item.phase==="sold_out")  return { l:"HABIS", c:C.orange };
    if (item.md.pct > 0)         return { l:`-${item.md.pct}%`, c:item.md.pct===70?C.rose:item.md.pct===50?C.orange:C.amber };
    return                               { l:"AMAN",  c:C.faint  };
  };

  return (
    <div>
      {/* Filter bar */}
      <div style={{ display:"flex", gap:7, marginBottom:10, flexWrap:"wrap", alignItems:"center" }}>
        {/* Gondola filter */}
        <div style={{ display:"flex", gap:4 }}>
          {["all","A","B","C","D"].map(g=>(
            <button key={g} onClick={()=>setSortG(g)} style={{ background:sortG===g?C.accent:C.card, border:`1px solid ${sortG===g?C.accent:C.line}`, color:sortG===g?"#08090D":C.sub, padding:"5px 11px", borderRadius:8, fontSize:12, fontWeight:700, cursor:"pointer" }}>
              {g==="all"?"Semua":g}
            </button>
          ))}
        </div>
        {/* Phase filter */}
        <select value={phase} onChange={e=>setPhase(e.target.value)} style={{ background:C.card, border:`1px solid ${C.line}`, borderRadius:8, padding:"5px 9px", color:C.sub, fontSize:12, cursor:"pointer" }}>
          <option value="all">Semua status</option>
          <option value="md">Ada diskon</option>
          <option value="pull">Siap tarik</option>
          <option value="retur">Retur</option>
        </select>
      </div>

      {/* Search */}
      <div style={{ position:"relative", marginBottom:10 }}>
        <div style={{ position:"absolute", left:11, top:"50%", transform:"translateY(-50%)", color:C.faint, pointerEvents:"none" }}>{Ic.search}</div>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari nama atau barcode..." style={{ width:"100%", background:C.card, border:`1px solid ${C.line}`, borderRadius:10, padding:"9px 12px 9px 34px", color:C.text, fontSize:13 }}/>
      </div>

      {/* Sort header — tap untuk sort */}
      <div style={{ display:"grid", gridTemplateColumns:"32px 1fr 90px 56px 44px", gap:0, background:C.cardHi, borderRadius:"10px 10px 0 0", padding:"8px 10px", marginBottom:1 }}>
        <div style={{ fontSize:10, color:C.faint, fontWeight:700 }}>NO</div>
        <button onClick={()=>setSortCol("name")} style={{ background:"none", border:"none", color:sortCol==="name"?C.accent:C.faint, fontSize:10, fontWeight:700, textAlign:"left", cursor:"pointer", padding:0 }}>
          NAMA {sortCol==="name"&&"↑"}
        </button>
        <button onClick={()=>setSortCol("exp")} style={{ background:"none", border:"none", color:sortCol==="exp"?C.accent:C.faint, fontSize:10, fontWeight:700, textAlign:"center", cursor:"pointer", padding:0 }}>
          EXP {sortCol==="exp"&&"↑"}
        </button>
        <button onClick={()=>setSortCol("gondola")} style={{ background:"none", border:"none", color:sortCol==="gondola"?C.accent:C.faint, fontSize:10, fontWeight:700, textAlign:"center", cursor:"pointer", padding:0 }}>
          LOK {sortCol==="gondola"&&"↑"}
        </button>
        <button onClick={()=>setSortCol("disc")} style={{ background:"none", border:"none", color:sortCol==="disc"?C.accent:C.faint, fontSize:10, fontWeight:700, textAlign:"center", cursor:"pointer", padding:0 }}>
          STS {sortCol==="disc"&&"↑"}
        </button>
      </div>

      {/* List */}
      <div style={{ background:C.card, border:`1px solid ${C.line}`, borderRadius:"0 0 12px 12px", overflow:"hidden" }}>
        {list.length === 0 ? (
          <div style={{ textAlign:"center", padding:"32px 20px", color:C.faint, fontSize:13 }}>Tidak ada barang</div>
        ) : list.map((item, idx) => {
          const sl = statusLabel(item);
          const isOdd = idx % 2 === 0;
          return (
            <div key={item.id} style={{ display:"grid", gridTemplateColumns:"32px 1fr 90px 56px 44px", gap:0, padding:"9px 10px", background:isOdd?"transparent":"rgba(255,255,255,.02)", borderBottom:idx<list.length-1?`1px solid ${C.line}`:"none", alignItems:"center" }}>
              {/* No */}
              <div style={{ fontSize:10.5, color:C.faint, fontVariantNumeric:"tabular-nums" }}>{idx+1}</div>

              {/* Nama + barcode */}
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:600, color:C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", lineHeight:1.3 }}>{item.name}</div>
                <div style={{ fontSize:10, color:C.faint, fontFamily:"ui-monospace,monospace", marginTop:1 }}>{item.barcode}</div>
              </div>

              {/* Exp date + sisa hari */}
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:11.5, fontWeight:700, color:item.days<=7?C.rose:item.days<=30?C.orange:item.days<=90?C.amber:C.sub, fontVariantNumeric:"tabular-nums" }}>
                  {fmtExp(item.expDate)}
                </div>
                <div style={{ fontSize:9.5, color:C.faint, marginTop:1 }}>
                  {item.days<0?`${Math.abs(item.days)}h lalu`:item.days===0?"Hari ini":`${item.days}h`}
                </div>
              </div>

              {/* Lokasi */}
              <div style={{ textAlign:"center" }}>
                {item.gondola ? (
                  <span style={{ background:GONDOLAS[item.gondola].dim, color:GONDOLAS[item.gondola].color, borderRadius:6, padding:"2px 6px", fontSize:10.5, fontWeight:700 }}>
                    {item.section||item.gondola}
                  </span>
                ) : <span style={{ color:C.faint, fontSize:10 }}>—</span>}
              </div>

              {/* Status + edit */}
              <div style={{ textAlign:"center", display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                <span style={{ color:sl.c, fontSize:10.5, fontWeight:800 }}>{sl.l}</span>
                <button onClick={()=>onEdit(item)} style={{ background:"transparent",border:`1px solid ${C.line}`,color:C.faint,borderRadius:5,padding:"2px 7px",fontSize:9.5,cursor:"pointer" }}>edit</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer count */}
      <div style={{ textAlign:"center", marginTop:10, fontSize:11.5, color:C.faint }}>
        {list.length} barang · {new Date().toLocaleDateString("id-ID",{day:"numeric",month:"long",year:"numeric"})}
      </div>
    </div>
  );
}


// ─── Splash Screen ────────────────────────────────────────────────────────────
function SplashScreen({ onDone }) {
  const [phase, setPhase] = useState(0);
  // phase 0: icon muncul, phase 1: text muncul, phase 2: fade out

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 400);
    const t2 = setTimeout(() => setPhase(2), 1600);
    const t3 = setTimeout(() => onDone(), 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:9999,
      background:"#080B12",
      display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center", gap:20,
      opacity: phase === 2 ? 0 : 1,
      transition: phase === 2 ? "opacity .55s ease" : "none",
    }}>
      {/* Animated ring + icon */}
      <div style={{ position:"relative", width:96, height:96 }}>
        {/* Outer spinning ring */}
        <svg width="96" height="96" style={{ position:"absolute", inset:0, animation:"spin 1.8s linear infinite" }}>
          <circle cx="48" cy="48" r="42" fill="none"
            stroke="rgba(129,140,248,.15)" strokeWidth="3"/>
          <circle cx="48" cy="48" r="42" fill="none"
            stroke="#818CF8" strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="60 204"
          />
        </svg>
        {/* Inner icon box */}
        <div style={{
          position:"absolute", inset:12,
          background:"linear-gradient(135deg,rgba(129,140,248,.2),rgba(192,132,252,.15))",
          border:"1px solid rgba(129,140,248,.35)",
          borderRadius:20,
          display:"flex", alignItems:"center", justifyContent:"center",
          transform: phase >= 0 ? "scale(1)" : "scale(0.5)",
          transition: "transform .4s cubic-bezier(.34,1.56,.64,1)",
        }}>
          <span style={{ fontSize:34 }}>📦</span>
        </div>
      </div>

      {/* App name */}
      <div style={{
        textAlign:"center",
        opacity: phase >= 1 ? 1 : 0,
        transform: phase >= 1 ? "translateY(0)" : "translateY(12px)",
        transition: "opacity .4s ease, transform .4s ease",
      }}>
        <div style={{ fontSize:24, fontWeight:800, color:"#E7EAF0", letterSpacing:"-.5px" }}>
          ExpTracker
        </div>
        <div style={{ fontSize:12, color:"#4A536A", marginTop:4, letterSpacing:".5px" }}>
          MONITORING KEDALUWARSA
        </div>
      </div>

      {/* Loading dots */}
      <div style={{
        display:"flex", gap:6, marginTop:8,
        opacity: phase >= 1 ? 1 : 0,
        transition: "opacity .3s ease .2s",
      }}>
        {[0,1,2].map(i=>(
          <div key={i} style={{
            width:5, height:5, borderRadius:3,
            background:"#818CF8",
            animation:`dot .9s ease-in-out ${i*0.18}s infinite`,
          }}/>
        ))}
      </div>

      <style>{`
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes dot      { 0%,80%,100%{transform:scale(.5);opacity:.3} 40%{transform:scale(1);opacity:1} }
        @keyframes micPulse  { 0%{box-shadow:0 0 0 0 ${C.rose}50} 100%{box-shadow:0 0 0 8px ${C.rose}00} }
        @keyframes voiceBar  { from{height:3px} to{height:18px} }
      `}</style>
    </div>
  );
}

// ─── ROOT ────────────────────────────────────────────────────────────────────
const BLANK = { barcode:"",name:"",expDate:"",canReturn:true,isImport:false,price:"",qty:"1",gondola:null,section:null };

export default function App() {
  const [isDark,     setIsDark]     = useState(()=>{ try{return localStorage.getItem("exptheme")!=="light"}catch{return true} });
  const [showMore,   setShowMore]   = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [raw,        setRaw]        = useState(load);
  const [formData, setFormData] = useState(null);
  const [search,   setSearch]   = useState("");
  const [tab,      setTab]      = useState("today");
  const [filterG,  setFilterG]  = useState(null);
  const [filterS,  setFilterS]  = useState(null);
  const [filterType,setFilterType]=useState("all");
  const [phaseF,   setPhaseF]   = useState("all");
  const [sortBy,   setSortBy]   = useState("urgency");
  const [toast,    setToast]    = useState(null);

  useEffect(()=>persist(raw),[raw]);

  // Apply theme
  setTheme(isDark);
  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    try { localStorage.setItem("exptheme", next?"dark":"light"); } catch{}
  };
  const t_ = (m,type="ok") => { setToast({m,type}); setTimeout(()=>setToast(null),2400); };

  const items = useMemo(()=>raw.map(enrich),[raw]);

  const openAdd  = ()    => setFormData({...BLANK});
  const openEdit = item  => setFormData({...item, price:item.price||"", qty:String(item.qty||1)});
  const close    = ()    => setFormData(null);

  const saveItem = data => {
    if (data.id) { setRaw(p=>p.map(i=>i.id===data.id?{...i,...data}:i)); t_("Perubahan disimpan"); }
    else          { setRaw(p=>[{...data,id:Date.now(),markedDown:false},...p]); t_("Barang ditambahkan"); }
    close();
  };

  const onMd  = (id, pct) => {
    setRaw(p=>p.map(i=>{
      if (i.id!==id) return i;
      const next = !i.markedDown;
      return { ...i, markedDown:next, lastMdPct: next ? (pct||0) : null };
    }));
    t_("Status markdown diperbarui");
  };
  const onQty = (id,v)=>{ setRaw(p=>p.map(i=>i.id===id?{...i,qty:v}:i)); };
  const onPull= (id, name) => {
    if (!confirm(`Tarik "${name}" dari rak?\n\nBarang akan dipindah ke riwayat dan tidak muncul di board lagi.`)) return;
    setRaw(p=>p.map(i=>i.id===id?{...i,pulled:true,pulledAt:new Date().toISOString()}:i));
    t_("Ditandai sudah ditarik");
  };
  const onRet = (id, name) => {
    const alasan = prompt(`Alasan retur "${name}":\n(opsional, tekan OK untuk skip)`);
    if (alasan === null) return; // cancel/batal
    setRaw(p=>p.map(i=>i.id===id?{...i,returned:true,returnedAt:new Date().toISOString(),returNote:alasan||""}:i));
    t_("Ditandai sudah diretur");
  };

  const onBatalRetur = id => {
    if (!confirm("Batalkan retur barang ini?")) return;
    setRaw(p=>p.map(i=>i.id===id?{...i,returned:false,returnedAt:null,returNote:""}:i));
    t_("Retur dibatalkan");
  };
  const onDel = id  => { if(!confirm("Hapus barang ini?"))return; setRaw(p=>p.filter(i=>i.id!==id)); t_("Barang dihapus"); };

  const cardProps = { onMd, onQty, onPull, onRet, onBatalRetur, onEdit:openEdit, onDel };

  // Handle widget tap → switch to "all" tab with correct filter
  const handleWidgetNav = (type, urgLevel) => {
    setTab("all");
    setFilterG(null); setFilterS(null);
    setFilterType("all");
    if (type.startsWith("gondola_")) {
      // Filter by gondola
      const g = type.replace("gondola_", "");
      setFilterG(g); setFilterS(null);
      setPhaseF("all");
    } else if (type === "all" && urgLevel) {
      // Kritis — filter urgency level >= 3
      setPhaseF("all");
      setSortBy("urgency");
    } else {
      setPhaseF(type);
      setSortBy("urgency");
    }
  };
  const handleGondolaFilter = (g, s) => { setFilterG(g); setFilterS(s); setTab("all"); };

  const visible = useMemo(()=>{
    let arr = items;
    if (search) { const q=search.toLowerCase(); arr=arr.filter(i=>i.name.toLowerCase().includes(q)||i.barcode.toLowerCase().includes(q)||(i.section||"").toLowerCase().includes(q)); }
    if (filterType==="lokal") arr=arr.filter(i=>!i.isImport);
    if (filterType==="impor") arr=arr.filter(i=>i.isImport);
    if (filterG!==null) arr=arr.filter(i=>i.gondola===filterG);
    if (filterS!==null) arr=arr.filter(i=>i.section===filterS);
    if (phaseF!=="all")  arr=arr.filter(i=>i.phase===phaseF);
    // Auto arsip: expired lebih dari 7 hari yang lalu tidak tampil di board (kecuali tab arsip)
    if (tab!=="arsip") arr=arr.filter(i=>!(i.days < -7));
    if (tab==="today")   arr=arr.filter(i=>i.urg.level>=1);
    return [...arr].sort((a,b)=>{
      if (sortBy==="urgency") return b.urg.level-a.urg.level||a.days-b.days;
      if (sortBy==="exp")     return a.days-b.days;
      if (sortBy==="qty")     return a.qty-b.qty;
      if (sortBy==="gondola") return (a.gondola||"Z").localeCompare(b.gondola||"Z")||(a.section||"").localeCompare(b.section||"");
      return a.name.localeCompare(b.name);
    });
  },[items,search,filterType,filterG,filterS,phaseF,tab,sortBy]);

  const pc = useMemo(()=>({
    pending_md:items.filter(i=>i.phase==="pending_md").length,
    done_md:items.filter(i=>i.phase==="done_md").length,
    sold_out:items.filter(i=>i.phase==="sold_out").length,
    pull:items.filter(i=>i.phase==="pull").length,
    return:items.filter(i=>i.phase==="return").length,
    expired:items.filter(i=>i.phase==="expired").length,
    skip_md:items.filter(i=>i.skipMd).length, // retur items in markdown period
  }),[items]);

  const activeGLabel = filterG ? (filterS ? `${filterG} · ${filterS}` : `Gondola ${filterG}`) : null;

  return (
    <div onClick={()=>setShowMore(false)} style={{ minHeight:"100vh",background:C.bg,fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",color:C.text,paddingBottom:84,transition:"background .3s,color .3s" }}>
      {showSplash && <SplashScreen onDone={()=>setShowSplash(false)}/>}
      <style>{`
        @keyframes fi{from{opacity:0;transform:translateX(-50%) translateY(-8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
        *{box-sizing:border-box} input,button,select{outline:none;font-family:inherit}
        ::-webkit-scrollbar{width:3px;height:3px} ::-webkit-scrollbar-thumb{background:${C.line};border-radius:2px}
        button{-webkit-tap-highlight-color:transparent}
        input[type=date]::-webkit-calendar-picker-indicator{filter:${isDark?"invert(.6)":"invert(0)"}}
        ::placeholder{color:${C.faint}}
      `}</style>

      {toast && (
        <div style={{ position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",zIndex:999,background:toast.type==="err"?"#3F1419":"#0F2920",color:toast.type==="err"?C.rose:C.green,border:`1px solid ${toast.type==="err"?C.roseBorder:C.greenBorder}`,padding:"9px 18px",borderRadius:20,fontSize:12.5,fontWeight:600,animation:"fi .2s",whiteSpace:"nowrap" }}>
          {toast.m}
        </div>
      )}

      {formData && <FormModal initial={formData} onSave={saveItem} onClose={close} allItems={raw}/>}

      {/* ── Header ── */}
      <div style={{ background:isDark?"rgba(8,11,18,.95)":"rgba(248,250,252,.95)",backdropFilter:"blur(16px)",borderBottom:`1px solid ${C.line}`,padding:"14px 16px",position:"sticky",top:0,zIndex:100 }}>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:12 }}>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <div style={{ width:36,height:36,background:C.accentDim,border:`1px solid ${C.accentBorder}`,borderRadius:11,display:"flex",alignItems:"center",justifyContent:"center",color:C.accent,flexShrink:0 }}>{Ic.bag}</div>
            <div>
              <div style={{ fontWeight:700,fontSize:15.5,letterSpacing:"-.3px" }}>ExpTracker</div>
              <div style={{ fontSize:10,color:C.faint }}>Gondola A · B · C · D</div>
            </div>
          </div>
          <div style={{ display:"flex", gap:7 }}>
            <button onClick={toggleTheme} style={{ background:C.cardHi,border:`1px solid ${C.line}`,color:C.sub,width:38,height:38,borderRadius:11,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0 }}>
              {isDark?"☀️":"🌙"}
            </button>
            <button onClick={openAdd} style={{ background:C.accent,border:"none",color:isDark?"#08090D":"#fff",padding:"9px 15px",borderRadius:11,fontWeight:700,fontSize:13,display:"flex",alignItems:"center",gap:5,cursor:"pointer" }}>
              {Ic.plus} Tambah
            </button>
          </div>
        </div>
        <div style={{ display:"flex",gap:3,background:C.cardHi,borderRadius:11,padding:3 }}>
          {[{k:"today",l:"Hari ini"},{k:"gondola",l:"Gondola"},{k:"all",l:"Semua"},{k:"laporan",l:"Laporan"},{k:"catatan",l:"📋 Catat"}].map(t=>(
            <button key={t.k} onClick={()=>{ setTab(t.k); if(t.k!=="all"){ setFilterG(null); setFilterS(null); } }} style={{ flex:1,background:tab===t.k?C.accent:"transparent",border:"none",color:tab===t.k?"#08090D":C.sub,padding:"7px 0",borderRadius:8,fontSize:12,fontWeight:700 }}>{t.l}</button>
          ))}
        </div>
      </div>

      <div style={{ padding:"14px 14px 0" }}>

        {tab==="gondola" && <GondolaMapView items={items} onFilter={handleGondolaFilter}/>}
        {tab==="catatan" && <CatatanView items={raw.map(enrich)} onEdit={openEdit}/>}
        {tab==="laporan" && <LaporanView items={raw} onBatalRetur={onBatalRetur}/>}

        {(tab==="today"||tab==="all") && (
          <>
            {tab==="today" && <><QuickWidget items={items} onNavigate={handleWidgetNav}/><DailyHero items={items}/></> }

            {activeGLabel && (
              <div style={{ display:"flex",alignItems:"center",gap:8,background:C.accentDim,border:`1px solid ${C.accentBorder}`,borderRadius:11,padding:"8px 12px",marginBottom:11 }}>
                <span style={{ color:C.accent }}>{Ic.pin}</span>
                <span style={{ fontSize:12,color:C.accent,fontWeight:700 }}>{activeGLabel}</span>
                <button onClick={()=>{setFilterG(null);setFilterS(null);}} style={{ marginLeft:"auto",background:"none",border:"none",color:C.faint,cursor:"pointer",fontSize:15,lineHeight:1 }}>{Ic.close}</button>
              </div>
            )}

            <div style={{ position:"relative",marginBottom:10 }}>
              <div style={{ position:"absolute",left:13,top:"50%",transform:"translateY(-50%)",color:C.faint,pointerEvents:"none" }}>{Ic.search}</div>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari nama, barcode, atau sub-bagian" style={{ width:"100%",background:C.card,border:`1px solid ${C.line}`,borderRadius:11,padding:"10px 13px 10px 36px",color:C.text,fontSize:13 }}/>
            </div>

            <div style={{ display:"flex",gap:6,marginBottom:8,overflowX:"auto",paddingBottom:2 }}>
              <button onClick={()=>{setFilterG(null);setFilterS(null);}} style={{ background:!filterG?C.accent:C.card,border:`1px solid ${!filterG?C.accent:C.line}`,color:!filterG?"#08090D":C.sub,padding:"6px 12px",borderRadius:20,fontSize:11.5,fontWeight:700,whiteSpace:"nowrap",flexShrink:0,cursor:"pointer" }}>
                Semua gondola
              </button>
              {Object.entries(GONDOLAS).map(([k,g])=>{
                const cnt = items.filter(i=>i.gondola===k).length;
                const urgCnt = items.filter(i=>i.gondola===k&&i.urg.level>=2).length;
                return (
                  <button key={k} onClick={()=>{setFilterG(k);setFilterS(null);}} style={{ background:filterG===k?g.dim:C.card,border:`1px solid ${filterG===k?g.border:C.line}`,color:filterG===k?g.color:C.sub,padding:"6px 12px",borderRadius:20,fontSize:11.5,fontWeight:700,whiteSpace:"nowrap",flexShrink:0,cursor:"pointer",display:"flex",alignItems:"center",gap:6 }}>
                    {k}
                    {cnt>0&&<span style={{ opacity:.7 }}>{cnt}</span>}
                    {urgCnt>0&&<span style={{ width:5,height:5,borderRadius:3,background:C.rose }}/>}
                  </button>
                );
              })}
            </div>

            {filterG && (
              <div style={{ display:"flex",gap:6,marginBottom:8,overflowX:"auto",paddingBottom:2 }}>
                <button onClick={()=>setFilterS(null)} style={{ background:!filterS?C.cardHi:"transparent",border:"none",color:!filterS?C.text:C.faint,padding:"4px 11px",borderRadius:16,fontSize:11,fontWeight:600,whiteSpace:"nowrap",flexShrink:0,cursor:"pointer" }}>
                  Semua {filterG}
                </button>
                {SECTIONS[filterG].map(s=>{
                  const cnt=items.filter(i=>i.gondola===filterG&&i.section===s).length;
                  const g=GONDOLAS[filterG];
                  return (
                    <button key={s} onClick={()=>setFilterS(s)} style={{ background:filterS===s?g.dim:"transparent",border:`1px solid ${filterS===s?g.border:"transparent"}`,color:filterS===s?g.color:C.faint,padding:"4px 11px",borderRadius:16,fontSize:11,fontWeight:600,whiteSpace:"nowrap",flexShrink:0,cursor:"pointer" }}>
                      {s}{cnt>0&&` ${cnt}`}
                    </button>
                  );
                })}
              </div>
            )}

            <div style={{ display:"flex",gap:6,overflowX:"auto",marginBottom:10,paddingBottom:2 }}>
              {[{k:"all",l:"Semua tipe"},{k:"lokal",l:"Lokal"},{k:"impor",l:"Impor"}].map(f=>(
                <button key={f.k} onClick={()=>setFilterType(f.k)} style={{ background:filterType===f.k?C.cardHi:"transparent",border:"none",color:filterType===f.k?C.text:C.faint,padding:"4px 11px",borderRadius:16,fontSize:10.5,fontWeight:600,whiteSpace:"nowrap",flexShrink:0,cursor:"pointer" }}>{f.l}</button>
              ))}
              <div style={{ width:1,background:C.line,flexShrink:0,margin:"2px 2px" }}/>
              {[{k:"all",l:"Semua fase"},{k:"pending_md",l:`Antrian ${pc.pending_md}`},{k:"done_md",l:`Sudah MD ${pc.done_md}`},{k:"sold_out",l:`Habis ${pc.sold_out}`},{k:"pull",l:`Tarik ${pc.pull}`},{k:"return",l:`Retur ${pc.return}`},{k:"expired",l:`Expired ${pc.expired}`}].map(f=>(
                <button key={f.k} onClick={()=>setPhaseF(f.k)} style={{ background:phaseF===f.k?C.cardHi:"transparent",border:"none",color:phaseF===f.k?C.text:C.faint,padding:"4px 11px",borderRadius:16,fontSize:10.5,fontWeight:600,whiteSpace:"nowrap",flexShrink:0,cursor:"pointer" }}>{f.l}</button>
              ))}
            </div>

            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10 }}>
              <span style={{ fontSize:11,color:C.faint }}>{visible.length} barang</span>
              <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{ background:C.card,border:`1px solid ${C.line}`,borderRadius:8,padding:"5px 9px",color:C.sub,fontSize:11,cursor:"pointer" }}>
                <option value="urgency">Prioritas</option>
                <option value="exp">Exp terdekat</option>
                <option value="gondola">Gondola A→D</option>
                <option value="qty">Stok terendah</option>
                <option value="name">Nama A-Z</option>
              </select>
            </div>

            {visible.length===0 ? (
              <div style={{ textAlign:"center",padding:"60px 20px",background:C.card,borderRadius:16,border:`1px dashed ${C.line}` }}>
                <div style={{ color:C.faint,fontSize:13 }}>
                  {tab==="today"?"Semua gondola aman hari ini":raw.length===0?"Belum ada barang — ketuk Tambah untuk mulai":"Tidak ada hasil"}
                </div>
              </div>
            ) : (
              <div style={{ display:"flex",flexDirection:"column",gap:9 }}>
                {visible.map(item=><ActionCard key={item.id} item={item} {...cardProps}/>)}
              </div>
            )}
          </>
        )}
      </div>

      {!formData && (
        <button onClick={openAdd} style={{ position:"fixed",bottom:22,right:16,zIndex:200,width:54,height:54,borderRadius:27,background:C.accent,border:"none",color:"#08090D",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 8px 24px rgba(129,140,248,.35)",cursor:"pointer" }}>
          {Ic.plus}
        </button>
      )}
    </div>
  );
}
