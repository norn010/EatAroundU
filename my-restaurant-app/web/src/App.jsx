// src/App.jsx
import { useEffect, useState } from "react";
import Header from "./components/Header";
import BottomNav from "./components/BottomNav";
import Sidebar from "./components/Sidebar";
import ConfirmDialog from "./components/ConfirmDialog";

import MapPage from "./pages/MapPage";
import StoreList from "./pages/StoreList";
import MyStoreList from "./pages/MyStoreList";
import StoreCreate from "./pages/StoreCreate";
import StoreEdit from "./pages/StoreEdit";
import SavedPage from "./pages/SavedPage";
import RestaurantPage from "./pages/RestaurantPage";
import RestaurantDistancePage from "./pages/RestaurantDistancePage";
import RestaurantQueuePage from "./pages/RestaurantQueuePage";
import MyQueuePage from "./pages/MyQueuePage";
import StoreQueueManage from "./pages/StoreQueueManage";
import AuthPage from "./pages/Auth";

import TogetherCreateModal from "./components/TogetherCreateModal";
import TogetherChat from "./pages/TogetherChat";
import TogetherList from "./pages/TogetherList";

import AiChat from "./pages/AiChat";
import ProfilePage from "./pages/ProfilePage";
import AchievementsPage from "./pages/AchievementsPage"; // ✅ เพิ่ม

import { ensureUserStats, markFirstLogin, incUserStat, addRestaurantView } from "./lib/achievements"; // ✅ รวม import เดียว

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

  // เก็บหน้าที่มา สำหรับปุ่ม back
  const [prevPage, setPrevPage] = useState("map");
  const [createTogetherFor, setCreateTogetherFor] = useState(null);
  const [togetherRoomId, setTogetherRoomId] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const snap = await getDoc(doc(db, "users", u.uid));
        const profile = snap.exists() ? snap.data() : { user_type: "user" };
        setUser({
          uid: u.uid,
          email: u.email,
          ...profile,
        });
        setPage((p) => (p === "auth" ? "map" : p));
        setTitle("Home");

        await ensureUserStats(u.uid);
        await markFirstLogin(u.uid);
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
    rest_distance: "Distance",
    queue: "My Queue",
    saved: "Saved",
    profile: "Profile",
    random: "Random",
    together: "together",
    together_list: "Together",
    together_chat: "Together Chat",
    ai: "AI Chat",
    setting: "Setting",

    mystore: "My Store",
    store_new: "Create Store",
    rest_queue: "Queue",
    mystore_queue: "Manage Tables",

    achievements: "Achievements", // ✅ เพิ่ม
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

  // ✅ เปิดหน้าร้าน + นับสถิติดูร้าน + รวมวิวไปยังเจ้าของ
  const openRestaurant = async (id) => {
    setRestId(id);
    setPrevPage(page);
    go("rest");

    try {
      const u = auth.currentUser;
      if (u) {
        await incUserStat(u.uid, "restaurants_viewed_count", 1);
        const rs = await getDoc(doc(db, "restaurants", id));
        const ownerId = rs.exists() ? rs.data().owner_id : null;
        if (ownerId) await addRestaurantView(id, ownerId);
      }
    } catch (e) {
      console.warn("stat update error:", e);
    }
  };

  const openQueueManage = (id) => {
    setRestId(id);
    setPrevPage(page);
    go("mystore_queue");
  };

  const handleCreateTogether = (restId, restName) => {
    setCreateTogetherFor({ id: restId, name: restName });
  };

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

      case "mystore":
        content = (
          <MyStoreList
            user={user}
            onNewStore={() => go("store_new")}
            onOpenStore={openRestaurant}
            onEditStore={(id) => { setRestId(id); go("store_edit"); }}
            onQueueManage={openQueueManage}
          />
        );
        break;

      case "store_edit":
        content = (
          <StoreEdit
            id={restId}
            onSaved={() => go("mystore")}
            onCancel={() => go("mystore")}
          />
        );
        break;

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
            goBack={() => go(prevPage)}
            onOpenQueue={(rid) => { setRestId(rid); go("rest_queue"); }}
            onCreateTogether={(rid, rname) => handleCreateTogether(rid, rname)}
            onOpenDistanceMap={(rid) => { setRestId(rid); go("rest_distance"); }}
          />
        );
        break;

      case "rest_distance":
        content = (
          <RestaurantDistancePage
            restId={restId}
            goBack={() => go("rest")}
            setTitle={setTitle}
          />
        );
        break;

      case "rest_queue":
        content = (
          <RestaurantQueuePage
            restId={restId}
            goBack={() => go("rest")}
          />
        );
        break;

      case "queue":
        content = <MyQueuePage goRestaurant={(id) => { setRestId(id); go("rest"); }} />;
        break;

      case "mystore_queue":
        content = (
          <StoreQueueManage
            restId={restId}
            goBack={() => go("mystore")}
          />
        );
        break;

      case "together_chat":
        content = (
          <TogetherChat
            roomId={togetherRoomId}
            goBack={() => go(prevPage || "map")}
          />
        );
        break;

      case "ai":
        content = (
          <AiChat
            onOpenRestaurant={(id) => { setRestId(id); go("rest"); }}
          />
        );
        break;

      case "together_list":
        content = (
          <TogetherList
            user={user}
            onEnterRoom={(roomId) => {
              setTogetherRoomId(roomId);
              setPrevPage("together_list");
              go("together_chat");
            }}
          />
        );
        break;

      case "saved":
        content = <SavedPage onOpenRestaurant={openRestaurant} />;
        break;

      case "profile":
        content = <ProfilePage goBack={() => go("map")} />;
        break;

      case "achievements": // ✅ หน้าใหม่
        content = <AchievementsPage goBack={() => go("map")} />;
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
          go(id); // รวม "achievements" ไว้แล้ว
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

      {createTogetherFor && (
        <TogetherCreateModal
          user={user}
          restaurant={{ id: createTogetherFor.id, name: createTogetherFor.name }}
          onClose={() => setCreateTogetherFor(null)}
          onCreated={(roomId) => {
            setCreateTogetherFor(null);
            setTogetherRoomId(roomId);
            setPrevPage(page);
            go("together_chat");
          }}
        />
      )}
    </>
  );
}
