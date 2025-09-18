// src/pages/AchievementsPage.jsx
import { useEffect, useState, useMemo } from "react";
import { auth, db } from "../firebase";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import {
  ACHIEVEMENTS,
  ensureUserStats,
  checkAndGrantAll,
} from "../lib/achievements";

function AchCard({ icon, title, desc, unlocked, progressText, date }) {
  const card = {
    border: "1px solid #eee",
    borderRadius: 12,
    padding: 12,
    display: "flex",
    gap: 12,
    alignItems: "center",
    background: unlocked ? "#fff" : "#f6f6f7",
    color: unlocked ? "#111" : "#9096a0",
  };
  const circle = {
    width: 56, height: 56, borderRadius: "50%",
    display: "grid", placeItems: "center",
    background: unlocked ? "#fff7e6" : "#eee",
    border: "1px solid #eee",
    fontSize: 26, filter: unlocked ? "none" : "grayscale(100%)",
  };
  return (
    <div style={card}>
      <div style={circle}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 800, marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 13, opacity: 0.85 }}>{desc}</div>
        <div style={{ fontSize: 12, marginTop: 4 }}>
          {unlocked ? (
            <span>ปลดล็อกแล้ว {date ? `— ${date}` : ""}</span>
          ) : (
            <span>ความคืบหน้า: {progressText}</span>
          )}
        </div>
      </div>
      {unlocked && <span style={{ fontSize: 18 }}>🏆</span>}
    </div>
  );
}

export default function AchievementsPage({ goBack }) {
  const u = auth.currentUser;
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [earned, setEarned] = useState({});

  useEffect(() => {
    if (!u) return;
    (async () => {
      setLoading(true);
      await ensureUserStats(u.uid);
      await checkAndGrantAll(u.uid);

      const sSnap = await getDoc(doc(db, "users", u.uid, "stats", "_main"));
      setStats(sSnap.exists() ? sSnap.data() : {});

      const aSnap = await getDocs(collection(db, "users", u.uid, "achievements"));
      const map = {};
      aSnap.forEach((d) => (map[d.id] = d.data()));
      setEarned(map);

      setLoading(false);
    })();
  }, [u]);

  const cards = useMemo(() => {
    if (!stats) return [];
    return ACHIEVEMENTS.map((a) => {
      const total = a.total || 1;
      const cur = Math.min(total, a.progress(stats) || 0);
      const unlocked = !!earned[a.id];
      const dt = earned[a.id]?.date_earned?.toDate?.();
      const dateStr = dt ? dt.toLocaleString() : "";
      return {
        id: a.id,
        icon: a.icon,
        title: a.title,
        desc: a.desc,
        unlocked,
        progressText: `${cur}/${total}`,
        date: dateStr
      };
    });
  }, [stats, earned]);

  if (loading) return <div style={{ padding: 12 }}>Loading…</div>;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          type="button"
          onClick={goBack}
          style={{ border: "none", background: "#111", color: "#fff", padding: "10px 14px", borderRadius: 8, cursor: "pointer", marginBottom: 12 }}
        >
          Back
        </button>
        <h2 style={{ margin: "12px 0" }}>Achievements</h2>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {cards.map((c) => (
          <AchCard key={c.id} {...c} />
        ))}
      </div>
    </div>
  );
}
