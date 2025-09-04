import { useEffect, useMemo, useState } from "react";
import {
  collection, onSnapshot, query, where,
  getDocs, deleteDoc, doc
} from "firebase/firestore";
import { db } from "../firebase";

// ระยะทาง (กิโลเมตร)
function haversineKm(lat1, lon1, lat2, lon2) {
  if ([lat1, lon1, lat2, lon2].some((v) => typeof v !== "number" || Number.isNaN(v)))
    return Infinity;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/**
 * MyStoreList – หน้าแสดงร้านที่เจ้าของคนนี้สร้าง
 * props:
 *   user: { uid, email, user_type }
 *   onNewStore: () => void
 *   onOpenStore: (id: string) => void
 *   onEditStore: (id: string) => void
 *   onQueueManage: (id: string) => void   // ✅ เปิดหน้า Queue/Tables
 */
export default function MyStoreList({
  user,
  onNewStore,
  onOpenStore,
  onEditStore,
  onQueueManage,         // ✅ เพิ่ม
}) {
  const [stores, setStores] = useState([]);
  const [me, setMe] = useState({ lat: null, lng: null });
  const [loading, setLoading] = useState(true);
  const [busyDelete, setBusyDelete] = useState("");

  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setMe({ lat: null, lng: null }),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    setLoading(true);
    const q = query(collection(db, "restaurants"), where("owner_id", "==", user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setStores(rows);
      setLoading(false);
    });
    return () => unsub();
  }, [user?.uid]);

  const list = useMemo(() => {
    return stores
      .map((r) => ({
        ...r,
        _distance:
          me.lat == null || me.lng == null
            ? Infinity
            : haversineKm(me.lat, me.lng, r.latitude, r.longitude),
      }))
      .sort((a, b) => {
        if (a._distance !== b._distance) return a._distance - b._distance;
        return String(a.name || "").localeCompare(String(b.name || ""));
      });
  }, [stores, me.lat, me.lng]);

  // ลบร้าน + subcollections (menus, tables, reviews)
  async function deleteRestaurantCascade(restId) {
    const subs = ["menus", "tables", "reviews"];
    for (const sub of subs) {
      const snap = await getDocs(collection(db, "restaurants", restId, sub));
      const jobs = snap.docs.map((d) =>
        deleteDoc(doc(db, "restaurants", restId, sub, d.id))
      );
      await Promise.all(jobs);
    }
    await deleteDoc(doc(db, "restaurants", restId));
  }

  async function handleDelete(id, name) {
    if (!id) return;
    if (!window.confirm(`ยืนยันลบร้าน "${name || "-"}" ?`)) return;
    try {
      setBusyDelete(id);
      await deleteRestaurantCascade(id);
    } catch (e) {
      alert("ลบร้านไม่สำเร็จ: " + (e.message || e));
    } finally {
      setBusyDelete("");
    }
  }

  return (
    <div style={{ maxWidth: 540, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", margin: "6px 0 12px" }}>
        <div style={{ fontWeight: 800, fontSize: 18 }}>My Store</div>
        <button
          onClick={onNewStore}
          style={{
            background: "#111", color: "#fff", border: "none",
            padding: "8px 12px", borderRadius: 8, fontWeight: 700
          }}
        >
          + New store
        </button>
      </div>

      {loading && <div>Loading my stores…</div>}
      {!loading && list.length === 0 && (
        <div style={{ opacity: 0.7 }}>
          คุณยังไม่มีร้านที่สร้างเอง — กด <b>New store</b> เพื่อเพิ่มร้านใหม่
        </div>
      )}

      <div style={{ display: "grid", gap: 12 }}>
        {list.map((r) => {
          const km =
            r._distance === Infinity ? "-" : (Math.round(r._distance * 10) / 10).toFixed(1);
          const deleting = busyDelete === r.id;

          return (
            <div
              key={r.id}
              style={{
                display: "grid", gridTemplateColumns: "100px 1fr 150px",
                gap: 12, padding: 10, background: "#fff", borderRadius: 12,
                boxShadow: "0 1px 6px rgba(0,0,0,.06)", alignItems: "center"
              }}
            >
              <div style={{ width: 100, height: 100, borderRadius: 10, overflow: "hidden", background: "#eee" }}>
                {r.image_url ? (
                  <img src={r.image_url} alt={r.name} style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
                ) : (
                  <div style={{ width:"100%", height:"100%", display:"grid", placeItems:"center", color:"#999" }}>🖼️</div>
                )}
              </div>

              <div style={{ minWidth:0 }}>
                <div style={{ fontWeight:700, marginBottom:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {r.name || "-"}
                </div>
                <div style={{ color:"#666", fontSize:13, marginBottom:4 }}>{r.type || ""}</div>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span>⭐</span><span>{typeof r.rating === "number" ? r.rating : "0.0"}</span>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:4, color:"#666", fontSize:13 }}>
                  <span>📍</span><span>{km === "-" ? "-" : `${km} km`}</span>
                </div>
                <div style={{ marginTop:8, display:"flex", gap:8, flexWrap:"wrap" }}>
                  <button
                    onClick={() => onOpenStore?.(r.id)}
                    style={{ border:"1px solid #ddd", background:"#fff", borderRadius:8, padding:"6px 10px", cursor:"pointer" }}
                  >
                    เปิดหน้าร้าน
                  </button>
                  {/* ✅ ปุ่มจัดการโต๊ะ/คิว */}
                  <button
                    onClick={() => onQueueManage?.(r.id)}
                    style={{ border:"1px solid #ddd", background:"#fff", borderRadius:8, padding:"6px 10px", cursor:"pointer" }}
                  >
                    Queue / Tables
                  </button>
                </div>
              </div>

              <div style={{ display:"grid", gap:6, justifyContent:"end" }}>
                <button
                  onClick={() => onEditStore?.(r.id)}
                  style={{ border:"none", background:"#111", color:"#fff", padding:"6px 10px", borderRadius:8, cursor:"pointer" }}
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(r.id, r.name)}
                  disabled={deleting}
                  style={{
                    border:"1px solid #ddd", background:"#fff", padding:"6px 10px",
                    borderRadius:8, cursor:"pointer", opacity: deleting ? .6 : 1
                  }}
                >
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
