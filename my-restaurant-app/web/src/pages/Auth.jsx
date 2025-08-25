import { useEffect, useState } from "react";
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "firebase/auth";

import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";

/**
 * หน้า Auth (Register + Login)
 * props:
 *   onLoggedIn: (user) => void  // {uid,email,user_type}
 */
export default function AuthPage({ onLoggedIn, onModeChange }) {
  const [mode, setMode] = useState("login"); // 'login' | 'register'
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [isOwner, setIsOwner] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // แจ้ง parent ให้เปลี่ยน title ตามโหมด (Login/Register)
  useEffect(() => {
    onModeChange?.(mode);
  }, [mode, onModeChange]);

  // เมื่อมีการล็อกอินอยู่แล้ว ให้ดึงโปรไฟล์จาก Firestore
  // useEffect(() => {
  //   const unsub = onAuthStateChanged(auth, async (user) => {
  //     if (user) {
  //       const snap = await getDoc(doc(db, "users", user.uid));
  //       const profile = snap.exists() ? snap.data() : { user_type: "user" };
  //       onLoggedIn?.({ uid: user.uid, email: user.email, ...profile });
  //     }
  //   });
  //   return () => unsub();
  // }, [onLoggedIn]);

  const doRegister = async (e) => {
    e.preventDefault();
    setErr("");
    if (pw.length < 8) return setErr("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
    if (pw !== pw2) return setErr("ยืนยันรหัสผ่านไม่ตรงกัน");
    try {
      setBusy(true);
      const cred = await createUserWithEmailAndPassword(auth, email, pw);
      const uid = cred.user.uid;
      // สร้างโปรไฟล์ผู้ใช้ใน Firestore
      await setDoc(doc(db, "users", uid), {
        email,
        user_type: isOwner ? "owner" : "user",
        created_at: serverTimestamp(),
      });
      onLoggedIn?.({
        uid,
        email,
        user_type: isOwner ? "owner" : "user",
      });
    } catch (e) {
      setErr(parseFirebaseError(e));
    } finally {
      setBusy(false);
    }
  };

  const doLogin = async (e) => {
    e.preventDefault();
    setErr("");
    try {
      setBusy(true);
      const cred = await signInWithEmailAndPassword(auth, email, pw);
      const uid = cred.user.uid;
      const snap = await getDoc(doc(db, "users", uid));
      const profile = snap.exists() ? snap.data() : { user_type: "user" };
      onLoggedIn?.({ uid, email: cred.user.email, ...profile });
    } catch (e) {
      setErr(parseFirebaseError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 420, margin: "24px auto", padding: 16 }}>
      {mode === "register" ? <h2>Sign up</h2> : <h2>Hi, Welcome! 👋</h2>}

      <form onSubmit={mode === "register" ? doRegister : doLogin}>
        <div className="card" style={{ padding: 16 }}>
          <label>Email</label>
          <input
            type="email"
            placeholder="example@gmail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
            required
          />

          <label>Password</label>
          <input
            type="password"
            placeholder="Password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            style={inputStyle}
            required
          />

          {mode === "register" && (
            <>
              <label>Confirm password</label>
              <input
                type="password"
                placeholder="repeat password"
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                style={inputStyle}
                required
              />

              <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                <input
                  type="checkbox"
                  checked={isOwner}
                  onChange={(e) => setIsOwner(e.target.checked)}
                />
                ฉันคือเจ้าของร้าน (Owner)
              </label>
            </>
          )}

          {err && (
            <div style={{ color: "crimson", marginTop: 8 }}>
              {err}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            style={buttonStyle}
          >
            {busy ? "Please wait..." : mode === "register" ? "Create account" : "Log in"}
          </button>
        </div>
      </form>

      <div style={{ textAlign: "center", marginTop: 12 }}>
        {mode === "register" ? (
          <>
            Already have an account?{" "}
            <a href="#" onClick={() => setMode("login")}>
              Log in
            </a>
          </>
        ) : (
          <>
            Don’t have an account?{" "}
            <a href="#" onClick={() => setMode("register")}>
              Sign up
            </a>
          </>
        )}
      </div>
    </div>
  );
}

const inputStyle = { width: "100%", padding: 10, marginBottom: 10, borderRadius: 8, border: "1px solid #ddd" };
const buttonStyle = { width: "100%", marginTop: 12, padding: 12, background: "#111", color: "#fff", borderRadius: 8, border: 0 };

function parseFirebaseError(e) {
  const msg = String(e?.message || "");
  if (msg.includes("auth/invalid-email")) return "อีเมลไม่ถูกต้อง";
  if (msg.includes("auth/email-already-in-use")) return "อีเมลนี้ถูกใช้แล้ว";
  if (msg.includes("auth/weak-password")) return "รหัสผ่านสั้นเกินไป";
  if (msg.includes("auth/wrong-password")) return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
  if (msg.includes("auth/user-not-found")) return "ไม่พบบัญชีผู้ใช้";
  return msg;
}
