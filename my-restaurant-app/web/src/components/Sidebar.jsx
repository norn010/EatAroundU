import React from "react";

export default function Sidebar({ open, onClose, onAction }) {
  return (
    <>
      {/* overlay คลิกปิด */}
      {open && (
        <div onClick={onClose}
             style={{
               position:"fixed", inset:0, background:"rgba(0,0,0,0.35)", zIndex:40
             }}
        />
      )}
      {/* ตัวแถบด้านข้าง */}
      <aside
        className="app-sidebar"
        style={{
          left: open ? 0 : -280,
          transition: "left .25s ease",
          background: "#f2f2f2",
          padding: "10px 12px",
          boxShadow: "2px 0 10px rgba(0,0,0,.1)"
        }}
      >
        <div style={{display:"flex", alignItems:"center", gap:10, marginBottom:12}}>
          <div style={{
            width:40, height:40, borderRadius:"50%", background:"#fff", border:"1px solid #ddd",
            display:"grid", placeItems:"center"
          }}>👤</div>
          <div>
            <div style={{fontWeight:700}}>Menu</div>
            <div style={{fontSize:12, opacity:.7}}>Quick actions</div>
          </div>
        </div>

        {[
          { id:"map", label:"Home", icon:"🏠" },
          { id:"random", label:"Random", icon:"🎲" },
          { id:"profile", label:"Profile", icon:"👤" },
          { id:"together", label:"together", icon:"👥" },
          { id:"ai", label:"AI Chat", icon:"🤖" },
          { id:"setting", label:"Setting", icon:"⚙️" },
          { id:"logout", label:"Logout", icon:"🚪" },
        ].map(m => (
          <button key={m.id}
                  onClick={() => onAction?.(m.id)}
                  style={{
                    width:"100%", textAlign:"left", padding:"10px 8px",
                    border:"none", background:"transparent", display:"flex", gap:10,
                    alignItems:"center", borderRadius:8, cursor:"pointer"
                  }}>
            <span style={{fontSize:18}}>{m.icon}</span>
            <span>{m.label}</span>
          </button>
        ))}

      </aside>
    </>
  );
}
