
import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "../firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// แก้ icon ของ Leaflet (ป้องกันไม่เจอไฟล์)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function CenterSync({ onCenter }) {
  // useMapEvents เพื่อยิงอีเวนต์ทุกครั้งที่แผนที่ขยับ/หยุด
  useMapEvents({
    move: (e) => {
      const c = e.target.getCenter();
      onCenter([c.lat, c.lng], false); // ระหว่างเลื่อน
    },
    moveend: (e) => {
      const c = e.target.getCenter();
      onCenter([c.lat, c.lng], true); // หลังเลิกเลื่อน
    }
  });
  return null;
}

export default function StoreCreate({ user, onCreated, onCancel }) {
  // ตำแหน่งเริ่มต้น (ลองกำหนดเป็นตำแหน่งปัจจุบันถ้ามี)
  const [center, setCenter] = useState([14.8907, 102.1580]);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [open, setOpen] = useState("09:00");
  const [close, setClose] = useState("20:00");
  const [price, setPrice] = useState("฿฿");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const mapRef = useRef(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = [pos.coords.latitude, pos.coords.longitude];
        setCenter(c);
        // fly ไปตำแหน่งปัจจุบันเมื่อพร้อม
        const map = mapRef.current;
        if (map) map.flyTo(c, 15, { duration: .6 });
      },
      () => {} // ignore err
    );
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    const [lat, lng] = center;
    if (!name) return setErr("กรุณากรอกชื่อร้าน");
    try {
      setBusy(true);
      const docRef = await addDoc(collection(db, "restaurants"), {
        owner_id: user.uid,
        name,
        type: "",
        latitude: lat,
        longitude: lng,
        address,
        price_range: price,
        open_time: open,
        close_time: close,
        rating: 0,
        description: desc,
        image_url: "",
        is_new: true,
        created_at: serverTimestamp(),
      });
      onCreated?.(docRef.id);
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setBusy(false);
    }
  };

  const map = useMemo(
    () => (
      <div style={{ position: "relative", height: 320, borderRadius: 12, overflow: "hidden" }}>
        <MapContainer
          center={center}
          zoom={15}
          style={{ height: "100%", width: "100%" }}
          whenCreated={(m) => (mapRef.current = m)}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {/* มี Marker ให้ลากได้ด้วย (ถ้าชอบ) */}
          <Marker
            draggable
            position={center}
            eventHandlers={{
              dragend: (e) => {
                const { lat, lng } = e.target.getLatLng();
                setCenter([lat, lng]);
              },
            }}
          />
          {/* ตัวจับ center เมื่อเลื่อนแผนที่ */}
          <CenterSync onCenter={(c) => setCenter(c)} />
        </MapContainer>

        {/* กากบาทกลางจอ (ให้ความรู้สึก "ขยับแผนที่เพื่อปัก") */}
        <div
          style={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            pointerEvents: "none", fontSize: 28
          }}
          title="เลื่อนแผนที่ให้จุดนี้ทับตำแหน่งร้าน"
        >
          📍
        </div>

        {/* กล่อง lat/lng */}
        <div
          style={{
            position: "absolute", bottom: 10, left: 10,
            background: "rgba(255,255,255,.9)", padding: "6px 8px",
            borderRadius: 8, fontSize: 12
          }}
        >
          lat: {center[0].toFixed(6)} • lng: {center[1].toFixed(6)}
        </div>

        {/* ปุ่ม locate กลับมาตำแหน่งปัจจุบัน */}
        <button
          onClick={() => {
            if (!navigator.geolocation) return;
            navigator.geolocation.getCurrentPosition((pos) => {
              const c = [pos.coords.latitude, pos.coords.longitude];
              setCenter(c);
              mapRef.current?.flyTo(c, 16, { duration: .5 });
            });
          }}
          style={{
            position: "absolute", right: 10, bottom: 10,
            background: "#fff", border: "1px solid #ddd", borderRadius: 8,
            padding: "6px 10px"
          }}
          type="button"
        >
          ใช้ตำแหน่งฉัน
        </button>
      </div>
    ),
    [center]
  );

  return (
    <div>
      <div style={{display:"flex", alignItems:"center", gap:8}}>
        <button onClick={onCancel}>← Back</button>
        <h2 style={{margin:"12px 0"}}>Create Store</h2>
      </div>

      {map}

      <form onSubmit={submit} style={{display:"grid", gap:10, maxWidth:480, marginTop:12}}>
        <input placeholder="ชื่อร้าน" value={name} onChange={e=>setName(e.target.value)} />
        <input placeholder="ที่อยู่ (ถ้ามี)" value={address} onChange={e=>setAddress(e.target.value)} />
        <div style={{display:"flex", gap:8}}>
          <label>เปิด <input type="time" value={open} onChange={e=>setOpen(e.target.value)} /></label>
          <label>ปิด <input type="time" value={close} onChange={e=>setClose(e.target.value)} /></label>
        </div>
        <input placeholder="ช่วงราคา เช่น ฿ ฿฿ ฿฿฿" value={price} onChange={e=>setPrice(e.target.value)} />
        <textarea placeholder="คำอธิบายร้าน" rows={3} value={desc} onChange={e=>setDesc(e.target.value)} />

        <div style={{fontSize:12, opacity:.7}}>
          พิกัดที่บันทึก: {center[0].toFixed(6)}, {center[1].toFixed(6)} (เลื่อนแผนที่เพื่อปรับ)
        </div>

        {err && <div style={{color:"crimson"}}>{err}</div>}
        <button type="submit" disabled={busy} style={{padding:"10px 12px", borderRadius:8}}>
          {busy ? "Saving..." : "Create Store"}
        </button>
      </form>
    </div>
  );
}
