import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup, Circle } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

// Leaflet assets
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const userIcon = L.divIcon({
  className: "user-dot",
  html: "",
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

// --- helper: Haversine distance ---
function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function RestaurantDistancePage({ restId, goBack, setTitle }) {
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [userPos, setUserPos] = useState(null);
  const [accuracy, setAccuracy] = useState(null);

  // แสดง/ซ่อนเส้นทางตามถนน (ปุ่มเดียว Path)
  const [showPath, setShowPath] = useState(false);

  // ข้อมูลเส้นทางที่ได้จาก OSRM (driving)
  const [routeCoords, setRouteCoords] = useState(null); // [[lat,lng], ...]
  const [routeInfo, setRouteInfo] = useState(null);     // { distanceKm, durationMin }
  const [routingError, setRoutingError] = useState(null);

  const mapRef = useRef(null);

  // Title
  useEffect(() => {
    if (!setTitle) return;
    if (restaurant?.name) setTitle(`Distance - ${restaurant.name}`);
    else setTitle("Distance");
  }, [setTitle, restaurant?.name]);

  // โหลดข้อมูลร้าน
  useEffect(() => {
    let active = true;
    setLoading(true);
    setRestaurant(null);
    setError(null);
    if (!restId) {
      setLoading(false);
      setError("Restaurant not found");
      return () => { active = false; };
    }

    (async () => {
      try {
        const snap = await getDoc(doc(db, "restaurants", restId));
        if (!active) return;
        if (snap.exists()) setRestaurant({ id: snap.id, ...snap.data() });
        else setError("Restaurant not found");
      } catch {
        if (active) setError("Unable to load restaurant data");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => { active = false; };
  }, [restId]);

  // ติดตามตำแหน่งผู้ใช้
  useEffect(() => {
    if (!navigator.geolocation) {
      setError((prev) => prev ?? "Location service not available");
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = [pos.coords.latitude, pos.coords.longitude];
        setUserPos(coords);
        setAccuracy(pos.coords.accuracy);
      },
      () => setError((prev) => prev ?? "Unable to fetch your location"),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    );
    return () => navigator.geolocation.clearWatch?.(watchId);
  }, []);

  // fit map
  useEffect(() => {
    if (!mapRef.current || !restaurant?.latitude || !restaurant?.longitude) return;
    if (routeCoords?.length) {
      const b = L.latLngBounds(routeCoords);
      mapRef.current.fitBounds(b.pad(0.2));
    } else if (userPos) {
      const bounds = L.latLngBounds([userPos, [restaurant.latitude, restaurant.longitude]]);
      mapRef.current.fitBounds(bounds.pad(0.25));
    } else {
      mapRef.current.setView([restaurant.latitude, restaurant.longitude], 16);
    }
  }, [restaurant, userPos, routeCoords]);

  // ระยะตรง (fallback)
  const distanceStraightKm = useMemo(() => {
    if (!userPos || !restaurant?.latitude || !restaurant?.longitude) return null;
    return haversineKm(userPos[0], userPos[1], restaurant.latitude, restaurant.longitude);
  }, [userPos, restaurant]);

  // โหลดเส้นทางจาก OSRM เมื่อกด Path (ON)
  useEffect(() => {
    if (!showPath || !userPos || !restaurant?.latitude || !restaurant?.longitude) {
      setRouteCoords(null);
      setRouteInfo(null);
      setRoutingError(null);
      return;
    }
    const controller = new AbortController();

    async function getRoute() {
      setRoutingError(null);
      setRouteCoords(null);
      setRouteInfo(null);

      // ใช้ profile = driving เป็นค่า default
      const url = `https://router.project-osrm.org/route/v1/driving/${userPos[1]},${userPos[0]};${restaurant.longitude},${restaurant.latitude}?overview=full&geometries=geojson&alternatives=false&steps=false`;
      try {
        const resp = await fetch(url, { signal: controller.signal });
        const data = await resp.json();
        if (data.code !== "Ok" || !data.routes?.length) {
          throw new Error(data.message || "No route");
        }
        const r = data.routes[0];
        const coords = r.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
        setRouteCoords(coords);
        setRouteInfo({
          distanceKm: r.distance / 1000,
          durationMin: r.duration / 60,
        });
      } catch (e) {
        if (e.name !== "AbortError") {
          setRoutingError(e.message || "Routing error");
          setRouteCoords(null);
          setRouteInfo(null);
        }
      }
    }

    getRoute();
    return () => controller.abort();
  }, [showPath, userPos, restaurant?.id, restaurant?.latitude, restaurant?.longitude]);

  // text แสดงผล
  const straightText =
    distanceStraightKm != null ? `${distanceStraightKm.toFixed(2)} km` : "—";

  const pathText =
    routeInfo?.distanceKm != null ? `${routeInfo.distanceKm.toFixed(2)} km` : null;

  const durationText =
    routeInfo?.durationMin != null ? `${Math.round(routeInfo.durationMin)} min` : null;

  if (loading) return <div style={{ padding: 12 }}>Loading...</div>;

  if (error && !restaurant) {
    return (
      <div style={{ padding: 12 }}>
        <button
          type="button"
          onClick={goBack}
          style={{ border: "none", background: "#111", color: "#fff", padding: "10px 14px", borderRadius: 8, cursor: "pointer", marginBottom: 12 }}
        >
          Back
        </button>
        <div>{error}</div>
      </div>
    );
  }

  if (!restaurant?.latitude || !restaurant?.longitude) {
    return (
      <div style={{ padding: 12 }}>
        <button
          type="button"
          onClick={goBack}
          style={{ border: "none", background: "#111", color: "#fff", padding: "10px 14px", borderRadius: 8, cursor: "pointer", marginBottom: 12 }}
        >
          Back
        </button>
        <div>Location information is not available for this restaurant.</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", paddingBottom: 24 }}>
      {/* Header + control */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={goBack}
          style={{ border: "none", background: "#111", color: "#fff", padding: "8px 12px", borderRadius: 8, cursor: "pointer" }}
        >
          Back
        </button>

        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontWeight: 700 }}>{restaurant.name}</div>
          <div style={{ fontSize: 13, opacity: 0.8 }}>
            Straight: {straightText}
            {showPath && pathText && (
              <> • Path: {pathText}{durationText ? ` • ${durationText}` : ""}</>
            )}
          </div>
          {routingError && showPath && (
            <div style={{ fontSize: 12, color: "#c05621" }}>Route: {routingError}</div>
          )}
          {error && <div style={{ fontSize: 12, color: "#c05621" }}>{error}</div>}
        </div>

        {/* ปุ่มเดียว Path (toggle) */}
        <button
          onClick={() => setShowPath((s) => !s)}
          style={{
            border: "1px solid #ddd",
            padding: "6px 12px",
            borderRadius: 8,
            background: showPath ? "#111" : "#fff",
            color: showPath ? "#fff" : "#111",
            cursor: "pointer",
          }}
          title="แสดง/ซ่อนเส้นทางตามถนน"
        >
          Path
        </button>

        {/* เปิด Google Maps (ใช้ driving) */}
        <button
          onClick={() => {
            const url = `https://www.google.com/maps/dir/?api=1&destination=${restaurant.latitude},${restaurant.longitude}&travelmode=driving`;
            window.open(url, "_blank", "noopener,noreferrer");
          }}
          style={{ border: "1px solid #ddd", padding: "6px 10px", borderRadius: 8, background: "#fff", cursor: "pointer" }}
        >
          Open in Google Maps
        </button>
      </div>

      <MapContainer
        center={[restaurant.latitude, restaurant.longitude]}
        zoom={15}
        style={{ height: 600, width: "100%", borderRadius: 12, overflow: "hidden" }}
        whenCreated={(map) => { mapRef.current = map; }}
      >
        <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        {userPos && (
          <>
            <Circle
              center={userPos}
              radius={Math.max(accuracy || 30, 30)}
              pathOptions={{ color: "#3b82f6", weight: 1, fillColor: "#60a5fa", fillOpacity: 0.15 }}
            />
            <Marker position={userPos} icon={userIcon}>
              <Popup>You are here</Popup>
            </Marker>
          </>
        )}

        {/* ร้าน */}
        <Marker position={[restaurant.latitude, restaurant.longitude]}>
          <Popup>
            <div style={{ minWidth: 160 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{restaurant.name}</div>
              <div style={{ fontSize: 13, opacity: 0.75 }}>{restaurant.address || "No address"}</div>
              {showPath && pathText && (
                <div style={{ fontSize: 13, marginTop: 6 }}>
                  Path: {pathText}{durationText ? ` • ${durationText}` : ""}
                </div>
              )}
              {!showPath && straightText !== "—" && (
                <div style={{ fontSize: 13, marginTop: 6 }}>Straight: {straightText}</div>
              )}
            </div>
          </Popup>
        </Marker>

        {/* เส้นทางบนถนน */}
        {showPath && routeCoords?.length ? (
          <Polyline positions={routeCoords} pathOptions={{ color: "#111", weight: 5, opacity: 0.9 }} />
        ) : (
          // fallback: เส้นตรงถ้าไม่เปิด Path หรือ route ไม่สำเร็จ
          userPos && (
            <Polyline
              positions={[userPos, [restaurant.latitude, restaurant.longitude]]}
              pathOptions={{ color: "#777", dashArray: "6 6" }}
            />
          )
        )}
      </MapContainer>
    </div>
  );
}
