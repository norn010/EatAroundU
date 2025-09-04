export default function ParticipantsModal({ open, onClose, participants }) {
  if (!open) return null;
  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 2000
    }}>
      <div style={{
        background: "#fff", borderRadius: 10, padding: 20,
        width: 300, maxHeight: "70vh", overflowY: "auto"
      }}>
        <h4>👥 ผู้เข้าร่วม</h4>
        <ul style={{ padding: 0, margin: "12px 0", listStyle: "none" }}>
          {participants.map((p, i) => (
            <li key={i} style={{ padding: "6px 0", borderBottom: "1px solid #eee" }}>
              {p}
            </li>
          ))}
        </ul>
        <button onClick={onClose} style={{ marginTop: 10, padding: "6px 12px" }}>
          ปิด
        </button>
      </div>
    </div>
  );
}
