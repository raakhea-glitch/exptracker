import { useState, useEffect, useMemo } from "react";

// ─── Gondola config — bisa disesuaikan ───────────────────────────────────────
const GONDOLAS = {
  A: { label:"Gondola A", color:"#6366F1", dim:"rgba(99,102,241,.15)",  border:"rgba(99,102,241,.4)",  icon:"🅰️" },
  B: { label:"Gondola B", color:"#0EA5E9", dim:"rgba(14,165,233,.15)",  border:"rgba(14,165,233,.4)",  icon:"🅱️" },
  C: { label:"Gondola C", color:"#10B981", dim:"rgba(16,185,129,.15)",  border:"rgba(16,185,129,.4)",  icon:"🇨" },
  D: { label:"Gondola D", color:"#F59E0B", dim:"rgba(245,158,11,.15)",  border:"rgba(245,158,11,.4)",  icon:"🇩" },
};

// Sub-bagian tiap gondola (bisa ditambah/ubah di sini)
const SECTIONS = {
  A: ["A1","A2","A3","A4","A5","A6"],
  B: ["B1","B2","B3","B4","B5","B6"],
  C: ["C1","C2","C3","C4","C5","C6"],
  D: ["D1","D2","D3","D4","D5","D6"],
};

// Semua lokasi flat untuk autocomplete
const ALL_LOCATIONS = Object.entries(SECTIONS).flatMap(([g, secs]) =>
  secs.map(s => ({ gondola: g, section: s, label: `${GONDOLAS[g].label} › ${s}` }))
);

// ─── Business Logic ──────────────────────────────────────────────────────────
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
  if (days < 0)  return { level:5, tag:"EXPIRED",  color:"#6B7280" };
  if (days <= 3)  return { level:4, tag:"KRITIS",   color:"#EF4444" };
  if (days <= 7)  return { level:3, tag:"TARIK",    color:"#F97316" };
  if (days <= 30) return { level:2, tag:"MARKDOWN", color:"#EAB308" };
  if (days <= 90) return { level:1, tag:"PANTAU",   color:"#3B82F6" };
  return               { level:0, tag:"AMAN",     color:"#10B981" };
}
function enrich(item) {
  const days = getDays(item.expDate);
  const md   = getMd(days, item.isImport);
  const urg  = getUrgency(days);
  const qty  = parseInt(item.qty)||0;
  const orig = parseFloat(item.price)||0;
  const effRetur = md.noRetur ? false : item.canReturn;
  let phase = "normal";
  if (days < 0)                       phase = effRetur ? "return" : "expired";
  else if (days <= 7)                 phase = "pull";
  else if (item.markedDown && qty===0)phase = "sold_out";
  else if (item.markedDown)           phase = "done_md";
  else if (md.pct > 0)                phase = "pending_md";
  return { ...item, days, md, urg, phase, qty, orig, effRetur,
    disc: orig>0 ? orig*(1-md.pct/100) : 0 };
}

// ─── Storage ──────────────────────────────────────────────────────────────────
const SK = "expt_v7";
const load    = () => { try { return JSON.parse(localStorage.getItem(SK)||"[]"); } catch { return []; } };
const persist = d  => { try { localStorage.setItem(SK, JSON.stringify(d)); } catch {} };

// ─── Utils ────────────────────────────────────────────────────────────────────
const fmtRp = n => "Rp "+Number(n).toLocaleString("id-ID");
const fmtD  = d => new Date(d).toLocaleDateString("id-ID",{day:"numeric",month:"short"});
const todayStr = () => new Date().toLocaleDateString("id-ID",{weekday:"long",day:"numeric",month:"long"});

// ─── Colors ───────────────────────────────────────────────────────────────────
const C = {
  red:C2="#EF4444", redD:"rgba(239,68,68,.12)", redB:"rgba(239,68,68,.3)",
  or:"#F97316", orD:"rgba(249,115,22,.12)", orB:"rgba(249,115,22,.3)",
  yl:"#EAB308", ylD:"rgba(234,179,8,.12)",  ylB:"rgba(234,179,8,.3)",
  bl:"#3B82F6", blD:"rgba(59,130,246,.12)", blB:"rgba(59,130,246,.3)",
  gr:"#10B981", grD:"rgba(16,185,129,.12)", grB:"rgba(16,185,129,.3)",
  pu:"#8B5CF6", puD:"rgba(139,92,246,.12)", puB:"rgba(139,92,246,.3)",
  sl:"#64748B", slD:"rgba(100,116,139,.1)", slB:"rgba(100,116,139,.25)",
  base:"#0B1120", card:"rgba(15,23,40,.95)", bd:"rgba(255,255,255,.07)",
};
const MDC = {
  md30:{ t:C.yl, d:C.ylD, b:C.ylB },
  md50:{ t:C.or, d:C.orD, b:C.orB },
  md70:{ t:"#EF4444", d:"rgba(239,68,68,.12)", b:"rgba(239,68,68,.3)" },
};

// ─── Icons ────────────────────────────────────────────────────────────────────
const Ic = {
  plus:   <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  search: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  trash:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg>,
  edit:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  check:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>,
  alert:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  tag:    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
  ret:    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>,
  chart:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  pin:    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  close:  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  home:   <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  globe:  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
  map:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>,
};

// ─── Micro components ─────────────────────────────────────────────────────────
function Pill({ ch, color, dim, bdr }) {
  return <span style={{ background:dim,color,border:`1px solid ${bdr}`,borderRadius:20,padding:"2px 8px",fontSize:10,fontWeight:700,display:"inline-flex",alignItems:"center",gap:3,whiteSpace:"nowrap",flexShrink:0 }}>{ch}</span>;
}

// Gondola location badge
function LocBadge({ gondola, section }) {
  if (!gondola) return null;
  const g = GONDOLAS[gondola];
  return (
    <span style={{ background:g.dim,color:g.color,border:`1px solid ${g.border}`,borderRadius:6,padding:"2px 7px",fontSize:10,fontWeight:800,display:"inline-flex",alignItems:"center",gap:3,flexShrink:0,letterSpacing:".3px" }}>
      {Ic.pin} {section||gondola}
    </span>
  );
}

function Toggle({ on, onChange, disabled }) {
  return (
    <div onClick={()=>!disabled&&onChange(!on)} style={{ width:38,height:21,borderRadius:11,position:"relative",cursor:disabled?"default":"pointer",background:on?"#8B5CF6":"rgba(255,255,255,.1)",transition:"background .2s",opacity:disabled?.45:1,flexShrink:0 }}>
      <div style={{ width:15,height:15,borderRadius:8,background:"#fff",position:"absolute",top:3,left:on?20:3,transition:"left .2s" }}/>
    </div>
  );
}

function QtyPicker({ qty, onChange }) {
  const q = parseInt(qty)||0;
  const b = (l,fn) => <button onClick={fn} style={{ width:32,height:32,borderRadius:7,background:"rgba(255,255,255,.07)",border:"1px solid rgba(255,255,255,.1)",color:"#E2E8F0",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>{l}</button>;
  return (
    <div style={{ display:"flex",alignItems:"center",gap:8 }}>
      {b("−",()=>onChange(Math.max(0,q-1)))}
      <div style={{ minWidth:36,textAlign:"center",fontSize:16,fontWeight:800,color:q===0?"#EF4444":"#F1F5F9" }}>{q}</div>
      {b("+",()=>onChange(q+1))}
    </div>
  );
}

// ─── Gondola Picker component ─────────────────────────────────────────────────
function GondolaPicker({ gondola, section, onChange }) {
  return (
    <div>
      <div style={{ fontSize:10,color:"#475569",fontWeight:700,marginBottom:6 }}>LOKASI GONDOLA</div>
      {/* Gondola selector */}
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:8 }}>
        {Object.entries(GONDOLAS).map(([key,g])=>(
          <div key={key} onClick={()=>onChange(key, SECTIONS[key][0])} style={{ padding:"8px 4px",borderRadius:9,border:`2px solid ${gondola===key?g.color:"rgba(255,255,255,.07)"}`,background:gondola===key?g.dim:"rgba(255,255,255,.02)",cursor:"pointer",textAlign:"center" }}>
            <div style={{ fontSize:16,marginBottom:2 }}>{g.icon}</div>
            <div style={{ fontSize:11,fontWeight:800,color:gondola===key?g.color:"#475569" }}>{key}</div>
          </div>
        ))}
      </div>
      {/* Section selector — only when gondola picked */}
      {gondola && (
        <div>
          <div style={{ fontSize:10,color:"#475569",marginBottom:5 }}>SUB-BAGIAN {gondola}</div>
          <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
            {SECTIONS[gondola].map(s=>{
              const g = GONDOLAS[gondola];
              return (
                <div key={s} onClick={()=>onChange(gondola,s)} style={{ padding:"5px 12px",borderRadius:8,border:`1px solid ${section===s?g.color:"rgba(255,255,255,.1)"}`,background:section===s?g.dim:"rgba(255,255,255,.03)",cursor:"pointer",fontSize:12,fontWeight:700,color:section===s?g.color:"#64748B" }}>
                  {s}
                </div>
              );
            })}
            <div onClick={()=>onChange(gondola,null)} style={{ padding:"5px 12px",borderRadius:8,border:`1px solid ${!section?"rgba(255,255,255,.25)":"rgba(255,255,255,.07)"}`,background:"rgba(255,255,255,.03)",cursor:"pointer",fontSize:12,color:"#475569" }}>
              Semua {gondola}
            </div>
          </div>
        </div>
      )}
      {!gondola && (
        <div style={{ fontSize:11,color:"#334155",textAlign:"center",padding:"6px",background:"rgba(255,255,255,.02)",borderRadius:8 }}>
          Pilih gondola di atas
        </div>
      )}
    </div>
  );
}

// ─── Gondola Map View ─────────────────────────────────────────────────────────
function GondolaMapView({ items, onFilter }) {
  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ fontWeight:800,fontSize:12,color:"#94A3B8",marginBottom:10,display:"flex",alignItems:"center",gap:6 }}>
        {Ic.map} PETA GONDOLA
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
        {Object.entries(GONDOLAS).map(([gKey,g])=>{
          const gItems = items.filter(i=>i.gondola===gKey);
          const urgent = gItems.filter(i=>i.urg.level>=2);
          const sections = SECTIONS[gKey];

          return (
            <div key={gKey} style={{ background:C.card,border:`1px solid ${g.border}`,borderRadius:12,overflow:"hidden" }}>
              {/* Gondola header */}
              <div style={{ background:g.dim,borderBottom:`1px solid ${g.border}`,padding:"8px 11px",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
                <div style={{ display:"flex",alignItems:"center",gap:7 }}>
                  <span style={{ fontSize:16 }}>{g.icon}</span>
                  <span style={{ fontWeight:800,fontSize:13,color:g.color }}>{g.label}</span>
                </div>
                <div style={{ display:"flex",gap:5,alignItems:"center" }}>
                  {urgent.length>0 && (
                    <span style={{ background:"rgba(239,68,68,.2)",color:"#EF4444",border:"1px solid rgba(239,68,68,.35)",borderRadius:12,padding:"1px 7px",fontSize:10,fontWeight:800 }}>
                      {Ic.alert} {urgent.length}
                    </span>
                  )}
                  <span style={{ background:g.dim,color:g.color,borderRadius:12,padding:"1px 7px",fontSize:10,fontWeight:700 }}>
                    {gItems.length} item
                  </span>
                </div>
              </div>

              {/* Sub sections */}
              <div style={{ padding:"8px 10px",display:"flex",flexDirection:"column",gap:4 }}>
                {sections.map(sec=>{
                  const sItems = gItems.filter(i=>i.section===sec);
                  const sUrgent = sItems.filter(i=>i.urg.level>=2);
                  const hasKritis = sItems.some(i=>i.urg.level>=3);
                  if (sItems.length===0) return (
                    <div key={sec} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"4px 8px",borderRadius:6,background:"rgba(255,255,255,.02)" }}>
                      <span style={{ fontSize:11,fontWeight:700,color:"#1E2D42" }}>{sec}</span>
                      <span style={{ fontSize:10,color:"#1E2D42" }}>—</span>
                    </div>
                  );
                  return (
                    <div key={sec} onClick={()=>onFilter(gKey,sec)} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"5px 8px",borderRadius:7,background:hasKritis?"rgba(239,68,68,.07)":sUrgent.length>0?"rgba(234,179,8,.06)":"rgba(255,255,255,.03)",border:`1px solid ${hasKritis?"rgba(239,68,68,.2)":sUrgent.length>0?"rgba(234,179,8,.15)":"rgba(255,255,255,.06)"}`,cursor:"pointer" }}>
                      <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                        <span style={{ fontSize:11,fontWeight:800,color:g.color }}>{sec}</span>
                        {hasKritis && <span style={{ fontSize:9,color:"#EF4444",fontWeight:700 }}>KRITIS</span>}
                        {!hasKritis && sUrgent.length>0 && <span style={{ fontSize:9,color:"#EAB308",fontWeight:700 }}>PANTAU</span>}
                      </div>
                      <div style={{ display:"flex",alignItems:"center",gap:5 }}>
                        {sUrgent.length>0 && (
                          <span style={{ fontSize:10,color:hasKritis?"#EF4444":"#EAB308",fontWeight:800 }}>⚠️{sUrgent.length}</span>
                        )}
                        <span style={{ fontSize:10,color:"#475569" }}>{sItems.length} item</span>
                        <span style={{ fontSize:10,color:"#334155" }}>›</span>
                      </div>
                    </div>
                  );
                })}
                {/* Items tanpa section */}
                {gItems.filter(i=>!i.section).length>0 && (
                  <div onClick={()=>onFilter(gKey,null)} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"5px 8px",borderRadius:7,background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",cursor:"pointer" }}>
                    <span style={{ fontSize:11,color:"#334155" }}>Tanpa sub-bagian</span>
                    <span style={{ fontSize:10,color:"#475569" }}>{gItems.filter(i=>!i.section).length} item ›</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {/* Items tanpa gondola */}
      {items.filter(i=>!i.gondola).length>0 && (
        <div onClick={()=>onFilter(null,null)} style={{ marginTop:8,background:C.card,border:`1px solid ${C.bd}`,borderRadius:10,padding:"9px 12px",display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer" }}>
          <span style={{ fontSize:12,color:"#475569" }}>📦 Belum ada lokasi gondola</span>
          <span style={{ fontSize:11,color:"#334155" }}>{items.filter(i=>!i.gondola).length} item ›</span>
        </div>
      )}
    </div>
  );
}

// ─── Daily Hero ───────────────────────────────────────────────────────────────
function DailyHero({ items }) {
  const actions = [
    items.filter(i=>i.urg.level>=3).length && { icon:"🚨", txt:`${items.filter(i=>i.urg.level>=3).length} barang kritis / siap tarik`, col:"#EF4444", bg:"rgba(239,68,68,.1)" },
    items.filter(i=>i.phase==="pending_md").length && { icon:"🏷️", txt:`${items.filter(i=>i.phase==="pending_md").length} barang perlu dimarkdown`, col:"#EAB308", bg:"rgba(234,179,8,.1)" },
    items.filter(i=>i.phase==="sold_out").length && { icon:"🎉", txt:`${items.filter(i=>i.phase==="sold_out").length} markdown habis terjual`, col:"#F97316", bg:"rgba(249,115,22,.1)" },
    items.filter(i=>i.days<0).length && { icon:"💀", txt:`${items.filter(i=>i.days<0).length} barang expired`, col:"#64748B", bg:"rgba(100,116,139,.1)" },
  ].filter(Boolean);

  if (!actions.length) return (
    <div style={{ background:"rgba(16,185,129,.08)",border:"1px solid rgba(16,185,129,.25)",borderRadius:13,padding:"13px 14px",marginBottom:12,display:"flex",alignItems:"center",gap:12 }}>
      <div style={{ fontSize:26 }}>✅</div>
      <div>
        <div style={{ fontWeight:800,fontSize:13,color:"#10B981" }}>Semua Gondola Aman!</div>
        <div style={{ fontSize:11,color:"#475569",marginTop:1 }}>{todayStr()}</div>
      </div>
    </div>
  );

  return (
    <div style={{ background:"rgba(239,68,68,.06)",border:"1px solid rgba(239,68,68,.25)",borderRadius:13,padding:"11px 13px",marginBottom:12 }}>
      <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:9 }}>
        {Ic.alert}
        <span style={{ fontWeight:800,fontSize:12,color:"#EF4444" }}>PERLU TINDAKAN HARI INI</span>
        <span style={{ fontSize:10,color:"#334155",marginLeft:"auto" }}>{todayStr()}</span>
      </div>
      <div style={{ display:"flex",flexDirection:"column",gap:5 }}>
        {actions.map((a,i)=>(
          <div key={i} style={{ display:"flex",alignItems:"center",gap:8,background:a.bg,borderRadius:8,padding:"6px 10px" }}>
            <span style={{ fontSize:15 }}>{a.icon}</span>
            <span style={{ fontSize:12,fontWeight:700,color:a.col }}>{a.txt}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Analytics ────────────────────────────────────────────────────────────────
function Analytics({ items }) {
  if (!items.length) return <div style={{ textAlign:"center",padding:40,color:"#1E2D42" }}>Tambahkan barang terlebih dahulu</div>;
  const totalVal = items.reduce((s,i)=>s+i.orig*i.qty,0);
  const mdLoss   = items.filter(i=>i.md.pct>0).reduce((s,i)=>s+(i.orig-i.disc)*i.qty,0);
  const bars = [
    { l:"Aman",    v:items.filter(i=>i.urg.level===0).length, c:"#10B981" },
    { l:"Pantau",  v:items.filter(i=>i.urg.level===1).length, c:"#3B82F6" },
    { l:"MD",      v:items.filter(i=>i.urg.level===2).length, c:"#EAB308" },
    { l:"Kritis",  v:items.filter(i=>i.urg.level>=3&&i.urg.level<5).length, c:"#EF4444" },
    { l:"Expired", v:items.filter(i=>i.days<0).length,        c:"#64748B" },
  ];

  // Gondola breakdown
  const gBreak = Object.entries(GONDOLAS).map(([k,g])=>{
    const gi = items.filter(i=>i.gondola===k);
    const urgent = gi.filter(i=>i.urg.level>=2).length;
    return { k, g, total:gi.length, urgent };
  });

  return (
    <div>
      <div style={{ background:C.card,border:`1px solid ${C.bd}`,borderRadius:13,padding:"13px 14px",marginBottom:12 }}>
        <div style={{ fontWeight:800,fontSize:12,color:"#94A3B8",marginBottom:11,display:"flex",alignItems:"center",gap:6 }}>{Ic.chart} RINGKASAN STOK</div>
        <div style={{ display:"flex",borderRadius:5,overflow:"hidden",height:7,marginBottom:9,gap:1 }}>
          {bars.map(b=>b.v>0&&<div key={b.l} style={{ flex:b.v,background:b.c }}/>)}
        </div>
        <div style={{ display:"flex",gap:10,flexWrap:"wrap",marginBottom:12 }}>
          {bars.map(b=>(
            <div key={b.l} style={{ display:"flex",alignItems:"center",gap:4 }}>
              <div style={{ width:7,height:7,borderRadius:2,background:b.c }}/>
              <span style={{ fontSize:10,color:"#475569" }}>{b.l}</span>
              <span style={{ fontSize:10,fontWeight:700,color:b.c }}>{b.v}</span>
            </div>
          ))}
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8 }}>
          {[
            { l:"Total SKU",   v:items.length,     u:"item",   c:"#94A3B8" },
            { l:"Nilai Stok",  v:fmtRp(totalVal),  u:"",       c:"#3B82F6" },
            { l:"Potensi Loss",v:fmtRp(mdLoss),    u:"diskon", c:"#EF4444" },
          ].map(m=>(
            <div key={m.l} style={{ background:"rgba(255,255,255,.03)",borderRadius:9,padding:"8px 10px" }}>
              <div style={{ fontSize:9,color:"#334155",marginBottom:3 }}>{m.l}</div>
              <div style={{ fontSize:12,fontWeight:800,color:m.c,lineHeight:1.2 }}>{m.v}</div>
              {m.u&&<div style={{ fontSize:9,color:"#334155" }}>{m.u}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Per-gondola breakdown */}
      <div style={{ background:C.card,border:`1px solid ${C.bd}`,borderRadius:13,padding:"13px 14px",marginBottom:12 }}>
        <div style={{ fontWeight:800,fontSize:12,color:"#94A3B8",marginBottom:11,display:"flex",alignItems:"center",gap:6 }}>{Ic.map} PER GONDOLA</div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
          {gBreak.map(({k,g,total,urgent})=>(
            <div key={k} style={{ background:g.dim,border:`1px solid ${g.border}`,borderRadius:10,padding:"10px 12px" }}>
              <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:6 }}>
                <span style={{ fontSize:15 }}>{g.icon}</span>
                <span style={{ fontWeight:800,fontSize:13,color:g.color }}>{g.label}</span>
              </div>
              <div style={{ fontSize:18,fontWeight:900,color:g.color }}>{total}</div>
              <div style={{ fontSize:10,color:"#475569" }}>item</div>
              {urgent>0 && <div style={{ fontSize:10,color:"#EF4444",fontWeight:700,marginTop:4 }}>⚠️ {urgent} butuh perhatian</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Action Card ──────────────────────────────────────────────────────────────
function ActionCard({ item, onMd, onQty, onPull, onRet, onEdit, onDel }) {
  const [open, setOpen] = useState(false);
  const mdc = item.md.tier ? MDC[item.md.tier] : null;
  const urg = item.urg;
  const g   = item.gondola ? GONDOLAS[item.gondola] : null;

  return (
    <div style={{ background:C.card,border:`1px solid ${g?g.border:C.bd}`,borderRadius:12,overflow:"hidden",boxShadow:g?`0 0 12px ${g.dim}`:"0 2px 10px rgba(0,0,0,.3)" }}>
      {/* Urgency stripe */}
      <div style={{ borderLeft:`3px solid ${urg.color}`,background:`linear-gradient(90deg,${urg.color}18,transparent)`,padding:"10px 12px" }}>
        <div style={{ display:"flex",alignItems:"flex-start",gap:8 }}>
          {/* Main info */}
          <div style={{ flex:1,minWidth:0 }} onClick={()=>setOpen(x=>!x)}>
            {/* Badges row */}
            <div style={{ display:"flex",gap:4,flexWrap:"wrap",marginBottom:5 }}>
              <Pill ch={urg.tag} color={urg.color} dim={`${urg.color}20`} bdr={`${urg.color}40`}/>
              {item.gondola && <LocBadge gondola={item.gondola} section={item.section}/>}
              {mdc && <Pill ch={<>{Ic.tag} -{item.md.pct}%</>} color={mdc.t} dim={mdc.d} bdr={mdc.b}/>}
              <Pill ch={item.isImport?<>{Ic.globe} IMPOR</>:<>{Ic.home} LOKAL</>} color={item.isImport?C.pu:C.gr} dim={item.isImport?C.puD:C.grD} bdr={item.isImport?C.puB:C.grB}/>
            </div>
            <div style={{ fontWeight:700,fontSize:14,color:"#F1F5F9",lineHeight:1.3,marginBottom:2 }}>{item.name}</div>
            <div style={{ fontSize:10,color:"#334155",fontFamily:"monospace" }}>{item.barcode}</div>
          </div>

          {/* Days countdown */}
          <div onClick={()=>setOpen(x=>!x)} style={{ textAlign:"center",flexShrink:0,padding:"5px 10px",background:`${urg.color}15`,borderRadius:10,border:`1px solid ${urg.color}30`,minWidth:52 }}>
            <div style={{ fontSize:item.days<0||item.days>99?14:20,fontWeight:900,color:urg.color,lineHeight:1 }}>
              {item.days<0?"EXP":item.days}
            </div>
            {item.days>=0&&<div style={{ fontSize:8,color:"#475569",fontWeight:600,marginTop:2 }}>HARI</div>}
            {item.days>=0&&<div style={{ fontSize:9,color:"#334155",marginTop:1 }}>{fmtD(item.expDate)}</div>}
          </div>
        </div>

        {/* Inline metrics */}
        <div style={{ display:"flex",alignItems:"center",gap:8,marginTop:8,flexWrap:"wrap" }}>
          <div style={{ display:"flex",alignItems:"center",gap:6,background:"rgba(0,0,0,.25)",borderRadius:8,padding:"4px 8px" }}>
            <span style={{ fontSize:9,color:"#475569",fontWeight:600 }}>QTY</span>
            <QtyPicker qty={item.qty} onChange={v=>onQty(item.id,v)}/>
            {item.qty===0&&<span style={{ fontSize:10,color:"#EF4444",fontWeight:700 }}>HABIS</span>}
          </div>
          {item.orig>0&&(
            <div style={{ fontSize:11 }}>
              {item.md.pct>0
                ? <><span style={{ color:"#1E2D42",textDecoration:"line-through",fontSize:10 }}>{fmtRp(item.orig)}</span>{" "}<span style={{ color:mdc?.t,fontWeight:800 }}>{fmtRp(item.disc)}</span></>
                : <span style={{ color:"#475569" }}>{fmtRp(item.orig)}</span>
              }
            </div>
          )}
          <div style={{ marginLeft:"auto",color:"#334155",fontSize:16,cursor:"pointer" }} onClick={()=>setOpen(x=>!x)}>{open?"▲":"▼"}</div>
        </div>
      </div>

      {/* Expanded */}
      {open && (
        <div style={{ padding:"10px 12px",borderTop:`1px solid ${C.bd}`,background:"rgba(0,0,0,.2)",display:"flex",flexDirection:"column",gap:7 }}>
          {item.phase==="pending_md"&&(
            <button onClick={()=>onMd(item.id)} style={{ width:"100%",background:"linear-gradient(135deg,#6366F1,#8B5CF6)",border:"none",color:"#fff",padding:"9px",borderRadius:8,fontSize:13,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:6,cursor:"pointer" }}>
              {Ic.check} Ceklis Sudah Dimarkdown di Rak
            </button>
          )}
          {item.phase==="done_md"&&(
            <button onClick={()=>onMd(item.id)} style={{ width:"100%",background:"rgba(16,185,129,.12)",border:"1px solid rgba(16,185,129,.3)",color:"#10B981",padding:"8px",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer" }}>
              ↩ Batalkan Markdown
            </button>
          )}
          {item.phase==="sold_out"&&(
            <div style={{ background:"rgba(249,115,22,.08)",border:"1px solid rgba(249,115,22,.25)",borderRadius:8,padding:"7px 10px",fontSize:11,color:"#F97316",textAlign:"center" }}>
              🎉 Stok markdown habis terjual!
            </div>
          )}
          {item.phase==="pull"&&(
            <button onClick={()=>onPull(item.id)} style={{ width:"100%",background:"rgba(239,68,68,.13)",border:"1px solid rgba(239,68,68,.3)",color:"#EF4444",padding:"9px",borderRadius:8,fontSize:13,fontWeight:700,cursor:"pointer" }}>
              🚨 Tandai Sudah Ditarik dari Rak
            </button>
          )}
          {item.phase==="return"&&(
            <button onClick={()=>onRet(item.id)} style={{ width:"100%",background:"rgba(139,92,246,.12)",border:"1px solid rgba(139,92,246,.3)",color:"#8B5CF6",padding:"8px",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:5 }}>
              {Ic.ret} Proses Retur ke Supplier
            </button>
          )}
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:6 }}>
            <button onClick={()=>onEdit(item)} style={{ background:"rgba(99,102,241,.12)",border:"1px solid rgba(99,102,241,.26)",color:"#818CF8",padding:"7px",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:4 }}>
              {Ic.edit} Edit
            </button>
            <button onClick={()=>onDel(item.id)} style={{ background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.2)",color:"#EF4444",padding:"7px",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:4 }}>
              {Ic.trash} Hapus
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Form Modal ───────────────────────────────────────────────────────────────
function FormModal({ initial, onSave, onClose }) {
  const [f, setF] = useState(initial);
  const set = (k,v) => setF(p=>({...p,[k]:v}));
  const days   = f.expDate ? getDays(f.expDate) : null;
  const mdPrev = days!==null ? getMd(days, f.isImport) : null;

  const submit = () => {
    if (!f.barcode.trim()||!f.name.trim()||!f.expDate) return;
    onSave({ ...f, qty:parseInt(f.qty)||0, price:parseFloat(f.price)||0 });
  };

  return (
    <div style={{ position:"fixed",inset:0,zIndex:300,background:"rgba(0,0,0,.8)",display:"flex",alignItems:"flex-end" }}>
      <div style={{ width:"100%",maxHeight:"94vh",overflowY:"auto",background:"#0D1626",borderRadius:"16px 16px 0 0",padding:"16px 14px 36px" }}>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14 }}>
          <span style={{ fontWeight:800,fontSize:15 }}>{f.id?"✏️ Edit Barang":"➕ Tambah Barang"}</span>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,.08)",border:"none",color:"#94A3B8",width:30,height:30,borderRadius:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>{Ic.close}</button>
        </div>

        {/* Tipe Lokal/Impor */}
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:12 }}>
          {[{v:false,l:"🏠 Lokal",s:"Diskon 30–70%",c:C.gr},{v:true,l:"🌏 Impor",s:"Diskon 70% di H-30",c:C.pu}].map(t=>(
            <div key={t.v} onClick={()=>set("isImport",t.v)} style={{ padding:"8px 10px",borderRadius:9,border:`2px solid ${f.isImport===t.v?t.c:"rgba(255,255,255,.07)"}`,background:f.isImport===t.v?`${t.c}15`:"transparent",cursor:"pointer" }}>
              <div style={{ fontWeight:800,fontSize:12,color:f.isImport===t.v?t.c:"#475569" }}>{t.l}</div>
              <div style={{ fontSize:10,color:"#334155",marginTop:1 }}>{t.s}</div>
            </div>
          ))}
        </div>

        {/* Fields */}
        <div style={{ display:"grid",gap:9,marginBottom:10 }}>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:7 }}>
            <label style={{ fontSize:10,color:"#475569" }}>BARCODE *
              <input value={f.barcode} onChange={e=>set("barcode",e.target.value)} placeholder="Scan / ketik" style={{ display:"block",width:"100%",marginTop:4,background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",borderRadius:8,padding:"9px 10px",color:"#E2E8F0",fontSize:12,fontFamily:"monospace" }}/>
            </label>
            <label style={{ fontSize:10,color:"#475569" }}>TANGGAL EXP *
              <input type="date" value={f.expDate} onChange={e=>set("expDate",e.target.value)} style={{ display:"block",width:"100%",marginTop:4,background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",borderRadius:8,padding:"9px 10px",color:"#E2E8F0",fontSize:12,colorScheme:"dark" }}/>
            </label>
          </div>
          <label style={{ fontSize:10,color:"#475569" }}>NAMA BARANG *
            <input value={f.name} onChange={e=>set("name",e.target.value)} placeholder="Nama produk" style={{ display:"block",width:"100%",marginTop:4,background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",borderRadius:8,padding:"9px 10px",color:"#E2E8F0",fontSize:14 }}/>
          </label>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:7 }}>
            <label style={{ fontSize:10,color:"#475569" }}>HARGA NORMAL
              <input type="number" value={f.price} onChange={e=>set("price",e.target.value)} placeholder="0" style={{ display:"block",width:"100%",marginTop:4,background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",borderRadius:8,padding:"9px 10px",color:"#E2E8F0",fontSize:12 }}/>
            </label>
            <label style={{ fontSize:10,color:"#475569" }}>QTY / STOK
              <input type="number" value={f.qty} onChange={e=>set("qty",e.target.value)} min="0" placeholder="1" style={{ display:"block",width:"100%",marginTop:4,background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",borderRadius:8,padding:"9px 10px",color:"#E2E8F0",fontSize:12 }}/>
            </label>
          </div>

          {/* Gondola Picker */}
          <div style={{ background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.07)",borderRadius:10,padding:"11px 12px" }}>
            <GondolaPicker
              gondola={f.gondola||null}
              section={f.section||null}
              onChange={(g,s)=>setF(p=>({...p,gondola:g,section:s}))}
            />
          </div>

          {/* Retur toggle */}
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <Toggle on={mdPrev?.noRetur?false:f.canReturn} onChange={v=>set("canReturn",v)} disabled={!!mdPrev?.noRetur}/>
            <span style={{ fontSize:12,color:mdPrev?.noRetur?"#EF4444":f.canReturn?C.pu:"#475569",fontWeight:600 }}>
              {mdPrev?.noRetur?"❌ Tidak bisa retur (diskon 70%)":f.canReturn?"🔄 Bisa Retur":"❌ Tidak Bisa Retur"}
            </span>
          </div>

          {/* Diskon preview */}
          {mdPrev?.pct>0&&days!==null&&(
            <div style={{ background:MDC[mdPrev.tier].d,border:`1px solid ${MDC[mdPrev.tier].b}`,borderRadius:8,padding:"8px 11px",display:"flex",alignItems:"center",gap:7 }}>
              {Ic.tag}
              <span style={{ fontSize:12,color:MDC[mdPrev.tier].t,fontWeight:800 }}>
                Otomatis: Diskon {mdPrev.pct}%
                {f.price>0&&` → ${fmtRp(f.price*(1-mdPrev.pct/100))}`}
              </span>
            </div>
          )}
        </div>

        <div style={{ display:"grid",gridTemplateColumns:"1fr auto",gap:7 }}>
          <button onClick={submit} style={{ background:"linear-gradient(135deg,#6366F1,#8B5CF6)",border:"none",color:"#fff",padding:11,borderRadius:9,fontWeight:700,fontSize:13,cursor:"pointer" }}>
            {f.id?"💾 Simpan":"✅ Tambah Barang"}
          </button>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.08)",color:"#475569",padding:"11px 14px",borderRadius:9,fontSize:13,cursor:"pointer" }}>
            {Ic.close}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
const BLANK = { barcode:"",name:"",expDate:"",canReturn:true,isImport:false,price:"",qty:"1",gondola:null,section:null };

export default function App() {
  const [raw,      setRaw]      = useState(load);
  const [formData, setFormData] = useState(null);
  const [search,   setSearch]   = useState("");
  const [tab,      setTab]      = useState("today");   // today | all | gondola | analytics
  const [filterG,  setFilterG]  = useState(null);      // gondola key filter
  const [filterS,  setFilterS]  = useState(null);      // section filter
  const [filterType,setFilterType]=useState("all");
  const [phaseF,   setPhaseF]   = useState("all");
  const [sortBy,   setSortBy]   = useState("urgency");
  const [toast,    setToast]    = useState(null);

  useEffect(()=>persist(raw),[raw]);
  const t_ = (m,type="ok") => { setToast({m,type}); setTimeout(()=>setToast(null),2500); };

  const items = useMemo(()=>raw.map(enrich),[raw]);

  const openAdd  = ()    => setFormData({...BLANK});
  const openEdit = item  => setFormData({...item, price:item.price||"", qty:String(item.qty||1)});
  const close    = ()    => setFormData(null);

  const saveItem = data => {
    if (data.id) { setRaw(p=>p.map(i=>i.id===data.id?{...i,...data}:i)); t_("Diupdate ✅"); }
    else          { setRaw(p=>[{...data,id:Date.now(),markedDown:false},...p]); t_("Ditambahkan ✅"); }
    close();
  };

  const onMd  = id  => { setRaw(p=>p.map(i=>i.id===id?{...i,markedDown:!i.markedDown}:i)); t_("Status MD diupdate"); };
  const onQty = (id,v)=>{ setRaw(p=>p.map(i=>i.id===id?{...i,qty:v}:i)); };
  const onPull= id  => { setRaw(p=>p.map(i=>i.id===id?{...i,pulled:true}:i)); t_("✅ Sudah ditarik"); };
  const onRet = id  => { setRaw(p=>p.map(i=>i.id===id?{...i,returned:true}:i)); t_("✅ Sudah diretur"); };
  const onDel = id  => { if(!confirm("Hapus?"))return; setRaw(p=>p.filter(i=>i.id!==id)); t_("Dihapus"); };

  const cardProps = { onMd, onQty, onPull, onRet, onEdit:openEdit, onDel };

  const handleGondolaFilter = (g, s) => { setFilterG(g); setFilterS(s); setTab("all"); };

  const visible = useMemo(()=>{
    let arr = items;
    if (search) { const q=search.toLowerCase(); arr=arr.filter(i=>i.name.toLowerCase().includes(q)||i.barcode.toLowerCase().includes(q)||(i.section||"").toLowerCase().includes(q)); }
    if (filterType==="lokal") arr=arr.filter(i=>!i.isImport);
    if (filterType==="impor") arr=arr.filter(i=>i.isImport);
    if (filterG!==null) arr=arr.filter(i=>i.gondola===filterG);
    if (filterS!==null) arr=arr.filter(i=>i.section===filterS);
    if (phaseF!=="all")  arr=arr.filter(i=>i.phase===phaseF);
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
  }),[items]);

  const activeGLabel = filterG ? (filterS ? `${filterG} › ${filterS}` : `Gondola ${filterG}`) : null;

  return (
    <div style={{ minHeight:"100vh",background:C.base,fontFamily:"system-ui,'Inter',sans-serif",color:"#E2E8F0",paddingBottom:84 }}>
      <style>{`
        @keyframes fi{from{opacity:0;transform:translateX(-50%) translateY(-10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
        *{box-sizing:border-box} input,button,select{outline:none;font-family:inherit}
        ::-webkit-scrollbar{width:3px;height:3px} ::-webkit-scrollbar-thumb{background:#1E2D42;border-radius:2px}
        button{-webkit-tap-highlight-color:transparent}
        input[type=date]::-webkit-calendar-picker-indicator{filter:invert(.5)}
      `}</style>

      {toast&&<div style={{ position:"fixed",top:14,left:"50%",transform:"translateX(-50%)",zIndex:999,background:toast.type==="err"?"#7F1D1D":"#064E3B",color:"#fff",padding:"9px 20px",borderRadius:20,fontSize:13,fontWeight:700,animation:"fi .2s",whiteSpace:"nowrap",boxShadow:"0 8px 24px rgba(0,0,0,.5)" }}>{toast.m}</div>}

      {formData && <FormModal initial={formData} onSave={saveItem} onClose={close}/>}

      {/* ── Header ── */}
      <div style={{ background:"rgba(6,10,18,.97)",borderBottom:"1px solid rgba(255,255,255,.06)",padding:"11px 14px",position:"sticky",top:0,zIndex:100 }}>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:10 }}>
          <div style={{ display:"flex",alignItems:"center",gap:9 }}>
            <div style={{ width:34,height:34,background:"linear-gradient(135deg,#6366F1,#8B5CF6)",borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0 }}>📦</div>
            <div>
              <div style={{ fontWeight:800,fontSize:15,letterSpacing:"-.4px" }}>ExpTracker</div>
              <div style={{ fontSize:9,color:"#334155" }}>A · B · C · D Gondola</div>
            </div>
          </div>
          <button onClick={openAdd} style={{ background:"linear-gradient(135deg,#6366F1,#8B5CF6)",border:"none",color:"#fff",padding:"8px 14px",borderRadius:9,fontWeight:700,fontSize:13,display:"flex",alignItems:"center",gap:5,boxShadow:"0 4px 14px rgba(99,102,241,.4)",flexShrink:0,cursor:"pointer" }}>
            {Ic.plus} Tambah
          </button>
        </div>
        {/* Tabs */}
        <div style={{ display:"flex",gap:3,background:"rgba(255,255,255,.04)",borderRadius:9,padding:3 }}>
          {[{k:"today",l:"🎯 Hari Ini"},{k:"gondola",l:"🗺️ Gondola"},{k:"all",l:"📦 Semua"},{k:"analytics",l:"📊 Analitik"}].map(t=>(
            <button key={t.k} onClick={()=>{ setTab(t.k); if(t.k!=="all"){ setFilterG(null); setFilterS(null); } }} style={{ flex:1,background:tab===t.k?"rgba(99,102,241,.85)":"transparent",border:"none",color:tab===t.k?"#fff":"#475569",padding:"6px 0",borderRadius:7,fontSize:11,fontWeight:700 }}>{t.l}</button>
          ))}
        </div>
      </div>

      <div style={{ padding:"12px 12px 0" }}>

        {/* ── Gondola tab ── */}
        {tab==="gondola" && <GondolaMapView items={items} onFilter={handleGondolaFilter}/>}

        {/* ── Analytics tab ── */}
        {tab==="analytics" && <Analytics items={items}/>}

        {/* ── Today / All tab ── */}
        {(tab==="today"||tab==="all") && (
          <>
            {tab==="today" && <DailyHero items={items}/>}

            {/* Active gondola filter indicator */}
            {activeGLabel && (
              <div style={{ display:"flex",alignItems:"center",gap:8,background:"rgba(99,102,241,.1)",border:"1px solid rgba(99,102,241,.3)",borderRadius:9,padding:"7px 11px",marginBottom:10 }}>
                {Ic.pin}
                <span style={{ fontSize:12,color:"#818CF8",fontWeight:700 }}>Filter: {activeGLabel}</span>
                <button onClick={()=>{ setFilterG(null); setFilterS(null); }} style={{ marginLeft:"auto",background:"none",border:"none",color:"#475569",cursor:"pointer",fontSize:16,lineHeight:1 }}>×</button>
              </div>
            )}

            {/* Search */}
            <div style={{ position:"relative",marginBottom:9 }}>
              <div style={{ position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",color:"#334155",pointerEvents:"none" }}>{Ic.search}</div>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari nama, barcode, atau sub-bagian..." style={{ width:"100%",background:"rgba(15,23,40,.9)",border:"1px solid rgba(255,255,255,.08)",borderRadius:9,padding:"9px 12px 9px 34px",color:"#E2E8F0",fontSize:13 }}/>
            </div>

            {/* Gondola quick filter */}
            <div style={{ display:"flex",gap:5,marginBottom:8,overflowX:"auto",paddingBottom:2 }}>
              <button onClick={()=>{ setFilterG(null); setFilterS(null); }} style={{ background:!filterG?"rgba(99,102,241,.8)":"rgba(255,255,255,.05)",border:`1px solid ${!filterG?"rgba(99,102,241,.5)":"rgba(255,255,255,.08)"}`,color:!filterG?"#fff":"#475569",padding:"5px 11px",borderRadius:20,fontSize:11,fontWeight:700,whiteSpace:"nowrap",flexShrink:0,cursor:"pointer" }}>
                Semua Gondola
              </button>
              {Object.entries(GONDOLAS).map(([k,g])=>{
                const cnt = items.filter(i=>i.gondola===k).length;
                const urgCnt = items.filter(i=>i.gondola===k&&i.urg.level>=2).length;
                return (
                  <button key={k} onClick={()=>{ setFilterG(k); setFilterS(null); }} style={{ background:filterG===k?g.dim:"rgba(255,255,255,.04)",border:`1px solid ${filterG===k?g.border:"rgba(255,255,255,.07)"}`,color:filterG===k?g.color:"#475569",padding:"5px 11px",borderRadius:20,fontSize:11,fontWeight:700,whiteSpace:"nowrap",flexShrink:0,cursor:"pointer",display:"flex",alignItems:"center",gap:5 }}>
                    {g.icon} {k}
                    {cnt>0&&<span style={{ background:filterG===k?g.color:"rgba(255,255,255,.1)",color:filterG===k?"#000":"#475569",borderRadius:10,padding:"0 5px",fontSize:10,fontWeight:800 }}>{cnt}</span>}
                    {urgCnt>0&&<span style={{ color:"#EF4444",fontSize:10,fontWeight:800 }}>⚠️</span>}
                  </button>
                );
              })}
            </div>

            {/* Section quick filter — when gondola selected */}
            {filterG && (
              <div style={{ display:"flex",gap:5,marginBottom:8,overflowX:"auto",paddingBottom:2 }}>
                <button onClick={()=>setFilterS(null)} style={{ background:!filterS?"rgba(99,102,241,.7)":"rgba(255,255,255,.04)",border:"none",color:!filterS?"#fff":"#334155",padding:"4px 10px",borderRadius:16,fontSize:11,fontWeight:700,whiteSpace:"nowrap",flexShrink:0,cursor:"pointer" }}>
                  Semua {filterG}
                </button>
                {SECTIONS[filterG].map(s=>{
                  const cnt=items.filter(i=>i.gondola===filterG&&i.section===s).length;
                  const g=GONDOLAS[filterG];
                  return (
                    <button key={s} onClick={()=>setFilterS(s)} style={{ background:filterS===s?g.dim:"rgba(255,255,255,.04)",border:`1px solid ${filterS===s?g.border:"rgba(255,255,255,.07)"}`,color:filterS===s?g.color:"#334155",padding:"4px 10px",borderRadius:16,fontSize:11,fontWeight:700,whiteSpace:"nowrap",flexShrink:0,cursor:"pointer" }}>
                      {s} {cnt>0&&`(${cnt})`}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Phase + type filter */}
            <div style={{ display:"flex",gap:5,overflowX:"auto",marginBottom:9,paddingBottom:2 }}>
              {[{k:"all",l:"Tipe: Semua"},{k:"lokal",l:"🏠 Lokal"},{k:"impor",l:"🌏 Impor"}].map(f=>(
                <button key={f.k} onClick={()=>setFilterType(f.k)} style={{ background:filterType===f.k?"rgba(99,102,241,.7)":"rgba(255,255,255,.04)",border:"none",color:filterType===f.k?"#fff":"#334155",padding:"4px 10px",borderRadius:16,fontSize:10,fontWeight:700,whiteSpace:"nowrap",flexShrink:0,cursor:"pointer" }}>{f.l}</button>
              ))}
              <div style={{ width:1,background:C.bd,flexShrink:0 }}/>
              {[{k:"all",l:"Fase: Semua"},{k:"pending_md",l:`🏷️(${pc.pending_md})`},{k:"done_md",l:`✅(${pc.done_md})`},{k:"sold_out",l:`🎉(${pc.sold_out})`},{k:"pull",l:`🚨(${pc.pull})`},{k:"return",l:`🔄(${pc.return})`},{k:"expired",l:`💀(${pc.expired})`}].map(f=>(
                <button key={f.k} onClick={()=>setPhaseF(f.k)} style={{ background:phaseF===f.k?"rgba(99,102,241,.7)":"rgba(255,255,255,.04)",border:"none",color:phaseF===f.k?"#fff":"#334155",padding:"4px 10px",borderRadius:16,fontSize:10,fontWeight:700,whiteSpace:"nowrap",flexShrink:0,cursor:"pointer" }}>{f.l}</button>
              ))}
            </div>

            {/* Count + sort */}
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:9 }}>
              <span style={{ fontSize:11,color:"#334155" }}>{visible.length} barang</span>
              <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{ background:"rgba(15,23,40,.9)",border:"1px solid rgba(255,255,255,.08)",borderRadius:7,padding:"4px 8px",color:"#64748B",fontSize:11,cursor:"pointer" }}>
                <option value="urgency">Prioritas</option>
                <option value="exp">Exp Terdekat</option>
                <option value="gondola">Gondola A→D</option>
                <option value="qty">Stok Terendah</option>
                <option value="name">Nama A-Z</option>
              </select>
            </div>

            {/* Cards */}
            {visible.length===0 ? (
              <div style={{ textAlign:"center",padding:"56px 20px",background:"rgba(15,23,40,.4)",borderRadius:12,border:"1px dashed rgba(255,255,255,.06)" }}>
                <div style={{ fontSize:38,marginBottom:8 }}>{tab==="today"?"🎉":"📦"}</div>
                <div style={{ color:"#1E2D42",fontSize:13 }}>
                  {tab==="today"?"Semua gondola aman hari ini!":raw.length===0?"Belum ada barang. Klik + Tambah!":"Tidak ada hasil"}
                </div>
              </div>
            ) : (
              <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                {visible.map(item=><ActionCard key={item.id} item={item} {...cardProps}/>)}
              </div>
            )}
          </>
        )}
      </div>

      {/* FAB */}
      {!formData && (
        <button onClick={openAdd} style={{ position:"fixed",bottom:22,right:16,zIndex:200,width:52,height:52,borderRadius:26,background:"linear-gradient(135deg,#6366F1,#8B5CF6)",border:"none",color:"#fff",fontSize:26,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 6px 20px rgba(99,102,241,.5)",cursor:"pointer" }}>+</button>
      )}
    </div>
  );
}
