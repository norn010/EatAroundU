// src/pages/TogetherList.jsx
import { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import {
  collection, query, orderBy, onSnapshot,
  doc, getDoc, setDoc
} from "firebase/firestore";

// helper: sha256 to hex
async function sha256Hex(str) {
  const buf = new TextEncoder().encode(str);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * แสดง Together ทุกห้อง (public + private)
 * - ถ้า private และยังไม่เป็นสมาชิก -> prompt รหัส แล้วเข้าห้องเมื่อถูกต้อง
 * - ถ้า public -> เข้าได้เลย
 */
export default function TogetherList({ onEnterRoom }) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "together_rooms"), orderBy("created_at", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setRooms(list);
        setLoading(false);
      },
      (e) => {
        console.error("together_rooms error:", e);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  async function handleEnter(room) {
    const u = auth.currentUser;
    if (!u) return alert("กรุณาเข้าสู่ระบบก่อนเข้าห้อง");

    // Public → เข้าได้เลย
    if (!room.is_private) {
      onEnterRoom?.(room.id);
      return;
    }

    // Private: เช็คว่าเป็นสมาชิกหรือยัง
    const memberDoc = await getDoc(doc(db, "together_rooms", room.id, "members", u.uid));
    if (memberDoc.exists()) {
      onEnterRoom?.(room.id);
      return;
    }

    // ยังไม่เป็นสมาชิก → ขอรหัส (join_code_hash)
    const code = window.prompt("ห้องนี้เป็น Private\nกรอกรหัสเข้าห้อง:");
    if (code === null) return;
    const hash = await sha256Hex((code ?? "").trim());
    if (hash !== (room.join_code_hash || "")) {
      alert("รหัสไม่ถูกต้อง");
      return;
    }

    // รหัสถูกต้อง → เพิ่มเราเป็นสมาชิก แล้วเข้า
    await setDoc(doc(db, "together_rooms", room.id, "members", u.uid), {
      user_id: u.uid,
      joined_at: new Date()
    });
    onEnterRoom?.(room.id);
  }

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: 12 }}>
      <h2>Together Rooms</h2>

      {loading && <div>Loading…</div>}
      {!loading && rooms.length === 0 && <div style={{ opacity: 0.6 }}>ยังไม่มีห้อง</div>}

      <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
        {rooms.map((r) => (
          <div
            key={r.id}
            style={{
              border: "1px solid #ddd",
              borderRadius: 10,
              padding: 12,
              background: "#fff",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontWeight: 700 }}>{r.restaurant_name || "Together"}</div>
              <span
                style={{
                  marginLeft: 6,
                  fontSize: 12,
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: r.is_private ? "#ffe7cf" : "#e7f7e7",
                  color: r.is_private ? "#b85c00" : "#1b7a1b",
                  fontWeight: 700,
                }}
              >
                {r.is_private ? "Private" : "Public"}
              </span>
              <div style={{ marginLeft: "auto", fontSize: 12, opacity: 0.7 }}>
                {r.meet_date} {r.meet_time}
              </div>
            </div>

            <div style={{ fontSize: 13, marginTop: 4 }}>
              ผู้สร้าง: {r.creator_email || r.creator_id}
            </div>

            <div style={{ textAlign: "right", marginTop: 8 }}>
              <button
                onClick={() => handleEnter(r)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  background: "#111",
                  color: "#fff",
                }}
              >
                เข้าห้อง
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
