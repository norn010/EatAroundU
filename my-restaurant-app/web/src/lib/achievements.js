// src/lib/achievements.js
import {
  doc, getDoc, setDoc, updateDoc, serverTimestamp,
  increment, collection, getDocs
} from "firebase/firestore";
import { db } from "../firebase";

/* --------------------------------------------------------- *
 *  ชื่อ field ที่ใช้ใน users/{uid}/stats/_main
 *  (มีอยู่แล้วในฐานของคุณ)
 *  - first_login_done : boolean
 *  - restaurants_viewed_count : number
 *  - reviews_count : number
 *  - together_created_count : number
 *  - stores_created_count : number
 *  - my_restaurants_total_views : number   // owner เท่านั้น
 *  - my_restaurants_total_reviews : number // owner เท่านั้น
 * --------------------------------------------------------- */

export const ACHIEVEMENTS = [
  {
    id: "first_login",
    title: "เริ่มต้นการเดินทาง",
    desc: "ล็อกอินเข้าใช้ครั้งแรก",
    icon: "🎉",
    total: 1,
    progress: (s) => (s.first_login_done ? 1 : 0),
    done: (s) => !!s.first_login_done,
  },
  {
    id: "view_5",
    title: "สำรวจเมือง (ขั้น 1)",
    desc: "กดเข้าดูร้านครบ 5 ร้าน",
    icon: "🗺️",
    total: 5,
    progress: (s) => s.restaurants_viewed_count || 0,
    done: (s) => (s.restaurants_viewed_count || 0) >= 5,
  },
  {
    id: "view_10",
    title: "สำรวจเมือง (ขั้น 2)",
    desc: "กดเข้าดูร้านครบ 10 ร้าน",
    icon: "🗺️",
    total: 10,
    progress: (s) => s.restaurants_viewed_count || 0,
    done: (s) => (s.restaurants_viewed_count || 0) >= 10,
  },
  {
    id: "review_5",
    title: "นักรีวิว (ขั้น 1)",
    desc: "ให้คะแนน/รีวิวครบ 5 ร้าน",
    icon: "⭐",
    total: 5,
    progress: (s) => s.reviews_count || 0,
    done: (s) => (s.reviews_count || 0) >= 5,
  },
  {
    id: "review_10",
    title: "นักรีวิว (ขั้น 2)",
    desc: "ให้คะแนน/รีวิวครบ 10 ร้าน",
    icon: "⭐",
    total: 10,
    progress: (s) => s.reviews_count || 0,
    done: (s) => (s.reviews_count || 0) >= 10,
  },
  {
    id: "host_3",
    title: "หัวตี้ (ขั้น 1)",
    desc: "สร้างห้อง Together ครบ 3 ครั้ง",
    icon: "🧑‍🤝‍🧑",
    total: 3,
    progress: (s) => s.together_created_count || 0,
    done: (s) => (s.together_created_count || 0) >= 3,
  },
  {
    id: "host_10",
    title: "หัวตี้ (ขั้น 2)",
    desc: "สร้างห้อง Together ครบ 10 ครั้ง",
    icon: "🧑‍🤝‍🧑",
    total: 10,
    progress: (s) => s.together_created_count || 0,
    done: (s) => (s.together_created_count || 0) >= 10,
  },
  {
    id: "store_created_1",
    title: "ร้านแรกของฉัน",
    desc: "สร้างร้านครั้งแรก",
    icon: "🏪",
    total: 1,
    progress: (s) => (s.stores_created_count || 0) > 0 ? 1 : 0,
    done: (s) => (s.stores_created_count || 0) >= 1,
  },
  {
    id: "owner_views_50",
    title: "ร้านฉันคนเพียบ (ขั้น 1)",
    desc: "ยอดคนเยี่ยมชมร้านของฉันรวม ≥ 50 ครั้ง",
    icon: "👀",
    total: 50,
    progress: (s) => s.my_restaurants_total_views || 0,
    done: (s) => (s.my_restaurants_total_views || 0) >= 50,
  },
  {
    id: "owner_reviews_10",
    title: "ร้านฉันรีวิวกระฉูด",
    desc: "ยอดรีวิวทุกร้านของฉันรวม ≥ 10 รีวิว",
    icon: "💬",
    total: 10,
    progress: (s) => s.my_restaurants_total_reviews || 0,
    done: (s) => (s.my_restaurants_total_reviews || 0) >= 10,
  },
];

/* ------------------------ utils for stats ------------------------ */
const statsRef = (uid) => doc(db, "users", uid, "stats", "_main");
const achRef = (uid, id) => doc(db, "users", uid, "achievements", id);

export async function ensureUserStats(uid) {
  const ref = statsRef(uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      first_login_done: false,
      restaurants_viewed_count: 0,
      reviews_count: 0,
      together_created_count: 0,
      stores_created_count: 0,
      my_restaurants_total_views: 0,
      my_restaurants_total_reviews: 0,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });
  }
}

export async function markFirstLogin(uid) {
  const ref = statsRef(uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const s = snap.data();
  if (!s.first_login_done) {
    await updateDoc(ref, { first_login_done: true, updated_at: serverTimestamp() });
    await checkAndGrantAll(uid);     // ปล่อยเหรียญจากค่านี้
  }
}

export async function incUserStat(uid, field, by = 1) {
  await updateDoc(statsRef(uid), {
    [field]: increment(by),
    updated_at: serverTimestamp(),
  });
  await checkAndGrantAll(uid);
}

/* ตัวอย่าง: เรียกเวลามีการเปิดหน้าร้าน */
export async function addRestaurantView(viewerUid) {
  await incUserStat(viewerUid, "restaurants_viewed_count", 1);
}

/* ----------------- ตรวจเช็คแล้วปล่อยเหรียญทั้งหมด ----------------- */
export async function checkAndGrantAll(uid) {
  const sSnap = await getDoc(statsRef(uid));
  if (!sSnap.exists()) return;
  const stats = sSnap.data();

  // ดึงที่ปลดแล้ว
  const earnedMap = {};
  const now = new Date();
  const ownAchCol = collection(db, "users", uid, "achievements");
  const curEarned = await getDocs(ownAchCol);
  curEarned.forEach((d) => (earnedMap[d.id] = true));

  // เช็คตาม ACHIEVEMENTS
  const ops = ACHIEVEMENTS.map(async (a) => {
    if (earnedMap[a.id]) return;
    if (a.done(stats)) {
      await setDoc(achRef(uid, a.id), {
        badge: a.title,
        icon: a.icon,
        description: a.desc,
        date_earned: serverTimestamp(),
        unlocked_at_ms: now.getTime(),
      });
    }
  });
  await Promise.all(ops);
}
