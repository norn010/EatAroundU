import { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";

export default function MyStoreList({ user, onNewStore, onOpenStore }) {
  const [stores, setStores] = useState([]);

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, "restaurants"),
      where("owner_id", "==", user.uid),
      orderBy("created_at", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setStores(rows);
    });
    return () => unsub();
  }, [user?.uid]);

  return (
    <div>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
        <h2 style={{margin:"8px 0"}}>My Store 🏪</h2>
        <button onClick={onNewStore} style={{padding:"8px 12px", borderRadius:8, border:"1px solid #ddd"}}>New store</button>
      </div>

      {stores.length === 0 ? (
        <div style={{opacity:.7}}>ยังไม่มีร้านของคุณ กด “New store” เพื่อสร้างร้านแรก</div>
      ) : (
        <div style={{display:"grid", gap:10}}>
          {stores.map(s => (
            <button key={s.id}
                    onClick={() => onOpenStore?.(s.id)}
                    style={{textAlign:"left", padding:10, border:"1px solid #eee", borderRadius:10, background:"#fff"}}>
              <div style={{fontWeight:700}}>{s.name}</div>
              <div style={{fontSize:12, opacity:.7}}>
                {s.address || `${s.latitude?.toFixed?.(5)}, ${s.longitude?.toFixed?.(5)}`} • {s.price_range || ""}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
