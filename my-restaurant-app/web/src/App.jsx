// App.jsx
import { useEffect, useState } from "react";
import Header from "./components/Header";
import BottomNav from "./components/BottomNav";
import Sidebar from "./components/Sidebar";
import ConfirmDialog from "./components/ConfirmDialog";

import MapPage from "./pages/MapPage";
import StoreList from "./pages/StoreList";
import MyStoreList from "./pages/MyStoreList";     // ✅ เพิ่ม
import StoreCreate from "./pages/StoreCreate";     // ✅ เพิ่ม
import SavedPage from "./pages/SavedPage";
import RestaurantPage from "./pages/RestaurantPage";
import MyQueuePage from "./pages/MyQueuePage";
import AuthPage from "./pages/Auth";

import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";

export default function App() {
  const [page, setPage] = useState("auth");
  const [restId, setRestId] = useState(null);
  const [user, setUser] = useState(null);
  const [title, setTitle] = useState("Login");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  // ✅ เก็บว่าเรามาจากหน้าไหน (เพื่อใช้กับปุ่ม Back)
  const [prevPage, setPrevPage] = useState("map");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const snap = await getDoc(doc(db, "users", u.uid));
        const profile = snap.exists() ? snap.data() : { user_type: "user" };
        setUser({ uid: u.uid, email: u.email, ...profile });
        setPage((p) => (p === "auth" ? "map" : p));
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
    storelist: "Store",
    rest: "Store Detail",
    queue: "My Queue",
    saved: "Saved",
    profile: "Profile",
    random: "Random",
    together: "together",
    ai: "AI Chat",
    setting: "Setting",

    // ✅ เพิ่มสองหน้าของฝั่ง owner
    mystore: "My Store",
    store_new: "Create Store",
  };

  const go = (p) => {
    setPage(p);
    setTitle(titleMap[p] || "");
    setSidebarOpen(false);
  };

  const handleLoggedIn = (u) => {
    setUser(u);
    go("map");
  };

  // ✅ ฟังก์ชันมาตรฐาน เวลาเปิดหน้าร้าน
  const openRestaurant = (id) => {
    setRestId(id);
    setPrevPage(page); // จำหน้าที่มาด้วย (map/storelist/mystore)
    go("rest");
  };

  // ---- Render page เดียวในคราวเดียว ----
  let content = null;
  if (!authReady) {
    content = <div style={{ padding: 12 }}>Loading…</div>;
  } else if (!user) {
    content = (
      <AuthPage
        onLoggedIn={handleLoggedIn}
        onModeChange={(m) => setTitle(m === "register" ? "Register" : "Login")}
      />
    );
  } else {
    switch (page) {
      case "map":
        content = (
          <MapPage
            onOpenRestaurant={openRestaurant}
            setTitle={() => setTitle("Home")}
          />
        );
        break;

      case "storelist":
        content = <StoreList onOpenStore={openRestaurant} />;
        break;

      // ✅ หน้ารายการ “ร้านของฉัน” (owner เท่านั้น)
      case "mystore":
        content = (
          <MyStoreList
            user={user}
            onNewStore={() => go("store_new")}
            onOpenStore={openRestaurant}
          />
        );
        break;

      // ✅ หน้าเพิ่มร้านใหม่ (owner เท่านั้น)
      case "store_new":
        content = (
          <StoreCreate
            user={user}
            onCreated={() => go("mystore")}
            onCancel={() => go("mystore")}
          />
        );
        break;

      case "rest":
        content = (
          <RestaurantPage
            id={restId}
            goBack={() => go(prevPage)}  // ✅ กลับไปยังหน้าเดิมที่มาหา
          />
        );
        break;

      case "queue":
        content = <MyQueuePage goRestaurant={openRestaurant} />;
        break;
        
      case "saved":
        content = <SavedPage onOpenRestaurant={openRestaurant} />;
        break;

      default:
        content = <div style={{ padding: 12 }}>Not found</div>;
    }
  }

  return (
    <>
      <Header title={title} user={user} onAvatarClick={() => setSidebarOpen(true)} />
      <div className="page-wrap" style={{ padding: 12, paddingBottom: 64 }}>
        {content}
      </div>

      {user && <BottomNav current={page} onNavigate={(p) => go(p)} />}

      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        user={user}
        onAction={(id) => {
          if (id === "logout") {
            setSidebarOpen(false);
            setConfirmLogout(true);
            return;
          }
          go(id);
        }}
      />

      <ConfirmDialog
        open={confirmLogout}
        title="Sign out"
        message="คุณต้องการออกจากระบบหรือไม่?"
        onCancel={() => setConfirmLogout(false)}
        onConfirm={async () => {
          setConfirmLogout(false);
          await signOut(auth);
        }}
      />
    </>
  );
}
