import { useEffect, useMemo, useRef, useState } from "react";
import { db, storage } from "../firebase";
import {
  doc, getDoc, updateDoc,
  collection, addDoc, deleteDoc, getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

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

async function uploadTo(path, file) {
  const r = ref(storage, path);
  await uploadBytes(r, file);
  return await getDownloadURL(r);
}

export default function StoreEdit({ id, onSaved, onCancel }) {
  const [center, setCenter] = useState([14.8907, 102.158]);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [open, setOpen] = useState("09:00");
  const [close, setClose] = useState("20:00");
  const [price, setPrice] = useState("฿฿");
  const [desc, setDesc] = useState("");

  // รูปร้าน (ปก)
  const [imageUrl, setImageUrl] = useState("");
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState("");

  // เมนู
  const [menus, setMenus] = useState([]); // {id?, name, price, description, calories, image_url?, file?, preview?}
  const [removedMenuIds, setRemovedMenuIds] = useState([]);

  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState("");
  const mapRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        setBusy(true);
        const rdoc = await getDoc(doc(db, "restaurants", id));
        if (!rdoc.exists()) {
          setErr("ไม่พบร้าน");
          setBusy(false);
          return;
        }
        const data = rdoc.data();
        setName(data.name || "");
        setAddress(data.address || "");
        setOpen(data.open_time || "09:00");
        setClose(data.close_time || "20:00");
        setPrice(data.price_range || "฿฿");
        setDesc(data.description || "");
        setImageUrl(data.image_url || "");

        if (typeof data.latitude === "number" && typeof data.longitude === "number") {
          const c = [data.latitude, data.longitude];
          setCenter(c);
          setTimeout(() => {
            mapRef.current?.flyTo(c, 15, { duration: 0.5 });
          }, 200);
        }

        const msnap = await getDocs(collection(db, "restaurants", id, "menus"));
        const mm = msnap.docs.map((m) => ({ id: m.id, ...m.data() }));
        setMenus(
          mm.map((x) => ({
            id: x.id,
            name: x.name || "",
            price: x.price ?? "",
            description: x.description || "",
            calories: x.calories ?? "",
            image_url: x.image_url || "",
            file: null,
            preview: "",
          }))
        );
      } catch (e) {
        setErr(String(e.message || e));
      } finally {
        setBusy(false);
      }
    })();
  }, [id]);

  const addMenu = () =>
    setMenus((prev) => [...prev, { name: "", price: "", description: "", calories: "", image_url: "", file: null, preview: "" }]);

  const removeMenu = (idx) =>
    setMenus((prev) => {
      const item = prev[idx];
      if (item?.id) setRemovedMenuIds((a) => [...a, item.id]);
      return prev.filter((_, i) => i !== idx);
    });

  const updateMenu = (idx, field, value) =>
    setMenus((prev) => prev.map((m, i) => (i === idx ? { ...m, [field]: value } : m)));

  const onMenuFile = (idx, file) => {
    const url = file ? URL.createObjectURL(file) : "";
    setMenus((prev) => prev.map((m, i) => (i === idx ? { ...m, file, preview: url } : m)));
  };

  async function submit(e) {
    e.preventDefault();
    setErr("");

    try {
      setBusy(true);
      const [lat, lng] = center;

      // อัปโหลดปกใหม่ (ถ้ามี)
      let newCoverUrl = "";
      if (coverFile) {
        newCoverUrl = await uploadTo(`restaurants/${id}/cover_${Date.now()}.jpg`, coverFile);
      }

      // อัปเดตร้าน
      await updateDoc(doc(db, "restaurants", id), {
        name,
        address,
        open_time: open,
        close_time: close,
        price_range: price,
        description: desc,
        image_url: newCoverUrl || imageUrl || "",
        latitude: lat,
        longitude: lng,
        updated_at: serverTimestamp(),
      });

      // เมนู: เพิ่ม/แก้
      for (const m of menus) {
        const payload = {
          restaurant_id: id,
          name: (m.name || "").trim(),
          name_lc: (m.name || "").toLowerCase(),
          price: Number(m.price) || 0,
          calories: Number(m.calories) || 0,
          description: m.description || "",
          image_url: m.image_url || "",
          is_popular: Number(m.is_popular) || 0,
          updated_at: serverTimestamp(),
        };
        if (!payload.name) continue;

        // อัปโหลดรูปเมนูใหม่
        if (m.file) {
          const url = await uploadTo(`restaurants/${id}/menus/${m.id || "new"}_${Date.now()}.jpg`, m.file);
          payload.image_url = url;
        }

        if (m.id) {
          await updateDoc(doc(db, "restaurants", id, "menus", m.id), payload);
        } else {
          const newRef = await addDoc(collection(db, "restaurants", id, "menus"), {
            ...payload,
            created_at: serverTimestamp(),
          });
          if (m.file && !payload.image_url) {
            const url = await uploadTo(`restaurants/${id}/menus/${newRef.id}_${Date.now()}.jpg`, m.file);
            await updateDoc(doc(db, "restaurants", id, "menus", newRef.id), { image_url: url });
          }
        }
      }

      // ลบเมนู
      for (const mid of removedMenuIds) {
        await deleteDoc(doc(db, "restaurants", id, "menus", mid));
      }

      onSaved?.(id);
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setBusy(false);
    }
  }

  const map = useMemo(
    () => (
      <div style={{ position: "relative", height: 280, borderRadius: 12, overflow: "hidden", border: "1px solid #e5e5e5" }}>
        <MapContainer center={center} zoom={15} style={{ height: "100%", width: "100%" }} whenCreated={(m) => (mapRef.current = m)}>
          <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
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

        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", pointerEvents: "none", fontSize: 28 }}>
          📍
        </div>
        <div style={{ position: "absolute", bottom: 10, left: 10, background: "rgba(255,255,255,.95)", padding: "6px 10px", borderRadius: 8, fontSize: 12 }}>
          lat: {center[0].toFixed(6)} • lng: {center[1].toFixed(6)}
        </div>
        <button
          type="button"
          onClick={() => {
            if (!navigator.geolocation) return;
            navigator.geolocation.getCurrentPosition((pos) => {
              const c = [pos.coords.latitude, pos.coords.longitude];
              setCenter(c);
              mapRef.current?.flyTo(c, 16, { duration: 0.5 });
            });
          }}
          style={{ position: "absolute", right: 10, bottom: 10, background: "#fff", border: "1px solid #ddd", borderRadius: 8, padding: "6px 10px" }}
        >
          ใช้ตำแหน่งฉัน
        </button>
      </div>
    ),
    [center]
  );

  if (busy && !name) return <div style={{ padding: 12 }}>Loading…</div>;

  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={onCancel}>← Back</button>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #eee", padding: 16, marginTop: 10 }}>
        <h2 style={{ margin: "0 0 12px 0" }}>แก้ไขร้าน</h2>

        <label style={{ display: "block", fontSize: 14, marginTop: 8 }}>ชื่อร้าน</label>
        <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%", border: "1px solid #ddd", borderRadius: 8, padding: "10px 12px", outline: "none" }} />

        <label style={{ display: "block", fontSize: 14, marginTop: 10 }}>Location</label>
        {map}

        <label style={{ display: "block", fontSize: 14, marginTop: 12 }}>คำอธิบายร้าน</label>
        <textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} style={{ width: "100%", border: "1px solid #ddd", borderRadius: 8, padding: "10px 12px", outline: "none" }} />

        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <label style={{ fontSize: 14 }}>
            เปิด
            <input type="time" value={open} onChange={(e) => setOpen(e.target.value)} style={{ display: "block", border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px", outline: "none", marginTop: 4 }} />
          </label>
          <label style={{ fontSize: 14 }}>
            ปิด
            <input type="time" value={close} onChange={(e) => setClose(e.target.value)} style={{ display: "block", border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px", outline: "none", marginTop: 4 }} />
          </label>
          <label style={{ flex: 1, fontSize: 14 }}>
            ช่วงราคา
            <input value={price} onChange={(e) => setPrice(e.target.value)} style={{ display: "block", width: "100%", border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px", outline: "none", marginTop: 4 }} />
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
            {(coverPreview || imageUrl) && (
              <img
                alt=""
                src={coverPreview || imageUrl}
                style={{ width: "100%", height: 120, objectFit: "cover", marginTop: 6, borderRadius: 8 }}
              />
            )}
          </label>
        </div>

        {/* เมนู */}
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <label style={{ fontSize: 14 }}>เมนู</label>
            <button type="button" onClick={() => setMenus((p) => [...p, { name: "", price: "", description: "", calories: "", image_url: "", file: null, preview: "" }])} style={{ border: "1px solid #ddd", borderRadius: 999, padding: "4px 10px", background: "#fff" }}>
              + เมนู
            </button>
          </div>

          <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
            {menus.map((m, idx) => (
              <div key={m.id || idx} style={{ border: "1px solid #eee", borderRadius: 10, padding: 10, background: "#fafafa" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 120px 120px", gap: 8 }}>
                  <input placeholder="ชื่อเมนู" value={m.name} onChange={(e) => updateMenu(idx, "name", e.target.value)} style={{ border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px", outline: "none" }} />
                  <input placeholder="ราคา" value={m.price} onChange={(e) => updateMenu(idx, "price", e.target.value)} style={{ border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px", outline: "none" }} />
                  <input placeholder="แคลอรี่" value={m.calories} onChange={(e) => updateMenu(idx, "calories", e.target.value)} style={{ border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px", outline: "none" }} />
                  <button type="button" onClick={() => removeMenu(idx)} style={{ border: "1px solid #ddd", borderRadius: 8, background: "#fff" }}>
                    ลบ
                  </button>
                </div>

                <div style={{ marginTop: 6 }}>
                  <input placeholder="คำอธิบาย" value={m.description} onChange={(e) => updateMenu(idx, "description", e.target.value)} style={{ width: "100%", border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px", outline: "none" }} />
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
                  <input type="file" accept="image/*" onChange={(e) => onMenuFile(idx, e.target.files?.[0] || null)} />
                  {(m.preview || m.image_url) && (
                    <img alt="" src={m.preview || m.image_url} style={{ width: 120, height: 80, objectFit: "cover", borderRadius: 8 }} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {err && <div style={{ color: "crimson", marginTop: 10 }}>{err}</div>}

        <div style={{ marginTop: 14 }}>
          <button onClick={submit} disabled={busy} style={{ width: "100%", padding: "12px 14px", border: "none", borderRadius: 10, background: "#111", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
