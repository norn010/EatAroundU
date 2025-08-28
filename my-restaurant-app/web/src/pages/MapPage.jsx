import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Circle, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { db } from "../firebase";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";

// ---- ตั้งค่า icon ค่าเริ่มต้นของ Leaflet ให้โหลดได้เสมอ (กัน 404 ใน bundler) ----
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ---- ไอคอน “จุดตำแหน่งผู้ใช้” (สีน้ำเงิน) ----
const userIcon = L.divIcon({
  className: "user-dot",
  html: "",
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

// ---- ฟังก์ชันคำนวณระยะทาง Haversine (หน่วยกม.) ----
function haversine(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2  
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function renderStars(rating = 0) {
  const r = Math.max(0, Math.min(5, Number(rating) || 0));
  const full = Math.floor(r);
  const half = r - full >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return (
    <span aria-label={`rating ${r.toFixed(1)} stars`}>
      {"★".repeat(full)}
      {half ? "☆" : ""}
      {"☆".repeat(empty)}
    </span>
  );
}
export default function MapPage({ onOpenRestaurant, setTitle }) {
  // ศูนย์กลางวงรัศมี (เริ่มต้น Khao Yai area)
  const [center, setCenter] = useState([14.8907, 102.1580]);
  // ตำแหน่งผู้ใช้   ความแม่นยำ (เมตร)
  const [userPos, setUserPos] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  // รัศมีฟิลเตอร์ (กม.)
  const [radiusKm, setRadiusKm] = useState(2);
  // ร้านหลังกรอง
  const [restaurants, setRestaurants] = useState([]);

  const mapRef = useRef(null);

  // ชื่อหน้า
  useEffect(() => { setTitle?.("Home"); }, [setTitle]);

  // เปิด geolocation แบบ realtime
  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const c = [pos.coords.latitude, pos.coords.longitude];
        setUserPos(c);
        setAccuracy(pos.coords.accuracy);
        // ตั้งค่า center ครั้งแรกหากอยากให้ใช้ตำแหน่งเรา
        // setCenter((old) => old ?? c);
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    );
    return () => {
      if (navigator.geolocation.clearWatch) navigator.geolocation.clearWatch(id);
    };
  }, []);

  // ดึงร้านจาก Firestore แบบ realtime   กรองรัศมีใน client
  useEffect(() => {
  const [lat, lng] = center;

  // 1°latitude ≈ 110.574 km
  const deltaLat = radiusKm / 110.574;

  // 1°longitude ≈ 111.320 * cos(latitude) km  (กันหารศูนย์ด้วยค่า fallback เล็ก ๆ)
  const cosLat = Math.cos((lat * Math.PI) / 180) || 1e-6;
  const deltaLng = radiusKm / (111.320 * cosLat);

  const minLat = lat - deltaLat;
  const maxLat = lat + deltaLat;
  const minLng = lng - deltaLng;
  const maxLng = lng + deltaLng;

  // Firestore ทำ range ได้ทีละฟิลด์ → ใช้ latitude เป็น pre-filter ใน server
  const qRef = query(
    collection(db, "restaurants"),
    where("latitude", ">=", minLat),
    where("latitude", "<=", maxLat),
    orderBy("latitude")
  );

  const unsub = onSnapshot(qRef, (snap) => {
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const filtered = rows.filter((r) => {
      // ต้องเป็น number เท่านั้น
      if (typeof r.latitude !== "number" || typeof r.longitude !== "number") return false;

      // กรองกรอบสี่เหลี่ยมฝั่ง client อีกชั้น (longitude)
      if (r.longitude < minLng || r.longitude > maxLng) return false;

      // สุดท้ายกรองด้วยรัศมีจริง ๆ
      const distKm = haversine(lat, lng, r.latitude, r.longitude);
      return distKm <= radiusKm + 1e-6; // บวกเผื่อเลขทศนิยมเล็กน้อย
    });

    setRestaurants(filtered);
  });

  return () => unsub();
}, [center, radiusKm]);

  // UI ของแผนที่
  const mapUI = useMemo(() => (
    <MapContainer
      center={center}
      zoom={15}
      style={{ height: 420, width: "100%", borderRadius: 12, overflow: "hidden" }}
      whenCreated={(m) => (mapRef.current = m)}
    >
      <TileLayer
        attribution='&copy; OpenStreetMap'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* วงรัศมีที่ใช้ค้นหา */}
      <Circle
        center={center}
        radius={radiusKm * 1000}
        pathOptions={{ color: "blue" }}
      />

      {/* ตำแหน่งผู้ใช้: วงความแม่นยำ   จุดสีน้ำเงิน */}
      {userPos && (
        <>
          <Circle
            center={userPos}
            radius={Math.max(accuracy || 30, 30)}
            pathOptions={{
              color: "#3b82f6",
              weight: 1,
              fillColor: "#60a5fa",
              fillOpacity: 0.15,
            }}
          />
          <Marker position={userPos} icon={userIcon} />
        </>
      )}

      {/* ร้านในรัศมี */}
      {restaurants.map((r) => (
    <Marker key={r.id} position={[r.latitude, r.longitude]}>
      <Popup>
        <div style={{minWidth: 180}}>
          <div style={{fontWeight: 700, marginBottom: 4}}>
            {r.name || "ร้านไม่มีชื่อ"}
          </div>
          <div style={{fontSize: 13, opacity: .85, marginBottom: 8}}>
            {renderStars(r.rating)} <span style={{marginLeft:6}}>{Number(r.rating||0).toFixed(1)}</span>
          </div>
          <button
            onClick={() => onOpenRestaurant?.(r.id)}
            style={{
              width: "100%", padding: "8px 10px", borderRadius: 6,
              background: "#111", color: "#fff", border: "none"
            }}
          >
            ไปหน้าร้าน
          </button>
        </div>
      </Popup>
    </Marker>
  ))}
    </MapContainer>
  ), [center, radiusKm, userPos, accuracy, restaurants, onOpenRestaurant]);

  return (
    <div>
      {/* แถบควบคุมด้านบน */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <span>รัศมี (กม.)</span>
        <input
          type="range"
          min={1}
          max={10}
          value={radiusKm}
          onChange={(e) => setRadiusKm(Number(e.target.value))}
        />
        <b>{radiusKm} km</b>

        <button
          style={{ marginLeft: "auto" }}
          onClick={() => {
            if (userPos) {
              setCenter(userPos);
              mapRef.current?.flyTo(userPos, 15, { duration: 0.4 });
            } else if (navigator.geolocation) {
              navigator.geolocation.getCurrentPosition((pos) => {
                const c = [pos.coords.latitude, pos.coords.longitude];
                setCenter(c);
                mapRef.current?.flyTo(c, 15, { duration: 0.4 });
              });
            }
          }}
        >
          ใช้ตำแหน่งฉัน
        </button>
      </div>

      {mapUI}
    </div>
  );
}
