// src/pages/MapPage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Circle, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { db } from "../firebase";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";

// --- Fix leaflet default icon paths ---
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// --- Blue dot for user position ---
const userIcon = L.divIcon({
  className: "user-dot",
  html: "",
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

// --- Haversine distance (km) ---
function haversine(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2; // ← ใส่ + ที่หาย
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
  const [center, setCenter] = useState([14.8907, 102.158]);
  const [userPos, setUserPos] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [radiusKm, setRadiusKm] = useState(2);
  const [restaurants, setRestaurants] = useState([]);

  const mapRef = useRef(null);

  useEffect(() => { setTitle?.("Home"); }, [setTitle]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const c = [pos.coords.latitude, pos.coords.longitude];
        setUserPos(c);
        setAccuracy(pos.coords.accuracy);
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    );
    return () => navigator.geolocation.clearWatch?.(id);
  }, []);

  // fetch & filter by radius
  useEffect(() => {
    const [lat, lng] = center;

    const deltaLat = radiusKm / 110.574;
    const cosLat = Math.cos((lat * Math.PI) / 180) || 1e-6;
    const deltaLng = radiusKm / (111.320 * cosLat);

    const minLat = lat - deltaLat;
    const maxLat = lat + deltaLat;
    const minLng = lng - deltaLng;
    const maxLng = lng + deltaLng;

    const qRef = query(
      collection(db, "restaurants"),
      where("latitude", ">=", minLat),
      where("latitude", "<=", maxLat),
      orderBy("latitude")
    );

    const unsub = onSnapshot(qRef, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const filtered = rows.filter((r) => {
        if (typeof r.latitude !== "number" || typeof r.longitude !== "number") return false;
        if (r.longitude < minLng || r.longitude > maxLng) return false;
        const distKm = haversine(lat, lng, r.latitude, r.longitude);
        return distKm <= radiusKm + 1e-6;
      });
      setRestaurants(filtered);
    });

    return () => unsub();
  }, [center, radiusKm]);

  const mapUI = useMemo(() => (
    <MapContainer
      center={center}
      zoom={15}
      style={{ height: 700, width: "100%", borderRadius: 12, overflow: "hidden" }}
      whenCreated={(m) => (mapRef.current = m)}
    >
      <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

      <Circle center={center} radius={radiusKm * 1000} pathOptions={{ color: "blue" }} />

      {userPos && (
        <>
          <Circle
            center={userPos}
            radius={Math.max(accuracy || 30, 30)}
            pathOptions={{ color: "#3b82f6", weight: 1, fillColor: "#60a5fa", fillOpacity: 0.15 }}
          />
          <Marker position={userPos} icon={userIcon} />
        </>
      )}

      {/* ร้านในรัศมี */}
      {restaurants.map((r) => (
        <Marker key={r.id} position={[r.latitude, r.longitude]}>
          <Popup>
            <div style={{ minWidth: 200 }}>
              {/* รูปร้าน */}
              {r.image_url ? (
                <img
                  src={r.image_url}
                  alt={r.name || "restaurant"}
                  style={{
                    width: "100%",
                    height: 120,
                    objectFit: "cover",
                    borderRadius: 8,
                    marginBottom: 8,
                    background: "#f3f3f3",
                  }}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: 120,
                    borderRadius: 8,
                    background: "#f3f3f3",
                    display: "grid",
                    placeItems: "center",
                    marginBottom: 8,
                    fontSize: 12,
                    color: "#777",
                  }}
                >
                  ไม่มีรูป
                </div>
              )}

              <div style={{ fontWeight: 700, marginBottom: 4 }}>
                {r.name || "ร้านไม่มีชื่อ"}
              </div>
              <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 8 }}>
                {renderStars(r.rating)} <span style={{ marginLeft: 6 }}>{Number(r.rating || 0).toFixed(1)}</span>
              </div>

              <button
                onClick={() => onOpenRestaurant?.(r.id)}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 6,
                  background: "#111",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
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
