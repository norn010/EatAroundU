// src/components/Sidebar.jsx
export default function Sidebar({ open, onClose, onAction, user }) {
  const avatar = user?.avatar_url
    ? `${user.avatar_url}${user.avatar_url.includes("?") ? "&" : "?"}v=${user?.updated_at?.seconds || Date.now()}`
    : null;
  const menus = [
    { id: "map", label: "Home", icon: "🏠" },
    // { id: "random", label: "Random", icon: "🎲" },
    { id: "profile", label: "Profile", icon: "👤" },
    { id: "together_list", label: "together", icon: "👥" },
    { id: "ai", label: "AI Chat", icon: "🤖" },
    { id: "setting", label: "Setting", icon: "⚙️" },
  ];

  return (
    <>
      {open && <div className="app-overlay" onClick={onClose} />}

      <aside className={`app-sidebar ${open ? "open" : ""}`} onClick={(e) => e.stopPropagation()}>
        {/* // src/components/Sidebar.jsx (เฉพาะส่วน Avatar ด้านบน) */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              overflow: "hidden",
              background: "#fff",
              border: "1px solid #ddd",
              display: "grid",
              placeItems: "center",
            }}
          >
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt="avatar"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              "👤"
            )}
          </div>
          <div>
            <div style={{ fontWeight: 700 }}>Menu</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>{user?.name || user?.email}</div>
          </div>
        </div>

        {menus.map((m) => (
          <button
            key={m.id}
            onClick={() => onAction?.(m.id)}
            style={{
              width: "100%", textAlign: "left", padding: "10px 8px",
              border: "none", background: "transparent", display: "flex", gap: 10,
              alignItems: "center", borderRadius: 8, cursor: "pointer"
            }}
          >
            <span style={{ fontSize: 18 }}>{m.icon}</span>
            <span>{m.label}</span>
          </button>
        ))}

        {/* เฉพาะ owner */}
        {user?.user_type === "owner" && (
          <div style={{ marginTop: 14, borderTop: "1px solid #ddd", paddingTop: 10 }}>
            <button
              onClick={() => onAction?.("mystore")}
              style={{
                width: "100%", textAlign: "left", padding: "10px 8px",
                border: "none", background: "transparent", display: "flex", gap: 10,
                alignItems: "center", borderRadius: 8, cursor: "pointer", fontWeight: 700
              }}>
              <span style={{ fontSize: 18 }}>🏪</span>
              <span>My Store</span>
            </button>
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <button
            onClick={() => onAction?.("logout")}
            style={{ width: "100%", padding: "10px 8px", borderRadius: 8, border: "1px solid #ddd", background: "#fff" }}
          >
            🚪 Logout
          </button>
        </div>
      </aside>
    </>
  );
}
