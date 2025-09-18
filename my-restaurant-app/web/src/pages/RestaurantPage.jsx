// src/pages/RestaurantPage.jsx
import { useEffect, useMemo, useState } from "react";
import { auth, db } from "../firebase";
import {
  doc, getDoc, setDoc, collection, query, orderBy, onSnapshot,
  addDoc, updateDoc, serverTimestamp, limit
} from "firebase/firestore";
import Toast from "../components/Toast";

// ---------- small UI helpers ----------
function Badge({ children }) {
  return (
    <span style={{
      display: "inline-block", padding: "6px 10px", borderRadius: 12,
      background: "#ffe7cf", color: "#ff7b00", fontWeight: 700, fontSize: 12
    }}>
      {children}
    </span>
  );
}
function IconBtn({ icon, label, onClick, active }) {
  return (
    <button onClick={onClick}
      style={{
        border: "none", background: active ? "#111" : "#f3f3f3", color: active ? "#fff" : "#111",
        borderRadius: 12, padding: "10px 12px", display: "flex", alignItems: "center",
        gap: 8, cursor: "pointer"
      }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      {label && <span style={{ fontWeight: 700 }}>{label}</span>}
    </button>
  );
}
function Star({ filled, onClick }) {
  return (
    <span onClick={onClick} style={{ color: filled ? "#ffbb00" : "#cfcfcf", cursor: "pointer", fontSize: 18 }}>★</span>
  );
}
function StarRating({ value, onChange }) {
  return (
    <div>
      {[1, 2, 3, 4, 5].map(n => <Star key={n} filled={n <= (value ?? 0)} onClick={() => onChange?.(n)} />)}
    </div>
  );
}

// ✅ ชิปแสดงระยะทาง (ปุ่มใหม่)
function DistanceChip({ hasDistance, distanceText, onClick }) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderRadius: 999,
    fontSize: 13,
    border: "1px solid #e6e6e6",
    transition: "background .15s, border-color .15s",
  };
  const activeStyle = {
    ...base,
    background: "#f6f7fb",
    color: "#111",
    cursor: "pointer",
  };
  const disabledStyle = {
    ...base,
    background: "#f7f7f7",
    color: "#9aa0a6",
    cursor: "not-allowed",
    borderColor: "#eee",
  };
  return (
    <button
      type="button"
      onClick={hasDistance ? onClick : undefined}
      disabled={!hasDistance}
      style={hasDistance ? activeStyle : disabledStyle}
      aria-label="Show distance on map"
      title={hasDistance ? "ดูเส้นทางบนแผนที่" : "กำลังรอตำแหน่งของคุณ"}
    >
      <span>📍</span>
      <span>{hasDistance ? `${distanceText} · ดูเส้นทาง` : "ดูระยะทาง"}</span>
    </button>
  );
}

// ---------- distance ----------
function toRad(deg) { return deg * Math.PI / 180; }
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ================== PAGE ==================
export default function RestaurantPage({ id, goBack, onOpenQueue, onCreateTogether, onOpenDistanceMap }) {
  const [rest, setRest] = useState(null);
  const [menus, setMenus] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [fav, setFav] = useState(false);
  const [loading, setLoading] = useState(true);

  // review form
  const [rating, setRating] = useState(5);
  const [taste, setTaste] = useState(5);
  const [service, setService] = useState(5);
  const [comment, setComment] = useState("");

  // current user location
  const [myLoc, setMyLoc] = useState(null);
  const [toast, setToast] = useState({ open: false, text: "" });

  // โหลดข้อมูลร้าน
  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, "restaurants", id), (snap) => {
      if (snap.exists()) setRest({ id: snap.id, ...snap.data() });
      setLoading(false);
    });
    return () => unsub();
  }, [id]);

  // โหลดเมนูทั้งหมด
  useEffect(() => {
    if (!id) return;
    const qRef = query(collection(db, "restaurants", id, "menus"), orderBy("name"));
    const unsub = onSnapshot(qRef, (snap) => {
      setMenus(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [id]);

  // โหลดรีวิว
  useEffect(() => {
    if (!id) return;
    const qRef = query(
      collection(db, "restaurants", id, "reviews"),
      orderBy("created_at", "desc"),
      limit(20)
    );
    const unsub = onSnapshot(qRef, (snap) => {
      setReviews(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [id]);

  // แสดงสถานะ Favorite แบบ realtime (doc เดียว/ผู้ใช้-ร้าน)
  useEffect(() => {
    const u = auth.currentUser;
    if (!u || !id) { setFav(false); return; }
    const favRef = doc(db, "favorites", `fav_${u.uid}_${id}`);
    const unsub = onSnapshot(favRef, (s) => {
      setFav(s.exists() && !s.data()?._deleted);
    });
    return () => unsub();
  }, [id]);

  // toggle favorite: บันทึก/ลบแบบ soft delete
  async function toggleFav() {
    const u = auth.currentUser;
    if (!u || !rest) return alert("กรุณาเข้าสู่ระบบ");

    const favRef = doc(db, "favorites", `fav_${u.uid}_${id}`);
    const snap = await getDoc(favRef);

    if (!snap.exists() || snap.data()?._deleted) {
      await setDoc(favRef, {
        user_id: u.uid,
        restaurant_id: id,
        menu_id: null,
        _deleted: false,
        created_at: serverTimestamp()
      }, { merge: true });
      setToast({ open: true, text: "บันทึกเข้ารายการแล้ว" });
    } else {
      await updateDoc(favRef, { _deleted: true, removed_at: serverTimestamp() });
      setToast({ open: true, text: "ลบออกจากรายการแล้ว" });
    }
  }

  // current loc
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      pos => setMyLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setMyLoc(null),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  const distanceText = useMemo(() => {
    if (!myLoc || !rest?.latitude) return "";
    const km = haversineKm(myLoc.lat, myLoc.lng, rest.latitude, rest.longitude);
    return `${km.toFixed(1)} km`;
  }, [myLoc, rest]);

  // ส่งรีวิว
  async function submitReview() {
    const u = auth.currentUser;
    if (!u) return alert("กรุณาเข้าสู่ระบบก่อนรีวิว");
    if (!rating) return alert("ให้คะแนนก่อนค่ะ");
    const payload = {
      user_id: u.uid,
      restaurant_id: id,
      rating, taste_score: taste, service_score: service,
      comment: comment?.trim() || "",
      image_url: "",
      created_at: serverTimestamp()
    };
    await addDoc(collection(db, "restaurants", id, "reviews"), payload);
    setRating(5); setTaste(5); setService(5); setComment("");
  }

  if (loading) return <div style={{ padding: 12 }}>Loading…</div>;
  if (!rest) return <div style={{ padding: 12 }}>ไม่พบร้าน</div>;

  const hasDistance = Boolean(distanceText);

  return (
    <div style={{ maxWidth: 500, margin: "0 auto", paddingBottom: 80 }}>
      {/* cover + back */}
      <div style={{ position: "relative" }}>
        <img src={rest.image_url || "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=1200"}
          alt="" style={{ width: "100%", height: 220, objectFit: "cover", borderRadius: 10 }} />
        <button onClick={goBack}
          style={{
            position: "absolute", left: 12, top: 12, borderRadius: 999, width: 32, height: 32,
            border: "none", background: "rgba(0,0,0,.6)", color: "#fff"
          }}>
          ←
        </button>
      </div>

      <div style={{ marginTop: -12, background: "#fff", padding: "14px 12px", borderRadius: 12 }}>
        <div style={{ marginBottom: 12 }}><Badge>Popular</Badge></div>

        {/* Title + action */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{rest.name}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <IconBtn icon="👥" onClick={() => onCreateTogether?.(rest.id, rest.name)} />
            {/* เปิดหน้าเลือกโต๊ะ โดยไม่ fallback ไปจองอัตโนมัติ */}
            <IconBtn icon="➕" label="Queue" onClick={() => onOpenQueue?.(rest.id)} />
            <IconBtn icon="🔖" active={fav} onClick={toggleFav} />
          </div>
        </div>

        {/* ✅ แถบข้อมูลใต้ชื่อร้าน: ปุ่ม Distance แบบชิปใหม่ + เรตติ้ง + ประเภทร้าน */}
        <div style={{ marginTop: 8, color: "#555", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <DistanceChip
            hasDistance={hasDistance}
            distanceText={distanceText}
            onClick={() => rest?.id && onOpenDistanceMap?.(rest.id)}
          />
          <span>⭐ {rest.rating?.toFixed?.(1) ?? rest.rating}</span>
          <span style={{ opacity: .7 }}>{rest.type}</span>
        </div>

        <p style={{ marginTop: 8, lineHeight: 1.4 }}>{rest.description || "—"}</p>

        {/* Menu list */}
        <div style={{ fontWeight: 800, marginTop: 10 }}>Menu</div>
        <div style={{ marginTop: 8 }}>
          {menus.length === 0 ? (
            <div style={{ opacity: .6 }}>ยังไม่มีเมนู</div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {menus.map((m) => (
                <div key={m.id} style={{
                  display: "grid", gridTemplateColumns: "64px 1fr auto", gap: 10, alignItems: "center",
                  background: "#fafafa", borderRadius: 10, padding: 8
                }}>
                  <div style={{ width: 64, height: 64, borderRadius: 8, overflow: "hidden", background: "#eee" }}>
                    <img alt="" src={m.image_url || "https://images.unsplash.com/photo-1562967916-eb82221dfb36?q=80&w=600"}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700 }}>{m.name}</div>
                    {!!m.description && <div style={{ fontSize: 12, opacity: .7, marginTop: 2 }}>{m.description}</div>}
                    {!!m.calories && <div style={{ fontSize: 12, opacity: .7, marginTop: 2 }}>{m.calories} kcal</div>}
                  </div>
                  <div style={{ fontWeight: 700 }}>฿{m.price}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Review section */}
        <div style={{ fontWeight: 800, marginTop: 14 }}>Review</div>
        <div style={{ marginTop: 8 }}>
          {reviews.length === 0 && <div style={{ opacity: .6 }}>ยังไม่มีรีวิว</div>}
          {reviews.map(rv => (
            <div key={rv.id} style={{ background: "#fafafa", padding: 8, borderRadius: 10, marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#ddd", display: "grid", placeItems: "center" }}>👤</div>
                <div style={{ fontWeight: 700 }}>User</div>
                <div style={{ marginLeft: "auto" }}><span style={{ color: "#ffbb00" }}>★</span> {rv.rating}</div>
              </div>
              <div style={{ fontSize: 13, marginTop: 6 }}>{rv.comment}</div>
            </div>
          ))}
        </div>

        {/* write review */}
        <div style={{ marginTop: 12, border: "1px solid #eee", borderRadius: 10, padding: 10 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>เขียนรีวิวร้านนี้</div>
          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", alignItems: "center", gap: 8 }}>
            <div>ค่าเฉลี่ย</div><StarRating value={rating} onChange={setRating} />
            <div>รสชาติ</div><StarRating value={taste} onChange={setTaste} />
            <div>การบริการ</div><StarRating value={service} onChange={setService} />
          </div>
          <textarea rows={3} placeholder="คอมเมนต์…" value={comment} onChange={e => setComment(e.target.value)}
            style={{ marginTop: 8, width: "100%", borderRadius: 8, border: "1px solid #ddd", padding: 8 }} />
          <div style={{ marginTop: 8, textAlign: "right" }}>
            <button onClick={submitReview}
              style={{ border: "none", background: "#111", color: "#fff", padding: "8px 12px", borderRadius: 8, cursor: "pointer" }}>
              ส่งรีวิว
            </button>
          </div>
        </div>
      </div>

      {/* Toast */}
      <Toast open={toast.open} text={toast.text} onClose={() => setToast({ open: false, text: "" })} />
    </div>
  );
}
