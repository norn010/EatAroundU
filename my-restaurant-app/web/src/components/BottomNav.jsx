export default function BottomNav({ current, onNavigate }) {
  const menus = [
    { id: "store", label: "Store", icon: "🏬" },
    { id: "queue", label: "Queue", icon: "👥" },
    { id: "map", label: "Home", icon: "🏠" },
    { id: "saved", label: "Saved", icon: "🔖" },
    { id: "profile", label: "Profile", icon: "👤" },
  ];

  return (
    <nav
      className="app-bottomnav"
      style={{
        display: "flex",
        justifyContent: "space-around",
        background: "#e5e5e5",
        padding: "8px 0",
        borderRadius: "16px 16px 0 0",
      }}
    >
      {menus.map((m) => (
        <button
          key={m.id}
          onClick={() => onNavigate(m.id)}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            fontWeight: current === m.id ? "bold" : "normal",
            fontSize: 14,
          }}
        >
          <div
            style={{
              fontSize: 26,
              background: current === m.id ? "#000" : "transparent",
              color: current === m.id ? "#fff" : "#000",
              borderRadius: "50%",
              padding: 6,
            }}
          >
            {m.icon}
          </div>
          {m.label}
        </button>
      ))}
    </nav>
  );
}