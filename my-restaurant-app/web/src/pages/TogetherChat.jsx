import { useEffect, useState, useRef } from "react";
import { auth, db } from "../firebase";
import {
  collection, addDoc, serverTimestamp,
  onSnapshot, query, orderBy,
  doc, getDoc
} from "firebase/firestore";
import ParticipantsModal from "../components/ParticipantsModal";

export default function TogetherChat({ roomId, goBack }) {
  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const listRef = useRef(null);
  const [participants, setParticipants] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);

  // โหลดข้อมูลห้อง + ผู้สร้าง
  useEffect(() => {
    if (!roomId) return;
    const unsub = onSnapshot(doc(db, "together_rooms", roomId), async (snap) => {
      if (!snap.exists()) { setRoom(null); setLoading(false); return; }
      const r = { id: snap.id, ...snap.data() };

      // โหลดชื่อร้าน
      if (r.restaurant_id) {
        const rsnap = await getDoc(doc(db, "restaurants", r.restaurant_id));
        r.restaurant_name = rsnap.exists() ? (rsnap.data().name || "Together") : "Together";
      }

      // โหลด email ผู้สร้าง
      if (r.creator_id) {
        const usnap = await getDoc(doc(db, "users", r.creator_id));
        r.creator_email = usnap.exists() ? (usnap.data().email || r.creator_id) : r.creator_id;
      }

      setRoom(r);
      setLoading(false);
    });
    return () => unsub();
  }, [roomId]);

  // โหลดข้อความ realtime + เก็บ participants
  useEffect(() => {
    if (!roomId) return;
    const q = query(
      collection(db, "together_rooms", roomId, "messages"),
      orderBy("created_at", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMessages(msgs);

      // เก็บผู้เข้าร่วมจาก messages
      const unique = [...new Map(msgs.map(m => [m.user_id, m.email || m.user_id])).values()];
      setParticipants(unique);

      setTimeout(() => listRef.current?.scrollTo(0, listRef.current.scrollHeight), 100);
    });
    return () => unsub();
  }, [roomId]);

  // ส่งข้อความ
  async function sendMessage() {
    const u = auth.currentUser;
    if (!u || !text.trim()) return;
    await addDoc(collection(db, "together_rooms", roomId, "messages"), {
      user_id: u.uid,
      email: u.email,
      text: text.trim(),
      created_at: serverTimestamp()
    });
    setText("");
  }

  if (loading) return <div style={{ padding: 12 }}>Loading…</div>;
  if (!room) return <div style={{ padding: 12 }}>ไม่พบห้อง</div>;

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: 12 }}>
      <button onClick={goBack}>← Back</button>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3>{room.restaurant_name || "Together"}</h3>
          <div style={{ fontSize: 13, opacity: 0.7 }}>ผู้สร้าง: {room.creator_email}</div>
        </div>
        <button onClick={() => setModalOpen(true)}
          style={{ border: "1px solid #ddd", borderRadius: 6, padding: "4px 8px" }}>
          👥 สมาชิก
        </button>
      </div>

      {/* Modal แสดงผู้เข้าร่วม */}
      <ParticipantsModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        participants={participants}
      />

      <div style={{ margin: "8px 0", fontSize: 13, opacity: 0.7 }}>
        วันที่นัด {room.meet_date} เวลา {room.meet_time}
      </div>

      <div ref={listRef} style={{
        background: "#fafafa", borderRadius: 8,
        padding: 10, height: 320, overflowY: "auto", margin: "12px 0"
      }}>
        {messages.map(m => (
          <div key={m.id} style={{
            marginBottom: 10,
            textAlign: m.user_id === auth.currentUser?.uid ? "right" : "left"
          }}>
            <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 2 }}>
              {m.email || "Unknown"} —{" "}
              {m.created_at?.toDate
                ? m.created_at.toDate().toLocaleString()
                : ""}
            </div>
            <div style={{
              display: "inline-block",
              background: m.user_id === auth.currentUser?.uid ? "#111" : "#eee",
              color: m.user_id === auth.currentUser?.uid ? "#fff" : "#000",
              borderRadius: 6,
              padding: "6px 10px"
            }}>
              {m.text}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="พิมพ์ข้อความ…"
          style={{ flex: 1, borderRadius: 8, border: "1px solid #ddd", padding: 6 }}
        />
        <button onClick={sendMessage} style={{ borderRadius: 8, padding: "6px 12px" }}>
          ส่ง
        </button>
      </div>
    </div>
  );
}
