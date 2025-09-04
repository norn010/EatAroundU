// src/components/TogetherCreateModal.jsx
import { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import {
  addDoc, collection, serverTimestamp, doc, setDoc
} from "firebase/firestore";

function random4() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/** Modal สร้างห้อง Together
 * props:
 *   user: {uid,email}
 *   restaurant: { id, name }
 *   onClose: () => void
 *   onCreated: (roomId:string) => void
 */
export default function TogetherCreateModal({ user, restaurant, onClose, onCreated }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0,10));
  const [hour, setHour] = useState("19");
  const [minute, setMinute] = useState("00");
  const [isPrivate, setIsPrivate] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isPrivate) setJoinCode(random4());
    else setJoinCode("");
  }, [isPrivate]);

  async function createRoom() {
    if (!user?.uid || !restaurant?.id) return;
    try {
      setBusy(true);
      const payload = {
        restaurant_id: restaurant.id,
        restaurant_name: restaurant.name || "",
        creator_id: user.uid,
        meet_date: date,
        meet_time: `${hour.padStart(2,"0")}:${minute.padStart(2,"0")}`,
        is_private: isPrivate,
        join_code: isPrivate ? joinCode : "",
        member_ids: { [user.uid]: true },
        created_at: serverTimestamp()
      };
      const ref = await addDoc(collection(db, "together_rooms"), payload);

      // สร้างข้อความต้อนรับแรกใน subcollection messages
      const msg = {
        sender_id: "system",
        sender_name: "System",
        text: `สร้างห้องสำหรับร้าน ${restaurant.name} — นัด ${payload.meet_date} ${payload.meet_time}${isPrivate ? ` (รหัสเข้าห้อง: ${joinCode})` : ""}`,
        type: "system",
        created_at: serverTimestamp()
      };
      await addDoc(collection(db, "together_rooms", ref.id, "messages"), msg);

      // เพิ่มคนสร้างเป็น member ชัด ๆ (ไม่จำเป็นก็ได้ แต่กันค่าหาย)
      await setDoc(doc(db, "together_rooms", ref.id), { member_ids: { [user.uid]: true } }, { merge: true });

      onCreated?.(ref.id);
    } catch (e) {
      alert("สร้างห้องไม่สำเร็จ: " + (e.message || e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background:"rgba(0,0,0,.45)",
      display: "grid", placeItems: "center", zIndex: 2000
    }}>
      <div style={{
        width: 360, maxWidth:"95%", background:"#fff",
        borderRadius: 14, padding: 14, boxShadow:"0 10px 30px rgba(0,0,0,.2)"
      }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ fontWeight:800, fontSize:18 }}>➕ together</div>
          <button onClick={onClose} style={{ border:"none", background:"transparent", fontSize:22 }}>×</button>
        </div>

        <div style={{ marginTop:6, fontWeight:700 }}>{restaurant?.name || "-"}</div>

        {/* date */}
        <div style={{ marginTop:12 }}>
          <label style={{ display:"block", fontSize:13, opacity:.8 }}>วันที่</label>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)}
            style={{ width:"100%", border:"1px solid #ddd", borderRadius:8, padding:"8px 10px" }}/>
        </div>

        {/* time */}
        <div style={{ display:"flex", gap:8, marginTop:10 }}>
          <div style={{ flex:1 }}>
            <label style={{ display:"block", fontSize:13, opacity:.8 }}>ชั่วโมง</label>
            <input type="number" min="0" max="23" value={hour}
                   onChange={e=>setHour(e.target.value.slice(0,2))}
                   style={{ width:"100%", border:"1px solid #ddd", borderRadius:8, padding:"8px 10px" }}/>
          </div>
          <div style={{ flex:1 }}>
            <label style={{ display:"block", fontSize:13, opacity:.8 }}>นาที</label>
            <input type="number" min="0" max="59" value={minute}
                   onChange={e=>setMinute(e.target.value.slice(0,2))}
                   style={{ width:"100%", border:"1px solid #ddd", borderRadius:8, padding:"8px 10px" }}/>
          </div>
        </div>

        <div style={{ marginTop:12, display:"flex", alignItems:"center", gap:8 }}>
          <input id="pv" type="checkbox" checked={isPrivate} onChange={e=>setIsPrivate(e.target.checked)}/>
          <label htmlFor="pv" style={{ cursor:"pointer" }}>Private</label>
          {isPrivate && <span style={{ marginLeft:10, fontSize:12, opacity:.8 }}>รหัส: <b>{joinCode}</b></span>}
        </div>

        <div style={{ marginTop:14, textAlign:"right" }}>
          <button disabled={busy} onClick={createRoom}
                  style={{ border:"none", background:"#111", color:"#fff", padding:"8px 14px", borderRadius:8 }}>
            {busy ? "กำลังสร้าง…" : "สร้าง"}
          </button>
        </div>
      </div>
    </div>
  );
}
