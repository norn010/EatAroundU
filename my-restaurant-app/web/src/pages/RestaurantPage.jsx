import { useEffect, useMemo, useState } from "react";
import { auth, db } from "../firebase";
import {
  doc, getDoc, collection, query, where, orderBy, onSnapshot, addDoc, updateDoc,
  serverTimestamp, getDocs, limit
} from "firebase/firestore";

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
    <span onClick={onClick} style={{ color: filled ? "#ffbb00" : "#cfcfcf", cursor: "pointer", fontSize: 18 }}>
      ★
    </span>
  )
}
function StarRating({ value, onChange }) {
  return (
    <div>
      {[1,2,3,4,5].map(n =>
        <Star key={n} filled={n <= (value ?? 0)} onClick={() => onChange?.(n)} />
      )}
    </div>
  );
}
// ---------- distance ----------
function toRad(deg) { return deg * Math.PI / 180; }
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ================== PAGE ==================
export default function RestaurantPage({ id, goBack }) {
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

  // current user location (ไว้แสดงระยะทาง)
  const [myLoc, setMyLoc] = useState(null);

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, "restaurants", id), (snap) => {
      if (snap.exists()) setRest({ id: snap.id, ...snap.data() });
      setLoading(false);
    });
    return () => unsub();
  }, [id]);

  // popular menu
  // useEffect(() => {
  //   if (!id) return;
  //   const qRef = query(
  //     collection(db, "restaurants", id, "menus"),
  //     where("is_popular", "==", 1),
  //     orderBy("name")
  //   );
  //   const unsub = onSnapshot(qRef, (snap) => {
  //     setMenus(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  //   });
  //   return () => unsub();
  // }, [id]);

  // menus (all menus)
useEffect(() => {
  if (!id) return;
  const qRef = query(
    collection(db, "restaurants", id, "menus"),
    orderBy("name")   // หรือเปลี่ยนเป็น orderBy("created_at")
  );
  const unsub = onSnapshot(qRef, (snap) => {
    setMenus(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
  return () => unsub();
}, [id]);

  // reviews
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

  // favorite (ตรวจว่าเคย fav ร้านนี้หรือยัง)
  useEffect(() => {
    (async () => {
      const u = auth.currentUser;
      if (!u || !id) return setFav(false);
      const qRef = query(
        collection(db, "favorites"),
        where("user_id", "==", u.uid),
        where("restaurant_id", "==", id),
        limit(1)
      );
      const snap = await getDocs(qRef);
      setFav(!snap.empty);
    })();
  }, [id]);

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

  // ---------- actions ----------
  async function toggleFav() {
    const u = auth.currentUser;
    if (!u || !rest) return alert("กรุณาเข้าสู่ระบบ");
    setFav((v) => !v);

    // ถ้ายังไม่เคย favorite -> add
    const qRef = query(
      collection(db, "favorites"),
      where("user_id", "==", u.uid),
      where("restaurant_id", "==", rest.id),
      limit(1)
    );
    const snap = await getDocs(qRef);
    if (snap.empty) {
      await addDoc(collection(db, "favorites"), {
        user_id: u.uid, restaurant_id: rest.id, menu_id: null,
        note: "", rating: null, created_at: serverTimestamp()
      });
    } else {
      // ถ้ามีอยู่แล้ว ลบออก (ใช้ doc เดิม)
      await updateDoc(doc(db, "favorites", snap.docs[0].id), { _deleted: true });
    }
  }

  // จองโต๊ะ (หาโต๊ะว่างตัวแรกใน subcollection tables)
  async function addQueue() {
    const u = auth.currentUser;
    if (!u) return alert("กรุณาเข้าสู่ระบบ");
    const tbRef = collection(db, "restaurants", id, "tables");
    const qRef = query(tbRef, where("status", "==", "available"), orderBy("table_number"), limit(1));
    const snap = await getDocs(qRef);
    if (snap.empty) return alert("ขอโทษค่ะ ขณะนี้ไม่มีโต๊ะว่าง");

    const tdoc = snap.docs[0];               // โต๊ะตัวแรก
    // update โต๊ะให้เต็ม + create booking
    await updateDoc(doc(db, "restaurants", id, "tables", tdoc.id), { status: "occupied", updated_at: serverTimestamp() });
    await addDoc(collection(db, "table_bookings"), {
      restaurant_id: id,
      table_id: tdoc.id,
      user_id: u.uid,
      reserved_at: serverTimestamp(),
      canceled_at: null,
      created_at: serverTimestamp()
    });

    alert(`จองโต๊ะหมายเลข ${tdoc.data().table_number} เรียบร้อย`);
  }

  // Together -> สร้างห้อง (public code 4 หลัก)
  async function createTogether() {
    const u = auth.currentUser;
    if (!u || !rest) return alert("กรุณาเข้าสู่ระบบ");
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const ref = await addDoc(collection(db, "together_rooms"), {
      creator_id: u.uid,
      restaurant_id: id,
      meet_date: new Date().toISOString().slice(0,10),  // today
      meet_time: "19:00",
      is_private: false,
      join_code: code,
      created_at: serverTimestamp()
    });
    alert(`สร้างห้อง Together แล้ว (code: ${code})\nroom: ${ref.id}`);
  }

  // ส่งรีวิว
  async function submitReview() {
    const u = auth.currentUser;
    if (!u) return alert("กรุณาเข้าสู่ระบบก่อนรีวิว");
    if (!rating) return alert("ให้คะแนนก่อนค่ะ");
    const payload = {
      user_id: u.uid,
      restaurant_id: id,
      rating: rating,
      taste_score: taste,
      service_score: service,
      comment: comment?.trim() || "",
      image_url: "",
      created_at: serverTimestamp()
    };
    await addDoc(collection(db, "restaurants", id, "reviews"), payload);

    setRating(5); setTaste(5); setService(5); setComment("");
  }

  if (loading) return <div style={{ padding: 12 }}>Loading…</div>;
  if (!rest) return <div style={{ padding: 12 }}>ไม่พบร้าน</div>;

  return (
    <div style={{ maxWidth: 500, margin: "0 auto", paddingBottom: 80 }}>
      {/* cover img + back */}
      <div style={{ position: "relative" }}>
        <img src={rest.image_url || "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=1200"}
             alt="" style={{ width: "100%", height: 220, objectFit: "cover", borderRadius: 10 }} />
        <button onClick={goBack}
                style={{ position: "absolute", left: 12, top: 12, borderRadius: 999, width: 32, height: 32, border: "none",
                    background: "rgba(0,0,0,.6)", color: "#fff" }}>
          ←
        </button>
      </div>

      <div style={{ marginTop: -12, background: "#fff", padding: "14px 12px", borderRadius: 12 }}>
        <div style={{ marginBottom: 12 }}>
          <Badge>Popular</Badge>
        </div>

        {/* Title and action */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{rest.name}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <IconBtn icon="👥" onClick={createTogether} />
            <IconBtn icon="➕" label="Queue" onClick={addQueue} />
            <IconBtn icon="🔖" active={fav} onClick={toggleFav} />
          </div>
        </div>

        <div style={{ marginTop: 6, color: "#555", display: "flex", gap: 10, alignItems: "center" }}>
          <span>📍 {distanceText || "—"}</span>
          <span>⭐ {rest.rating?.toFixed?.(1) ?? rest.rating}</span>
          <span style={{ opacity: .7 }}>{rest.type}</span>
        </div>

        <p style={{ marginTop: 8, lineHeight: 1.4 }}>
          {rest.description || "—"}
        </p>

        {/* Popular menu */}
        {/* <div style={{ fontWeight: 800, marginTop: 10 }}>Popular Menu</div>
        <div style={{ whiteSpace: "nowrap", overflowX: "auto", marginTop: 8, paddingBottom: 8 }}>
          {menus.map(m => (
            <div key={m.id} style={{
              display: "inline-block", width: 120, marginRight: 10, background: "#fafafa",
              borderRadius: 10, padding: 8, textAlign: "center"
            }}>
              <img alt="" src={m.image_url || "https://images.unsplash.com/photo-1562967916-eb82221dfb36?q=80&w=800"}
                   style={{ width: "100%", height: 90, objectFit: "cover", borderRadius: 8 }} />
              <div style={{ marginTop: 6, fontWeight: 700, fontSize: 12 }}>{m.name}</div>
              <div style={{ fontSize: 11, opacity: .7 }}>฿{m.price}</div>
            </div>
          ))}
        </div> */}
        {/* all menu */}
<div style={{ fontWeight: 800, marginTop: 10 }}>Menu</div>

<div style={{ marginTop: 8 }}>
  {menus.length === 0 ? (
    <div style={{ opacity: .6 }}>ยังไม่มีเมนู</div>
  ) : (
    <div style={{ display: "grid", gap: 8 }}>
      {menus.map((m) => (
        <div key={m.id}
             style={{
               display: "grid",
               gridTemplateColumns: "64px 1fr auto",
               gap: 10,
               alignItems: "center",
               background: "#fafafa",
               borderRadius: 10,
               padding: 8
             }}>
          <div style={{ width: 64, height: 64, borderRadius: 8, overflow: "hidden", background:"#eee" }}>
            <img
              alt=""
              src={m.image_url || "https://images.unsplash.com/photo-1562967916-eb82221dfb36?q=80&w=600"}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>

          <div>
            <div style={{ fontWeight: 700 }}>{m.name}</div>
            {!!m.description && (
              <div style={{ fontSize: 12, opacity: .7, marginTop: 2 }}>{m.description}</div>
            )}
            {!!m.calories && (
              <div style={{ fontSize: 12, opacity: .7, marginTop: 2 }}>{m.calories} kcal</div>
            )}
          </div>

          <div style={{ fontWeight: 700 }}>฿{m.price}</div>
        </div>
      ))}
    </div>
  )}
</div>

        {/* Review section */}
        <div style={{ fontWeight: 800, marginTop: 14 }}>Review</div>

        {/* รีวิวล่าสุด */}
        <div style={{ marginTop: 8 }}>
          {reviews.length === 0 && <div style={{ opacity: .6 }}>ยังไม่มีรีวิว</div>}
          {reviews.map(rv => (
            <div key={rv.id} style={{ background: "#fafafa", padding: 8, borderRadius: 10, marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#ddd", display: "grid", placeItems: "center" }}>👤</div>
                <div style={{ fontWeight: 700 }}>User</div>
                <div style={{ marginLeft: "auto" }}>
                  <span style={{ color: "#ffbb00" }}>★</span> {rv.rating}
                </div>
              </div>
              <div style={{ fontSize: 13, marginTop: 6 }}>{rv.comment}</div>
            </div>
          ))}
        </div>

        {/* write review */}
        <div style={{ marginTop: 12, border: "1px solid #eee", borderRadius: 10, padding: 10 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>เขียนรีวิวร้านนี้</div>

          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", alignItems: "center", gap: 8 }}>
            <div>ค่าเฉลี่ย</div>
            <StarRating value={rating} onChange={setRating} />
            <div>รสชาติ</div>
            <StarRating value={taste} onChange={setTaste} />
            <div>การบริการ</div>
            <StarRating value={service} onChange={setService} />
          </div>

          <textarea
            rows={3}
            placeholder="คอมเมนต์…"
            value={comment}
            onChange={e => setComment(e.target.value)}
            style={{ marginTop: 8, width: "100%", borderRadius: 8, border: "1px solid #ddd", padding: 0 }}
          />
          <div style={{ marginTop: 8, textAlign: "right" }}>
            <button
              onClick={submitReview}
              style={{ border: "none", background: "#111", color: "#fff", padding: "8px 12px", borderRadius: 8, cursor: "pointer" }}>
              ส่งรีวิว
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
