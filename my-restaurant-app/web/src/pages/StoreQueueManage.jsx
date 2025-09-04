import { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection, onSnapshot, orderBy, query, addDoc, updateDoc,
  deleteDoc, doc, serverTimestamp
} from "firebase/firestore";

export default function StoreQueueManage({ restId, goBack }) {
  const [rest, setRest] = useState(null);
  const [tables, setTables] = useState([]);
  const [newTableNumber, setNewTableNumber] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!restId) return;
    const unsub = onSnapshot(doc(db, "restaurants", restId), (snap) => {
      if (snap.exists()) setRest({ id: snap.id, ...snap.data() });
    });
    return () => unsub();
  }, [restId]);

  useEffect(() => {
    if (!restId) return;
    const qRef = query(
      collection(db, "restaurants", restId, "tables"),
      orderBy("table_number")
    );
    const unsub = onSnapshot(qRef, (snap) => {
      setTables(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [restId]);

  async function addTable() {
    const num = parseInt(newTableNumber, 10);
    if (!Number.isInteger(num) || num <= 0) return alert("กรุณาใส่หมายเลขโต๊ะเป็นตัวเลขบวก");
    try {
      setBusy(true);
      await addDoc(collection(db, "restaurants", restId, "tables"), {
        table_number: num,
        status: "available",
        updated_at: serverTimestamp()
      });
      setNewTableNumber("");
    } catch (e) {
      alert("เพิ่มโต๊ะไม่สำเร็จ: " + (e.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function removeTable(t) {
    if (!window.confirm(`ลบโต๊ะหมายเลข ${t.table_number} ?`)) return;
    try {
      setBusy(true);
      await deleteDoc(doc(db, "restaurants", restId, "tables", t.id));
    } catch (e) {
      alert("ลบโต๊ะไม่สำเร็จ: " + (e.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(t, status) {
    try {
      setBusy(true);
      await updateDoc(doc(db, "restaurants", restId, "tables", t.id), {
        status,
        updated_at: serverTimestamp()
      });
    } catch (e) {
      alert("อัพเดตไม่สำเร็จ: " + (e.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function clearAllOccupied() {
    if (!window.confirm("เคลียร์โต๊ะทั้งหมดที่ไม่ว่างให้เป็น 'available' ?")) return;
    try {
      setBusy(true);
      const jobs = tables
        .filter(t => t.status !== "available")
        .map(t => updateDoc(doc(db, "restaurants", restId, "tables", t.id), {
          status: "available", updated_at: serverTimestamp()
        }));
      await Promise.all(jobs);
    } catch (e) {
      alert("เคลียร์โต๊ะไม่สำเร็จ: " + (e.message || e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 560, margin:"0 auto" }}>
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <button onClick={goBack}>← Back</button>
        <h2 style={{ margin:"12px 0" }}>{rest?.name || "Manage Tables"}</h2>
      </div>

      <div style={{ background:"#fff", padding:12, borderRadius:10, marginBottom:12 }}>
        <div style={{ fontWeight:800, marginBottom:6 }}>เพิ่มโต๊ะ</div>
        <div style={{ display:"flex", gap:8 }}>
          <input
            value={newTableNumber}
            onChange={e=>setNewTableNumber(e.target.value)}
            placeholder="เลขโต๊ะ เช่น 1"
            style={{ flex:1, border:"1px solid #ddd", borderRadius:8, padding:"8px 10px" }}
          />
          <button disabled={busy} onClick={addTable}
                  style={{ border:"1px solid #ddd", borderRadius:8, padding:"8px 10px", background:"#fff" }}>
            {busy ? "Saving..." : "Add"}
          </button>
        </div>
      </div>

      <div style={{ background:"#fff", padding:12, borderRadius:10 }}>
        <div style={{ display:"flex", justifyContent:"space-between" }}>
          <div style={{ fontWeight:800 }}>โต๊ะทั้งหมด</div>
          <button onClick={clearAllOccupied}
                  style={{ border:"1px solid #ddd", borderRadius:8, padding:"6px 10px", background:"#fff" }}>
            เคลียร์โต๊ะที่ไม่ว่างทั้งหมด
          </button>
        </div>

        <div style={{ display:"grid", gap:8, marginTop:8 }}>
          {tables.map(t => (
            <div key={t.id}
                 style={{ display:"grid", gridTemplateColumns:"1fr auto auto auto",
                          alignItems:"center", gap:8, border:"1px solid #eee", borderRadius:8, padding:"8px 10px" }}>
              <div>โต๊ะ {t.table_number}</div>
              <div>สถานะ: <b>{t.status}</b></div>
              <div style={{ display:"flex", gap:6 }}>
                {t.status === "available" ? (
                  <button disabled={busy} onClick={()=>setStatus(t,"occupied")}
                          style={{ border:"1px solid #ddd", borderRadius:8, padding:"6px 10px", background:"#fff" }}>
                    mark occupied
                  </button>
                ) : (
                  <button disabled={busy} onClick={()=>setStatus(t,"available")}
                          style={{ border:"1px solid #ddd", borderRadius:8, padding:"6px 10px", background:"#fff" }}>
                    set available
                  </button>
                )}
              </div>
              <div>
                <button disabled={busy} onClick={()=>removeTable(t)}
                        style={{ border:"1px solid #ddd", borderRadius:8, padding:"6px 10px", background:"#fff", color:"crimson" }}>
                  ลบ
                </button>
              </div>
            </div>
          ))}
          {tables.length === 0 && <div style={{ opacity:.7 }}>ยังไม่มีโต๊ะ</div>}
        </div>
      </div>
    </div>
  );
}
