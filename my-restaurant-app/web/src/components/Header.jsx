
export default function Header({ title, user, onAvatarClick }) {
  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        background: "#111",
        color: "white",
        padding: "8px 16px",
      }}
    >
      {/* ซ้าย: ชื่อระบบ + Title */}
      <div>
        <strong>🍜 Eat Around You</strong>
        {title && <span style={{ marginLeft: 12 }}>{title}</span>}
      </div>

      {/* ขวา: user email + ประเภท */}
      {user && (
        <div style={{ fontSize: "0.9em" }}>
          {user.email}{" "}
          <span style={{ opacity: 0.7 }}>
            ({user.user_type || "user"})
          </span>
        </div>
      )}

      {/* avatar ปุ่มเปิด sidebar */}
      <button
        onClick={onAvatarClick}
        style={{
          marginLeft: 12,
          border: "none",
          background: "transparent",
          color: "white",
          cursor: "pointer",
        }}
      >
        ☰
      </button>
    </header>
  );
}
