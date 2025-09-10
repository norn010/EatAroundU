// src/pages/TogetherChat.jsx
import { useEffect, useState, useRef } from "react";
import { auth, db } from "../firebase";
import {
  collection, addDoc, serverTimestamp, onSnapshot, query, orderBy,
  doc, getDoc, getDocs, deleteDoc
} from "firebase/firestore";

export default function TogetherChat({ roomId, goBack }) {
  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const listRef = useRef(null);

  const [participants, setParticipants] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);

  // โหลดข้อมูลห้อง
  useEffect(() => {
    if (!roomId) return;
    const unsub = onSnapshot(doc(db, "together_rooms", roomId), async (snap) => {
      if (!snap.exists()) { setRoom(null); setLoading(false); return; }
      const r = { id: snap.id, ...snap.data() };

      if (r.restaurant_id) {
        const rsnap = await getDoc(doc(db, "restaurants", r.restaurant_id));
        r.restaurant_name = rsnap.exists() ? rsnap.data().name : "Together";
      }

      if (r.creator_id) {
        const usnap = await getDoc(doc(db, "users", r.creator_id));
        r.creator_email = usnap.exists() ? (usnap.data().email || r.creator_id) : r.creator_id;
      }

      setRoom(r);
      setLoading(false);
    });
    return () => unsub();
  }, [roomId]);

  // โหลดข้อความ realtime + หา participants (ตัด system ออก)
  useEffect(() => {
    if (!roomId) return;
    const q = query(
      collection(db, "together_rooms", roomId, "messages"),
      orderBy("created_at", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMessages(msgs);

      const humans = msgs.filter(
        m => m.user_id && m.type !== "system" && m.sender_id !== "system"
      );
      const unique = Array.from(
        new Map(humans.map(m => [m.user_id, m.email || m.user_id])).values()
      );
      setParticipants(unique);

      setTimeout(() => listRef.current?.scrollTo(0, listRef.current.scrollHeight), 100);
    });
    return () => unsub();
  }, [roomId]);

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

  // 🔥 ลบห้อง (เฉพาะเจ้าของ)
  async function handleDeleteRoom() {
    if (!room) return;
    const u = auth.currentUser;
    if (!u || u.uid !== room.creator_id) return; // ป้องกัน

    const ok = window.confirm("ลบห้องนี้ถาวร รวมทั้งข้อความทั้งหมด?");
    if (!ok) return;

    try {
      setDeleting(true);
      // ลบทุกข้อความใน subcollection messages
      const msgsRef = collection(db, "together_rooms", room.id, "messages");
      const msgSnap = await getDocs(msgsRef);
      await Promise.all(msgSnap.docs.map(d => deleteDoc(doc(db, "together_rooms", room.id, "messages", d.id))));
      // ลบเอกสารห้อง
      await deleteDoc(doc(db, "together_rooms", room.id));
      // กลับหน้าก่อนหน้า
      goBack?.();
    } catch (e) {
      alert("ลบห้องไม่สำเร็จ: " + e.message);
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <div style={{ padding: 12 }}>Loading…</div>;
  if (!room) return <div style={{ padding: 12 }}>ไม่พบห้อง</div>;

  const isOwner = auth.currentUser?.uid && room?.creator_id === auth.currentUser.uid;

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: 12 }}>
      <button onClick={goBack}>← Back</button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3>{room.restaurant_name || "Together"}</h3>
          <div style={{ fontSize: 13, opacity: 0.7 }}>ผู้สร้าง: {room.creator_email}</div>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          style={{ border: "1px solid #ddd", borderRadius: 6, padding: "4px 8px" }}
        >
          👥 สมาชิก
        </button>
      </div>

      <div style={{ margin: "8px 0", fontSize: 13, opacity: 0.7 }}>
        วันที่นัด {room.meet_date} เวลา {room.meet_time}
      </div>

      {/* แชท */}
      <div
        ref={listRef}
        style={{
          background: "#fafafa", borderRadius: 8,
          padding: 10, height: 320, overflowY: "auto", margin: "12px 0"
        }}
      >
        {messages.map((m) => {
          const isMe = m.user_id === auth.currentUser?.uid;
          const isSystem = m.type === "system" || m.sender_id === "system";
          const displayName = isSystem ? (m.sender_name || "System") : (m.email || "Unknown");
          return (
            <div key={m.id} style={{ marginBottom: 6, textAlign: isMe ? "right" : "left" }}>
              <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 2 }}>
                {displayName} — {m.created_at?.toDate ? m.created_at.toDate().toLocaleString() : ""}
              </div>
              <div
                style={{
                  display: "inline-block",
                  background: isMe ? "#111" : "#eee",
                  color: isMe ? "#fff" : "#000",
                  borderRadius: 6,
                  padding: "6px 10px"
                }}
              >
                {m.text}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="พิมพ์ข้อความ…"
          style={{ flex: 1, borderRadius: 8, border: "1px solid #ddd", padding: 6 }}
        />
        <button onClick={sendMessage} style={{ borderRadius: 8, padding: "6px 12px" }}>
          ส่ง
        </button>
      </div>

      {/* Popup Modal */}
      {modalOpen && (
        <div
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 2000
          }}
        >
          <div
            style={{
              background: "#fff", borderRadius: 12, padding: 20,
              width: "90%", maxWidth: 360, maxHeight: "80%", overflowY: "auto"
            }}
          >
            <h4>👥 ผู้เข้าร่วม ({participants.length})</h4>
            <ul style={{ marginTop: 10, paddingLeft: 18 }}>
              {participants.map((p, i) => (
                <li key={i} style={{ marginBottom: 6 }}>{p}</li>
              ))}
            </ul>

            {/* ปุ่มลบห้อง (เฉพาะเจ้าของ) */}
            {isOwner && (
              <div style={{ marginTop: 30, fontSize: 13 }}>
                <button
                  onClick={handleDeleteRoom}
                  disabled={deleting}
                  style={{
                    border: "1px solid #f1b0b7",
                    background: "#f8d7da",
                    color: "#721c24",
                    borderRadius: 8,
                    padding: "8px 12px",
                    fontWeight: 700
                  }}
                >
                  🗑️ {deleting ? "กำลังลบ..." : "ลบห้อง"}
                </button>
              </div>
            )}

            <div style={{ textAlign: "right", marginTop: 12 }}>
              <button
                onClick={() => setModalOpen(false)}
                style={{ padding: "6px 12px", border: "1px solid #ddd", borderRadius: 8 }}
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
