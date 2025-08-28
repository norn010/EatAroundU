// src/pages/SavedPage.jsx
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
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

export default function SavedPage({ onOpenRestaurant }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // โหลด favorites ของ user ปัจจุบัน
  useEffect(() => {
    const u = auth.currentUser;
    if (!u) {
      setItems([]);
      setLoading(false);
      return;
    }
    const qRef = query(
      collection(db, "favorites"),
      where("user_id", "==", u.uid),
      orderBy("created_at", "desc")
    );

    const unsub = onSnapshot(qRef, async (snap) => {
      const favs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // enrich ด้วยรายละเอียดร้าน/เมนู
      const detailed = await Promise.all(
        favs.map(async (f) => {
          try {
            let rest = null;
            let menu = null;
            if (f.restaurant_id) {
              const rdoc = await getDoc(doc(db, "restaurants", f.restaurant_id));
              rest = rdoc.exists() ? { id: rdoc.id, ...rdoc.data() } : null;
              if (f.menu_id) {
                const mdoc = await getDoc(
                  doc(db, "restaurants", f.restaurant_id, "menus", f.menu_id)
                );
                menu = mdoc.exists() ? { id: mdoc.id, ...mdoc.data() } : null;
              }
            }
            return { ...f, rest, menu };
          } catch (e) {
            console.error("load favorite detail error:", e);
            return { ...f, rest: null, menu: null };
          }
        })
      );

      // filter ที่ถูกลบ (_deleted = true)
      setItems(detailed.filter((x) => !x._deleted));
      setLoading(false);
    });

    return () => unsub();
  }, []);

  async function unsaveFavorite(favId) {
    try {
      await updateDoc(doc(db, "favorites", favId), {
        _deleted: true,
        removed_at: serverTimestamp(),
      });
    } catch (e) {
      alert("ลบออกจาก Saved ไม่สำเร็จ: " + e.message);
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: "0 auto" }}>
      <h3 style={{ margin: "8px 0 12px 0" }}>Saved</h3>

      {loading && <div>Loading…</div>}
      {!loading && items.length === 0 && (
        <div style={{ opacity: 0.7 }}>ยังไม่มีที่บันทึก</div>
      )}

      {!loading &&
        items.map((f) => {
          const r = f.rest;
          const m = f.menu;
          return (
            <div
              key={f.id}
              style={{
                display: "grid",
                gridTemplateColumns: "80px 1fr auto",
                gap: 12,
                alignItems: "center",
                background: "#fff",
                borderRadius: 12,
                boxShadow: "0 1px 6px rgba(0,0,0,.06)",
                padding: 10,
                marginBottom: 12,
              }}
            >
              {/* รูป */}
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 10,
                  overflow: "hidden",
                  background: "#eee",
                }}
              >
                {r?.image_url ? (
                  <img
                    src={r.image_url}
                    alt={r?.name || "restaurant"}
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

              {/* ข้อความ */}
              <div>
                <div style={{ fontWeight: 700, marginBottom: 2 }}>
                  {r?.name || "(ร้านถูกลบ)"}
                </div>
                {typeof r?.rating === "number" && (
                  <div style={{ fontSize: 13, color: "#444" }}>
                    ⭐ {r.rating.toFixed ? r.rating.toFixed(1) : r.rating}
                  </div>
                )}
                {/* ถ้าเป็นเมนูที่เซฟ */}
                {m && (
                  <div style={{ fontSize: 12, marginTop: 4 }}>
                    <span style={{ opacity: 0.7 }}>เมนู: </span>
                    {m.name} — ฿{m.price}
                  </div>
                )}
                {f.note && (
                  <div style={{ fontSize: 12, marginTop: 4, opacity: 0.8 }}>
                    Note: {f.note}
                  </div>
                )}
              </div>

              {/* ปุ่ม */}
              <div style={{ display: "grid", gap: 6 }}>
                {r && (
                  <button
                    type="button"
                    onClick={() => onOpenRestaurant?.(r.id)}
                    style={{
                      border: "none",
                      background: "#111",
                      color: "#fff",
                      padding: "6px 10px",
                      borderRadius: 8,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    เปิดดูร้าน
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => unsaveFavorite(f.id)}
                  style={{
                    border: "1px solid #ddd",
                    background: "#fff",
                    padding: "6px 10px",
                    borderRadius: 8,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  ลบออก
                </button>
              </div>
            </div>
          );
        })}
    </div>
  );
}
