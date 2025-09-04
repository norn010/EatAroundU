// src/pages/MyQueuePage.jsx
import { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
} from "firebase/firestore";

export default function MyQueuePage({ goRestaurant }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const u = auth.currentUser;
    if (!u) {
      setRows([]);
      setLoading(false);
      return;
    }

    // โหลดเฉพาะคิวของ user คนนั้น และยังไม่ถูกยกเลิก
    const qRef = query(
      collection(db, "table_bookings"),
      where("user_id", "==", u.uid),
      where("canceled_at", "==", null),
      orderBy("reserved_at", "desc")
    );

    const unsub = onSnapshot(qRef, async (snap) => {
      const items = await Promise.all(
        snap.docs.map(async (d) => {
          const data = d.data();

          // ชื่อร้าน
          let restaurant_name = "";
          const rdoc = await getDoc(doc(db, "restaurants", data.restaurant_id));
          if (rdoc.exists()) {
            restaurant_name = rdoc.data().name || "";
          }

          // หมายเลขโต๊ะ
          let table_number = "";
          const tdoc = await getDoc(
            doc(db, "restaurants", data.restaurant_id, "tables", data.table_id)
          );
          if (tdoc.exists()) {
            table_number = tdoc.data().table_number || "";
          }

          return {
            id: d.id,
            ...data,
            restaurant_name,
            table_number,
          };
        })
      );

      setRows(items);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  return (
    <div style={{ maxWidth: 520, margin: "0 auto" }}>
      <h2 style={{ margin: "8px 0 12px 0" }}>My Queue</h2>

      {loading && <div>Loading…</div>}
      {!loading && rows.length === 0 && <div>ยังไม่มีการจอง</div>}

      {rows.map((r) => (
        <div
          key={r.id}
          style={{
            border: "1px solid #eee",
            borderRadius: 8,
            padding: 12,
            marginBottom: 10,
            background: "#fff",
          }}
        >
          <div style={{ fontWeight: 700 }}>{r.restaurant_name || "(ร้านถูกลบ)"}</div>
          <div>โต๊ะ {r.table_number || r.table_id}</div>
          <div>
            จองเมื่อ:{" "}
            {r.reserved_at?.toDate
              ? r.reserved_at.toDate().toLocaleString()
              : ""}
          </div>
          <button
            onClick={() => goRestaurant?.(r.restaurant_id)}
            style={{
              marginTop: 8,
              border: "1px solid #ddd",
              padding: "6px 10px",
              borderRadius: 8,
              background: "#fff",
              cursor: "pointer",
            }}
          >
            ไปหน้าร้าน
          </button>
        </div>
      ))}
    </div>
  );
}
