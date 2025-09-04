import { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, query, orderBy, onSnapshot, getDoc, doc } from "firebase/firestore";

export default function TogetherList({ onEnterRoom }) {
    const [rooms, setRooms] = useState([]);

    useEffect(() => {
        const q = query(collection(db, "together_rooms"), orderBy("created_at", "desc"));
        const unsub = onSnapshot(q, async (snap) => {
            const list = await Promise.all(
                snap.docs.map(async (d) => {
                    const r = { id: d.id, ...d.data() };
                    // โหลดชื่อร้าน
                    if (r.restaurant_id) {
                        const rsnap = await getDoc(doc(db, "restaurants", r.restaurant_id));
                        r.restaurant_name = rsnap.exists() ? rsnap.data().name : "(ร้านถูกลบ)";
                    }
                    // โหลด email ผู้สร้าง
                    if (r.creator_id) {
                        const usnap = await getDoc(doc(db, "users", r.creator_id));
                        r.creator_email = usnap.exists() ? (usnap.data().email || r.creator_id) : r.creator_id;
                    }
                    return r;
                })
            );
            setRooms(list);
        });
        return () => unsub();
    }, []);

    return (
        <div style={{ maxWidth: 600, margin: "0 auto", padding: 12 }}>
            <h2>Together Rooms</h2>
            {rooms.map((r) => (
                <div key={r.id} style={{
                    border: "1px solid #ddd", borderRadius: 10,
                    padding: 12, marginBottom: 10, background: "#fff"
                }}>
                    <div style={{ fontWeight: 700 }}>{r.restaurant_name || "Together"}</div>
                    <div style={{ fontSize: 13 }}>ผู้สร้าง: {r.creator_email}</div>
                    <div style={{ fontSize: 13, marginBottom: 6 }}>
                        วันที่นัด {r.meet_date} เวลา {r.meet_time}
                    </div>
                    <div style={{ textAlign: "right" }}>
                        <button
                            onClick={() => onEnterRoom?.(r.id)}   // ✅ ส่ง id อย่างเดียว
                            style={{ padding: "6px 12px", borderRadius: 8, background: "#111", color: "#fff" }}
                        >
                            เข้าห้อง
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}
