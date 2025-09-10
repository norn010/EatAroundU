// src/pages/TogetherList.jsx
import { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import {
  collection, query, orderBy, onSnapshot,
  getDoc, doc, updateDoc
} from "firebase/firestore";

export default function TogetherList({ onEnterRoom }) {
  const [rooms, setRooms] = useState([]);

  useEffect(() => {
    const q = query(collection(db, "together_rooms"), orderBy("created_at", "desc"));
    const unsub = onSnapshot(q, async (snap) => {
      const list = await Promise.all(
        snap.docs.map(async (d) => {
          const r = { id: d.id, ...d.data() };
          // ชื่อร้าน
          if (r.restaurant_id) {
            const rsnap = await getDoc(doc(db, "restaurants", r.restaurant_id));
            r.restaurant_name = rsnap.exists() ? rsnap.data().name : "(ร้านถูกลบ)";
          }
          // อีเมลผู้สร้าง
          if (r.creator_id) {
            const usnap = await getDoc(doc(db, "users", r.creator_id));
            r.creator_email = usnap.exists() ? (usnap.data().email || r.creator_id) : r.creator_id;
          }
          return r;
        })
      );

      // กรองห้องที่ถูกลบแบบ soft delete ถ้ามี flag
      setRooms(list.filter((r) => !r.is_deleted));
    });
    return () => unsub();
  }, []);

  async function handleEnter(r) {
    const u = auth.currentUser;
    if (!u) {
      alert("กรุณาเข้าสู่ระบบก่อนเข้าห้อง");
      return;
    }

    const isOwner = u.uid === r.creator_id;
    const isMember = !!r?.member_ids?.[u.uid];

    // ห้องไม่ private หรือเป็นเจ้าของ/สมาชิกเดิม → เข้าได้เลย
    if (!r.is_private || isOwner || isMember) {
      onEnterRoom?.(r.id);
      return;
    }

    // ห้อง private และยังไม่เป็นสมาชิก → ขอรหัส
    const code = window.prompt(`ห้องนี้เป็น Private\nกรอกรหัสเข้าห้อง:`);
    if (code === null) return; // กดยกเลิก
    if ((code ?? "").trim() !== (r.join_code ?? "")) {
      alert("รหัสไม่ถูกต้อง");
      return;
    }

    // รหัสถูกต้อง → บันทึกผู้ใช้เป็นสมาชิกครั้งแรก แล้วเข้า
    try {
      await updateDoc(doc(db, "together_rooms", r.id), {
        [`member_ids.${u.uid}`]: true,
      });
      onEnterRoom?.(r.id);
    } catch (e) {
      alert("เข้าห้องไม่สำเร็จ: " + e.message);
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: 12 }}>
      <h2>Together Rooms</h2>

      {rooms.map((r) => (
        <div
          key={r.id}
          style={{
            border: "1px solid #ddd",
            borderRadius: 10,
            padding: 12,
            marginBottom: 10,
            background: "#fff",
          }}
        >
          <div style={{ fontWeight: 700 }}>
            {r.restaurant_name || "Together"}
          </div>
          <div style={{ fontSize: 13 }}>ผู้สร้าง: {r.creator_email}</div>
          <div style={{ fontSize: 13, marginBottom: 6 }}>
            วันที่นัด {r.meet_date} เวลา {r.meet_time}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {/* แสดงสถานะห้อง */}
            <span
              style={{
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
  );
}
