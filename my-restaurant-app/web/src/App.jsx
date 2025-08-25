import { useEffect, useState } from "react";
import Header from "./components/Header";
import BottomNav from "./components/BottomNav";
import Sidebar from "./components/Sidebar";
import ConfirmDialog from "./components/ConfirmDialog";

import MapPage from "./pages/MapPage";
import RestaurantPage from "./pages/RestaurantPage";
import MyQueuePage from "./pages/MyQueuePage";
import AuthPage from "./pages/Auth";

// ⬇️ เอาแค่ครั้งเดียว ไม่ซ้ำ
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";

export default function App() {
  // state เดิม
  const [page, setPage] = useState("auth"); // 'auth'|'map'|'rest'|'queue'|'saved'|'profile'|'random'|'together'|'ai'|'setting'
  const [restId, setRestId] = useState(null);
  const [user, setUser] = useState(null);   // {uid,email,user_type}
  const [title, setTitle] = useState("Login");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        // ดึงโปรไฟล์
        const snap = await getDoc(doc(db, "users", u.uid));
        const profile = snap.exists() ? snap.data() : { user_type: "user" };
        setUser({ uid: u.uid, email: u.email, ...profile });
        setPage((p) => (p === "auth" ? "map" : p)); // ถ้ากำลังอยู่หน้า auth ให้ไป map
        setTitle("Home");
      } else {
        setUser(null);
        setPage("auth");
        setTitle("Login");
      }
      setAuthReady(true);
    });
    return () => unsub();
    }, []);
  

  const titleMap = {
    auth: "Login",
    register: "Register",
    map: "Home",
    rest: "Store",
    queue: "My Queue",
    saved: "Saved",
    profile: "Profile",
    random: "Random",
    together: "together",
    ai: "AI Chat",
    setting: "Setting",
  };

  const go = (p) => {
    setPage(p);
    setTitle(titleMap[p] || "");
    setSidebarOpen(false);
  };

  // เมื่อ login เสร็จจากหน้า Auth
  const handleLoggedIn = (u) => {
    setUser(u);
    go("map");
  };

  return (
    <>
      {/* Header 2 ชั้น */}
      <Header
        title={title}
        user={user}
        onAvatarClick={() => setSidebarOpen(true)}
      />

      {/* เนื้อหาแต่ละหน้า */}
      <div style={{ padding: 12, paddingBottom: 64 /*เผื่อ bottom nav*/ }}>
          {!authReady ? (
         <div>Loading…</div>
       ) : !user ? (
          <AuthPage
            onLoggedIn={handleLoggedIn}
            onModeChange={(m) => setTitle(m === "register" ? "Register" : "Login")}
          />
        ) : (
          <>
            {page === "map" && (
              <MapPage
                onOpenRestaurant={(id) => {
                  setRestId(id);
                  go("rest");
                }}
                setTitle={() => setTitle("Home")}
              />
            )}
            {page === "rest" && (
              <RestaurantPage id={restId} goBack={() => go("map")} />
            )}
            {page === "queue" && <MyQueuePage goRestaurant={(id)=>{ setRestId(id); go("rest"); }} />}
            {page === "saved" && <div>Saved page here…</div>}
            {page === "profile" && <div>Profile page here…</div>}
            {page === "random" && <div>Random page here…</div>}
            {page === "together" && <div>together list…</div>}
            {page === "ai" && <div>AI chat here…</div>}
            {page === "setting" && <div>Settings…</div>}
          </>
        )}
      </div>

      {/* Bottom Nav เฉพาะตอนล็อกอิน */}
      {user && (
        <BottomNav current={page} onNavigate={(p) => go(p)} />
      )}

      {/* Sidebar */}
      <Sidebar
        open={sidebarOpen}
        onClose={()=>setSidebarOpen(false)}
        onAction={(id)=>{
          if (id === "logout") {
            setSidebarOpen(false);
            setConfirmLogout(true); // ← เปิด popup
            return;
          }
          go(id);
        }}
      />
             {/* กล่องยืนยันออกจากระบบ */}
       <ConfirmDialog
        open={confirmLogout}
        title="Sign out"
        message="คุณต้องการออกจากระบบหรือไม่?"
        onCancel={()=>setConfirmLogout(false)}
        onConfirm={async ()=>{
          setConfirmLogout(false);
          await signOut(auth);     // App จะสลับมาหน้า Login เองผ่าน listener
          // ไม่ต้อง reload หน้า
        }}
      />
    </>
  );
}
