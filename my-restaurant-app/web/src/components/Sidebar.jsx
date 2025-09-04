// Sidebar.jsx
export default function Sidebar({ open, onClose, onAction, user }) {
  const menus = [
    { id: "map", label: "Home", icon: "🏠" },
    { id: "random", label: "Random", icon: "🎲" },
    { id: "profile", label: "Profile", icon: "👤" },
    { id: "together", label: "together", icon: "👥" },   // ใช้ "together" ได้ตามปกติ
    { id: "ai", label: "AI Chat", icon: "🤖" },
    { id: "setting", label: "Setting", icon: "⚙️" },
  ];

  return (
    <>
      {open && <div className="app-overlay" onClick={onClose} />}

      <aside className={`app-sidebar ${open ? "open" : ""}`} onClick={(e) => e.stopPropagation()}>
        {/* header */}
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
          <div style={{
            width:40, height:40, borderRadius:"50%", background:"#fff",
            border:"1px solid #ddd", display:"grid", placeItems:"center"
          }}>👤</div>
          <div>
            <div style={{ fontWeight:700 }}>Menu</div>
            <div style={{ fontSize:12, opacity:.7 }}>Quick actions</div>
          </div>
        </div>

        {menus.map((m) => (
          <button
            key={m.id}
            onClick={() => onAction?.(m.id === "together" ? "together_list" : m.id)}  // ← แปลง id ตรงนี้
            style={{
              width:"100%", textAlign:"left", padding:"10px 8px",
              border:"none", background:"transparent",
              display:"flex", gap:10, alignItems:"center",
              borderRadius:8, cursor:"pointer",
            }}
          >
            <span style={{ fontSize: 18 }}>{m.icon}</span>
            <span>{m.label}</span>
          </button>
        ))}

        {/* owner only */}
        {user?.user_type === "owner" && (
          <div style={{ marginTop:14, borderTop:"1px solid #ddd", paddingTop:10 }}>
            <button
              onClick={() => onAction?.("mystore")}
              style={{
                width:"100%", textAlign:"left", padding:"10px 8px",
                border:"none", background:"transparent",
                display:"flex", gap:10, alignItems:"center",
                borderRadius:8, cursor:"pointer", fontWeight:700,
              }}
            >
              <span style={{ fontSize: 18 }}>🏪</span>
              <span>My Store</span>
            </button>
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <button
            onClick={() => onAction?.("logout")}
            style={{
              width:"100%", padding:"10px 8px",
              borderRadius:8, border:"1px solid #ddd", background:"#fff",
            }}
          >
            🚪 Logout
          </button>
        </div>
      </aside>
    </>
  );
}
