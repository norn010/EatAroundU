// web/src/pages/StoreCreate.jsx
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
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ดักอีเวนต์ move/moveend เพื่อ sync center
function CenterSync({ onCenter }) {
  useMapEvents({
    move: (e) => {
      const c = e.target.getCenter();
      onCenter([c.lat, c.lng], false);
    },
    moveend: (e) => {
      const c = e.target.getCenter();
      onCenter([c.lat, c.lng], true);
    },
  });
  return null;
}

export default function StoreCreate({ user, onCreated, onCancel }) {
  // พิกัดเริ่มต้น (กลางปากช่อง)
  const [center, setCenter] = useState([14.8907, 102.1580]);

  // ข้อมูลร้าน
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [open, setOpen] = useState("09:00");
  const [close, setClose] = useState("20:00");
  const [price, setPrice] = useState("฿฿");
  const [desc, setDesc] = useState("");

  // เมนู (เริ่มด้วย 1 ช่อง)
  const [menus, setMenus] = useState([
    { name: "", price: "", description: "", calories: "" },
  ]);

  // Terms
  const [accept, setAccept] = useState(false);

  // สถานะการ submit
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const mapRef = useRef(null);

  // ขอพิกัดปัจจุบัน
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = [pos.coords.latitude, pos.coords.longitude];
        setCenter(c);
        const map = mapRef.current;
        if (map) map.flyTo(c, 15, { duration: 0.6 });
      },
      () => {}
    );
  }, []);

  // เพิ่ม / ลบ / แก้เมนู ---------------------------
  const addMenu = () =>
    setMenus((prev) => [...prev, { name: "", price: "", description: "", calories: "" }]);

  const removeMenu = (idx) =>
    setMenus((prev) => prev.filter((_, i) => i !== idx));

  const updateMenu = (idx, field, value) =>
    setMenus((prev) => prev.map((m, i) => (i === idx ? { ...m, [field]: value } : m)));

  // ส่งข้อมูล
  const submit = async (e) => {
    e.preventDefault();
    setErr("");

    const [lat, lng] = center;

    if (!name) return setErr("กรุณากรอกชื่อร้าน");
    if (!accept) return setErr("กรุณายอมรับข้อตกลงก่อน");

    try {
      setBusy(true);

      // 1) เพิ่มร้าน
      const restRef = await addDoc(collection(db, "restaurants"), {
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

      // 2) เพิ่มเมนูเข้า subcollection ของร้าน
      for (const row of menus) {
        const menuName = (row.name || "").trim();
        if (!menuName) continue;
        const priceNum = Number(row.price) || 0;
        const calNum = Number(row.calories) || 0;

        await addDoc(collection(db, "restaurants", restRef.id, "menus"), {
          restaurant_id: restRef.id,        // ใช้กับ collectionGroup search
          name: menuName,
          name_lc: menuName.toLowerCase(),  // prefix search
          price: priceNum,
          calories: calNum,
          description: row.description || "",
          image_url: "",
          is_popular: 0,
          created_at: serverTimestamp(),
        });
      }

      onCreated?.(restRef.id);
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setBusy(false);
    }
  };

  // --------------- Map UI ---------------
  const map = useMemo(
    () => (
      <div
        style={{
          position: "relative",
          height: 280,
          borderRadius: 12,
          overflow: "hidden",
          border: "1px solid #e5e5e5",
        }}
      >
        <MapContainer
          center={center}
          zoom={15}
          style={{ height: "100%", width: "100%" }}
          whenCreated={(m) => (mapRef.current = m)}
        >
          <TileLayer
            attribution="&copy; OpenStreetMap"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Marker ให้ลากได้ */}
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

          {/* Sync center หากมีการเลื่อนแผนที่ */}
          <CenterSync onCenter={(c) => setCenter(c)} />
        </MapContainer>

        {/* กากบาทกลางจอ */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
            fontSize: 28,
          }}
          title="เลื่อนแผนที่หรือ Marker เพื่อปักตำแหน่งร้าน"
        >
          📍
        </div>

        {/* กล่อง Latitude/Longitude */}
        <div
          style={{
            position: "absolute",
            bottom: 10,
            left: 10,
            background: "rgba(255,255,255,.95)",
            padding: "6px 10px",
            borderRadius: 8,
            fontSize: 12,
            boxShadow: "0 1px 5px rgba(0,0,0,.08)",
          }}
        >
          lat: {center[0].toFixed(6)} • lng: {center[1].toFixed(6)}
        </div>

        {/* ปุ่ม Locate */}
        <button
          onClick={() => {
            if (!navigator.geolocation) return;
            navigator.geolocation.getCurrentPosition((pos) => {
              const c = [pos.coords.latitude, pos.coords.longitude];
              setCenter(c);
              mapRef.current?.flyTo(c, 16, { duration: 0.5 });
            });
          }}
          type="button"
          style={{
            position: "absolute",
            right: 10,
            bottom: 10,
            background: "#fff",
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: "6px 10px",
            boxShadow: "0 1px 5px rgba(0,0,0,.08)",
          }}
        >
          ใช้ตำแหน่งฉัน
        </button>
      </div>
    ),
    [center]
  );

  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={onCancel}>← Back</button>
      </div>

      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          border: "1px solid #eee",
          padding: 16,
          marginTop: 10,
        }}
      >
        <h2 style={{ margin: "0 0 12px 0" }}>เพิ่มร้านใหม่</h2>

        {/* ชื่อร้าน */}
        <label style={{ display: "block", fontSize: 14, marginTop: 8 }}>
          ชื่อร้าน
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Value"
          style={{
            width: "100%",
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: "10px 12px",
            outline: "none",
          }}
        />

        {/* Location + Map */}
        <label style={{ display: "block", fontSize: 14, marginTop: 10 }}>
          Location
        </label>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 6,
          }}
        >
          <select
            disabled
            style={{
              border: "1px solid #ddd",
              borderRadius: 8,
              padding: "10px 8px",
              background: "#f7f7f7",
              color: "#666",
            }}
            defaultValue=""
          >
            <option value="">เลือกที่ตั้ง</option>
          </select>
          <span style={{ fontSize: 12, color: "#666" }}>
            (เลื่อนแผนที่/ลากหมุดเพื่อเลือกพิกัด)
          </span>
        </div>

        {map}

        {/* คำอธิบายร้าน */}
        <label style={{ display: "block", fontSize: 14, marginTop: 12 }}>
          คำอธิบายร้าน
        </label>
        <textarea
          rows={3}
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Value"
          style={{
            width: "100%",
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: "10px 12px",
            outline: "none",
          }}
        />

        {/* เวลา/ราคา */}
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <label style={{ fontSize: 14 }}>
            เปิด
            <input
              type="time"
              value={open}
              onChange={(e) => setOpen(e.target.value)}
              style={{
                display: "block",
                border: "1px solid #ddd",
                borderRadius: 8,
                padding: "8px 10px",
                outline: "none",
                marginTop: 4,
              }}
            />
          </label>
          <label style={{ fontSize: 14 }}>
            ปิด
            <input
              type="time"
              value={close}
              onChange={(e) => setClose(e.target.value)}
              style={{
                display: "block",
                border: "1px solid #ddd",
                borderRadius: 8,
                padding: "8px 10px",
                outline: "none",
                marginTop: 4,
              }}
            />
          </label>
          <label style={{ flex: 1, fontSize: 14 }}>
            ช่วงราคา
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="฿, ฿฿, ฿฿฿"
              style={{
                display: "block",
                width: "100%",
                border: "1px solid #ddd",
                borderRadius: 8,
                padding: "8px 10px",
                outline: "none",
                marginTop: 4,
              }}
            />
          </label>
        </div>

        {/* เมนู */}
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <label style={{ fontSize: 14 }}>เมนู</label>
            <button
              type="button"
              onClick={addMenu}
              style={{
                border: "1px solid #ddd",
                borderRadius: 999,
                padding: "4px 10px",
                background: "#fff",
              }}
            >
              + เมนู
            </button>
          </div>

          {/* กล่องรายการเมนู */}
          <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
            {menus.map((m, idx) => (
              <div
                key={idx}
                style={{
                  border: "1px solid #eee",
                  borderRadius: 10,
                  padding: 10,
                  background: "#fafafa",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 120px 120px 120px",
                    gap: 8,
                  }}
                >
                  <input
                    placeholder="ชื่อเมนู"
                    value={m.name}
                    onChange={(e) => updateMenu(idx, "name", e.target.value)}
                    style={{
                      border: "1px solid #ddd",
                      borderRadius: 8,
                      padding: "8px 10px",
                      outline: "none",
                    }}
                  />
                  <input
                    placeholder="ราคา"
                    value={m.price}
                    onChange={(e) => updateMenu(idx, "price", e.target.value)}
                    style={{
                      border: "1px solid #ddd",
                      borderRadius: 8,
                      padding: "8px 10px",
                      outline: "none",
                    }}
                  />
                  <input
                    placeholder="แคลอรี่"
                    value={m.calories}
                    onChange={(e) => updateMenu(idx, "calories", e.target.value)}
                    style={{
                      border: "1px solid #ddd",
                      borderRadius: 8,
                      padding: "8px 10px",
                      outline: "none",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => removeMenu(idx)}
                    style={{
                      border: "1px solid #ddd",
                      borderRadius: 8,
                      background: "#fff",
                    }}
                  >
                    ลบ
                  </button>
                </div>

                <div style={{ marginTop: 6 }}>
                  <input
                    placeholder="คำอธิบาย"
                    value={m.description}
                    onChange={(e) =>
                      updateMenu(idx, "description", e.target.value)
                    }
                    style={{
                      width: "100%",
                      border: "1px solid #ddd",
                      borderRadius: 8,
                      padding: "8px 10px",
                      outline: "none",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Terms */}
        <div style={{ marginTop: 12, fontSize: 14 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={accept}
              onChange={(e) => setAccept(e.target.checked)}
            />
            I accept the terms
          </label>
          <div style={{ fontSize: 12, color: "#666" }}>
            <a href="#" onClick={(e) => e.preventDefault()}>
              Read our T&Cs
            </a>
          </div>
        </div>

        {/* Error */}
        {err && (
          <div style={{ marginTop: 8, color: "crimson", fontSize: 14 }}>
            {err}
          </div>
        )}

        {/* Submit */}
        <div style={{ marginTop: 12 }}>
          <button
            onClick={submit}
            disabled={busy}
            style={{
              width: "100%",
              padding: "12px 14px",
              border: "none",
              borderRadius: 10,
              background: "#111",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {busy ? "Saving..." : "Create Store"}
          </button>
        </div>
      </div>
    </div>
  );
}
