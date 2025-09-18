// src/pages/ProfilePage.jsx
import { useEffect, useRef, useState } from "react";
import { auth, db, storage } from "../firebase";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";
import { updateProfile } from "firebase/auth";

const COUNTRIES = [
  "Thailand",
  "Singapore",
  "Malaysia",
  "Vietnam",
  "Indonesia",
  "Philippines",
];

export default function ProfilePage({ goBack }) {
  const u = auth.currentUser;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ------- state -------
  const [name, setName] = useState("");
  const [email, setEmail] = useState(u?.email || "");
  const [dob, setDob] = useState(""); // yyyy-mm-dd
  const [country, setCountry] = useState("Thailand");

  // ✅ ใช้ avatarUrl / uploading แทน photoURL เดิม
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  const [msg, setMsg] = useState("");

  const fileInputRef = useRef(null);

  // โหลดโปรไฟล์จาก Firestore
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!u) return;
        const snap = await getDoc(doc(db, "users", u.uid));
        if (alive) {
          const d = snap.exists() ? snap.data() : {};
          setName(d.name || u.displayName || "");
          setEmail(u.email || d.email || "");
          setDob(d.dob || "");
          setCountry(d.country || "Thailand");
          setAvatarUrl(d.avatar_url || u.photoURL || "");
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => (alive = false);
  }, [u]);

  // ✅ อัปโหลดรูป → Storage → getDownloadURL → เขียน users/{uid}.avatar_url
  async function handlePick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("กรุณาเลือกรูปภาพ");
      e.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("ขนาดรูปต้องไม่เกิน 5MB");
      e.target.value = "";
      return;
    }

    const uid = auth.currentUser?.uid;
    if (!uid) return;

    setUploading(true);
    setMsg("");
    try {
      const path = `users/${uid}/photos/profile_${Date.now()}`;
      const fileRef = ref(storage, path);

      const task = uploadBytesResumable(fileRef, file, { contentType: file.type });
      await new Promise((resolve, reject) => {
        task.on("state_changed", null, reject, resolve);
      });

      const url = await getDownloadURL(fileRef);
      setAvatarUrl(url);

      // ใช้ setDoc merge: true เผื่อ doc ยังไม่ถูกสร้าง
      await setDoc(
        doc(db, "users", uid),
        { avatar_url: url, updated_at: serverTimestamp() },
        { merge: true }
      );

      // ซิงก์ไป Auth ด้วย (ตัวเลือก)
      try {
        await updateProfile(auth.currentUser, { photoURL: url });
      } catch {}

      setMsg("อัปโหลดรูปเรียบร้อย ✅");
    } catch (err) {
      console.error(err);
      alert("อัปโหลดไม่สำเร็จ");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  // บันทึกค่าชื่อ/วันที่/ประเทศ
  const handleSave = async (e) => {
    e.preventDefault();
    if (!u) return;
    setSaving(true);
    setMsg("");

    try {
      await setDoc(
        doc(db, "users", u.uid),
        {
          name: name.trim(),
          email,
          dob,
          country,
          avatar_url: avatarUrl || "",
          updated_at: serverTimestamp(),
        },
        { merge: true }
      );

      // sync displayName บน Auth (ตัวเลือก)
      if (name && name !== u.displayName) {
        try {
          await updateProfile(u, { displayName: name });
        } catch {}
      }
      setMsg("บันทึกข้อมูลเรียบร้อย");
    } catch (e) {
      console.error(e);
      setMsg("บันทึกไม่สำเร็จ: " + (e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: 12 }}>Loading…</div>;

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          type="button"
          onClick={goBack}
          style={{ border: "none", background: "#111", color: "#fff", padding: "10px 14px", borderRadius: 8, cursor: "pointer", marginBottom: 12 }}
        >
          Back
        </button>
        <h2 style={{ margin: 0 }}>Edit Profile</h2>
      </div>

      {/* ✅ Avatar UI แบบใหม่ */}
      <div style={{ display: "grid", placeItems: "center", marginTop: 12 }}>
        <div
          style={{
            width: 140,
            height: 140,
            borderRadius: "50%",
            background: "#eee",
            overflow: "hidden",
            border: "1px solid #ddd",
            display: "grid",
            placeItems: "center",
          }}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={() => setAvatarUrl("")}
            />
          ) : (
            <span style={{ opacity: 0.5, fontSize: 36 }}>👤</span>
          )}
        </div>

        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          style={{
            marginTop: 10,
            padding: "6px 12px",
            borderRadius: 8,
            border: "1px solid #ddd",
            background: "#fff",
          }}
        >
          {uploading ? "กำลังอัปโหลด…" : "🖼 อัปโหลดรูป"}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={handlePick}
        />
      </div>

      {/* Form */}
      <form onSubmit={handleSave} style={{ marginTop: 18 }}>
        <label style={{ display: "block", fontSize: 14, marginTop: 8 }}>Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{
            width: "100%",
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: "10px 12px",
          }}
        />

        <label style={{ display: "block", fontSize: 14, marginTop: 10 }}>Email</label>
        <input
          value={email}
          disabled
          style={{
            width: "100%",
            border: "1px solid #eee",
            borderRadius: 8,
            padding: "10px 12px",
            background: "#f9f9f9",
            color: "#777",
          }}
        />

        <label style={{ display: "block", fontSize: 14, marginTop: 10 }}>
          Date of Birth
        </label>
        <input
          type="date"
          value={dob}
          onChange={(e) => setDob(e.target.value)}
          style={{
            width: "100%",
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: "10px 12px",
          }}
        />

        <label style={{ display: "block", fontSize: 14, marginTop: 10 }}>
          Country/Region
        </label>
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          style={{
            width: "100%",
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: "10px 12px",
          }}
        >
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        {!!msg && (
          <div style={{ marginTop: 10, fontSize: 13, color: "#0a7" }}>{msg}</div>
        )}

        <div style={{ marginTop: 14 }}>
          <button
            type="submit"
            disabled={saving}
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 10,
              border: "none",
              background: "#111",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
