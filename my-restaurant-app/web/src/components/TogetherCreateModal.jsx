// src/components/TogetherCreateModal.jsx
import { useState } from "react";
import { addDoc, collection, serverTimestamp, setDoc, doc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { incUserStat } from "../lib/achievements";

// helper: sha256 to hex
async function sha256Hex(str) {
  const buf = new TextEncoder().encode(str);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export default function TogetherCreateModal({ user, restaurant, onClose, onCreated }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10)); // YYYY-MM-DD
  const [hour, setHour] = useState("19");
  const [minute, setMinute] = useState("00");
  const [isPrivate, setIsPrivate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
  const minutes = ["00", "15", "30", "45"];

  async function handleCreate() {
    setErr("");
    const u = auth.currentUser;
    if (!u) {
      setErr("กรุณาเข้าสู่ระบบก่อน");
      return;
    }
    if (!restaurant?.id) {
      setErr("ไม่พบข้อมูลร้าน");
      return;
    }

    try {
      setBusy(true);

      let joinCodeHash = "";
      if (isPrivate) {
        const code = window.prompt("ตั้งรหัสเข้าห้อง (อย่างน้อย 4 ตัว):") || "";
        if (code.trim().length < 4) {
          setErr("รหัสต้องอย่างน้อย 4 ตัว");
          setBusy(false);
          return;
        }
        joinCodeHash = await sha256Hex(code.trim());
      }

      const roomRef = await addDoc(collection(db, "together_rooms"), {
        creator_id: u.uid,
        creator_email: u.email,
        restaurant_id: restaurant.id,
        restaurant_name: restaurant.name || "",
        is_private: !!isPrivate,
        join_code_hash: joinCodeHash,     // ✅ เก็บ hash ไม่ใช่รหัสจริง
        meet_date: date,
        meet_time: `${hour}:${minute}`,
        created_at: serverTimestamp(),
      });

      // เพิ่มผู้สร้างเป็นสมาชิกทันที
      await setDoc(doc(db, "together_rooms", roomRef.id, "members", u.uid), {
        user_id: u.uid,
        joined_at: serverTimestamp()
      });

      // อัปเดตสถิติ (สำหรับ achievements)
      await incUserStat(u.uid, "together_created_count", 1);

      onCreated?.(roomRef.id);
    } catch (e) {
      console.error(e);
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.35)",
        display: "grid",
        placeItems: "center",
        zIndex: 9999,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        style={{
          width: 420,
          maxWidth: "92vw",
          background: "#fff",
          borderRadius: 12,
          padding: 16,
          boxShadow: "0 6px 24px rgba(0,0,0,.18)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>together</div>
          <button onClick={onClose} style={{ border: "none", background: "transparent", fontSize: 20 }}>
            ×
          </button>
        </div>

        <div style={{ marginTop: 10, fontWeight: 700 }}>
          {restaurant?.name || "—"}
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 14, marginBottom: 6 }}>วันที่</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{ border: "1px solid #ddd", padding: "8px 10px", borderRadius: 8 }}
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <select
                value={hour}
                onChange={(e) => setHour(e.target.value)}
                style={{ border: "1px solid #ddd", padding: "8px 10px", borderRadius: 8 }}
              >
                {hours.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
              <select
                value={minute}
                onChange={(e) => setMinute(e.target.value)}
                style={{ border: "1px solid #ddd", padding: "8px 10px", borderRadius: 8 }}
              >
                {minutes.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 14 }}>
          <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
          Private
        </label>

        {err && <div style={{ color: "crimson", fontSize: 13, marginTop: 10 }}>{err}</div>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
          <button onClick={onClose} style={{ border: "1px solid #ddd", padding: "8px 12px", borderRadius: 8 }}>
            ยกเลิก
          </button>
          <button
            onClick={handleCreate}
            disabled={busy}
            style={{
              border: "none",
              background: "#111",
              color: "#fff",
              padding: "8px 12px",
              borderRadius: 8,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {busy ? "กำลังสร้าง…" : "สร้างห้อง"}
          </button>
        </div>
      </div>
    </div>
  );
}
