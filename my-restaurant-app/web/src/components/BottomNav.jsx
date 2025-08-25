import React from "react";

export default function BottomNav({ current, onNavigate }) {
  const Btn = ({ id, label, icon }) => (
    <button
      onClick={() => onNavigate(id)}
      style={{
        flex:1, padding:"8px 0", border:"none", background:"transparent",
        fontWeight: current===id ? 700 : 500, cursor:"pointer"
      }}
    >
      <div style={{fontSize:18}}>{icon}</div>
      <div style={{fontSize:12}}>{label}</div>
    </button>
  );

  return (
    <nav className="app-bottomnav" style={{ background:"#fff", borderTop:"1px solid #eee", display:"flex", gap:8 }}>
      <Btn id="map"   label="Home"  icon="🏠" />
      <Btn id="queue" label="Queue" icon="🪑" />
      <Btn id="saved" label="Saved" icon="🔖" />
      <Btn id="profile" label="Profile" icon="👤" />
    </nav>
  );
}
