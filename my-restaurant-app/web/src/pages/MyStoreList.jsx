// web/src/pages/MyStoreList.jsx
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";

// ระยะทาง (กิโลเมตร)
function haversineKm(lat1, lon1, lat2, lon2) {
  if ([lat1, lon1, lat2, lon2].some(v => typeof v !== "number" || Number.isNaN(v)))
    return Infinity;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/**
 * MyStoreList – หน้าแสดงร้านที่เจ้าของคนนี้สร้าง
 * props:
 *   user: { uid, email, user_type }
 *   onNewStore: () => void        // ไปหน้าสร้างร้าน
 *   onOpenStore: (id: string) => void  // เปิดหน้าร้าน
 */
export default function MyStoreList({ user, onNewStore, onOpenStore }) {
  const [stores, setStores] = useState([]);
  const [me, setMe] = useState({ lat: null, lng: null });
  const [loading, setLoading] = useState(true);

  // ขอพิกัดของผู้ใช้เพื่อคำนวณระยะทาง
  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setMe({ lat: null, lng: null }),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  // โหลดร้านที่ owner_id = user.uid (แบบ realtime)
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

  // รวมระยะทาง
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

  return (
    <div style={{ maxWidth: 540, margin: "0 auto" }}>
      {/* Header ของหน้า (จะถูกวาง title จาก App.jsx อยู่แล้ว) */}
      <div style={{ display: "flex", justifyContent: "space-between", margin: "6px 0 12px" }}>
        <div style={{ fontWeight: 800, fontSize: 18 }}>My Store</div>
        <button
          onClick={onNewStore}
          style={{
            background: "#111",
            color: "#fff",
            border: "none",
            padding: "8px 12px",
            borderRadius: 8,
            fontWeight: 700,
          }}
        >
          + New store
        </button>
      </div>

      {loading && <div>Loading my stores…</div>}
      {!loading && list.length === 0 && (
        <div style={{ opacity: 0.7 }}>
          คุณยังไม่มีร้านที่สร้างเอง — กดปุ่ม <b>New store</b> เพื่อเพิ่มร้านใหม่
        </div>
      )}

      <div style={{ display: "grid", gap: 12 }}>
        {list.map((r) => {
          const km =
            r._distance === Infinity ? "-" : (Math.round(r._distance * 10) / 10).toFixed(1);

          return (
            <button
              key={r.id}
              onClick={() => onOpenStore?.(r.id)}
              style={{
                width: "100%",
                textAlign: "left",
                border: "none",
                background: "transparent",
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "100px 1fr",
                  gap: 12,
                  padding: 10,
                  background: "#fff",
                  borderRadius: 12,
                  boxShadow: "0 1px 6px rgba(0,0,0,.06)",
                }}
              >
                {/* รูปภาพร้าน */}
                <div
                  style={{
                    width: 100,
                    height: 100,
                    borderRadius: 10,
                    overflow: "hidden",
                    background: "#eee",
                  }}
                >
                  {r.image_url ? (
                    <img
                      src={r.image_url}
                      alt={r.name}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        display: "grid",
                        placeItems: "center",
                        color: "#999",
                      }}
                    >
                      🖼️
                    </div>
                  )}
                </div>

                {/* รายละเอียดร้าน */}
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 2 }}>{r.name || "-"}</div>
                  <div style={{ color: "#666", fontSize: 13, marginBottom: 4 }}>
                    {r.type || ""}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span>⭐</span>
                    <span>{typeof r.rating === "number" ? r.rating : "0.0"}</span>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginTop: 4,
                      color: "#666",
                      fontSize: 13,
                    }}
                  >
                    <span>📍</span>
                    <span>{km === "-" ? "-" : `${km} km`}</span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
