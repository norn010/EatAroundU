// src/pages/StoreCreate.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { db, storage } from "../firebase";
import { collection, addDoc, serverTimestamp, doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { incUserStat } from "../lib/achievements"; // ✅ เพิ่ม

import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

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

// อัปโหลดไฟล์ไป Storage แล้วคืน URL
async function uploadTo(path, file) {
  const r = ref(storage, path);
  await uploadBytes(r, file);
  return await getDownloadURL(r);
}

export default function StoreCreate({ user, onCreated, onCancel }) {
  const [center, setCenter] = useState([14.8907, 102.1580]);

  // ข้อมูลร้าน
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [open, setOpen] = useState("09:00");
  const [close, setClose] = useState("20:00");
  const [price, setPrice] = useState("฿฿");
  const [desc, setDesc] = useState("");

  // รูปร้าน (ปก)
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState("");

  // เมนู (+ไฟล์รูป)
  const [menus, setMenus] = useState([
    { name: "", price: "", description: "", calories: "", file: null, preview: "" },
  ]);

  const [accept, setAccept] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const mapRef = useRef(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const c = [pos.coords.latitude, pos.coords.longitude];
      setCenter(c);
      mapRef.current?.flyTo(c, 15, { duration: 0.6 });
    });
  }, []);

  const addMenu = () =>
    setMenus((prev) => [...prev, { name: "", price: "", description: "", calories: "", file: null, preview: "" }]);

  const removeMenu = (idx) => setMenus((prev) => prev.filter((_, i) => i !== idx));

  const updateMenu = (idx, field, value) =>
    setMenus((prev) => prev.map((m, i) => (i === idx ? { ...m, [field]: value } : m)));

  const onMenuFile = (idx, file) => {
    const url = file ? URL.createObjectURL(file) : "";
    setMenus((prev) =>
      prev.map((m, i) => (i === idx ? { ...m, file, preview: url } : m))
    );
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr("");

    if (!name) return setErr("กรุณากรอกชื่อร้าน");
    if (!accept) return setErr("กรุณายอมรับข้อตกลงก่อน");

    try {
      setBusy(true);
      const [lat, lng] = center;

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

      // 2) อัปโหลดรูปร้าน (ปก)
      if (coverFile) {
        const coverUrl = await uploadTo(
          `restaurants/${restRef.id}/cover_${Date.now()}.jpg`,
          coverFile
        );
        await updateDoc(doc(db, "restaurants", restRef.id), { image_url: coverUrl });
      }

      // 3) เพิ่มเมนู + รูปเมนู
      for (const row of menus) {
        const menuName = (row.name || "").trim();
        if (!menuName) continue;
        const priceNum = Number(row.price) || 0;
        const calNum = Number(row.calories) || 0;

        const menuRef = await addDoc(
          collection(db, "restaurants", restRef.id, "menus"),
          {
            restaurant_id: restRef.id,
            name: menuName,
            name_lc: menuName.toLowerCase(),
            price: priceNum,
            calories: calNum,
            description: row.description || "",
            image_url: "",
            is_popular: 0,
            created_at: serverTimestamp(),
          }
        );

        if (row.file) {
          const url = await uploadTo(
            `restaurants/${restRef.id}/menus/${menuRef.id}_${Date.now()}.jpg`,
            row.file
          );
          await updateDoc(
            doc(db, "restaurants", restRef.id, "menus", menuRef.id),
            { image_url: url }
          );
        }
      }

      // ✅ ปล่อยเหรียญ “First Store / Create Store”
      await incUserStat(user.uid, "stores_created_count", 1);

      onCreated?.(restRef.id);
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setBusy(false);
    }
  };

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
          <CenterSync onCenter={(c) => setCenter(c)} />
        </MapContainer>

        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
            fontSize: 28,
          }}
        >
          📍
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 10,
            left: 10,
            background: "rgba(255,255,255,.95)",
            padding: "6px 10px",
            borderRadius: 8,
            fontSize: 12,
          }}
        >
          lat: {center[0].toFixed(6)} • lng: {center[1].toFixed(6)}
        </div>
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

        <label style={{ display: "block", fontSize: 14, marginTop: 8 }}>
          ชื่อร้าน
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{
            width: "100%",
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: "10px 12px",
            outline: "none",
          }}
        />

        <label style={{ display: "block", fontSize: 14, marginTop: 10 }}>
          Location
        </label>
        {map}

        <label style={{ display: "block", fontSize: 14, marginTop: 12 }}>
          คำอธิบายร้าน
        </label>
        <textarea
          rows={3}
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          style={{
            width: "100%",
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: "10px 12px",
            outline: "none",
          }}
        />

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

        {/* รูปร้าน (ปก) */}
        <div style={{ marginTop: 12 }}>
          <label style={{ fontSize: 14 }}>
            รูปร้าน (ปก)
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                setCoverFile(f || null);
                setCoverPreview(f ? URL.createObjectURL(f) : "");
              }}
              style={{ display: "block", marginTop: 6 }}
            />
            {coverPreview && (
              <img
                alt=""
                src={coverPreview}
                style={{
                  width: "100%",
                  height: 120,
                  objectFit: "cover",
                  marginTop: 6,
                  borderRadius: 8,
                }}
              />
            )}
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
                    onChange={(e) => updateMenu(idx, "description", e.target.value)}
                    style={{
                      width: "100%",
                      border: "1px solid #ddd",
                      borderRadius: 8,
                      padding: "8px 10px",
                      outline: "none",
                    }}
                  />
                </div>

                <div style={{ marginTop: 6 }}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => onMenuFile(idx, e.target.files?.[0] || null)}
                  />
                  {m.preview && (
                    <img
                      alt=""
                      src={m.preview}
                      style={{
                        width: 120,
                        height: 80,
                        objectFit: "cover",
                        display: "block",
                        marginTop: 6,
                        borderRadius: 8,
                      }}
                    />
                  )}
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
        </div>

        {err && (
          <div style={{ marginTop: 8, color: "crimson", fontSize: 14 }}>{err}</div>
        )}

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
