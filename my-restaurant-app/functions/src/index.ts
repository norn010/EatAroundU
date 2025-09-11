// functions/src/index.ts
import { onRequest } from "firebase-functions/v2/https";
import "dotenv/config";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

initializeApp();
const db = getFirestore();

const MODEL_ID = process.env.GEMINI_MODEL_ID || "gemini-1.5-flash";

function toRad(d: number) { return (d * Math.PI) / 180; }
function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export const askGemini = onRequest({ region: "us-central1" }, async (req, res): Promise<void> => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") { res.status(204).send(""); return; }

  try {
    const key = process.env.GEMINI_API_KEY;
    if (!key) { res.status(500).json({ error: "Missing GEMINI_API_KEY" }); return; }

    const prompt: string = (req.body?.prompt ?? "").toString();
    const center = req.body?.center || {};
    const lat = Number(center.lat ?? 13.7563);
    const lng = Number(center.lng ?? 100.5018);
    const radiusKm = Number(req.body?.radiusKm ?? 3);

    // ----- ค้นหาร้านจาก Firestore -----
    const deltaLat = radiusKm / 110.574;
    const cosLat = Math.cos((lat * Math.PI) / 180) || 1e-6;
    const deltaLng = radiusKm / (111.320 * cosLat);

    const minLat = lat - deltaLat;
    const maxLat = lat + deltaLat;
    const minLng = lng - deltaLng;
    const maxLng = lng + deltaLng;

    const snap = await db
      .collection("restaurants")
      .where("latitude", ">=", minLat)
      .where("latitude", "<=", maxLat)
      .orderBy("latitude")
      .get();

    const rows = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .filter((r) =>
        typeof r.latitude === "number" &&
        typeof r.longitude === "number" &&
        r.longitude >= minLng && r.longitude <= maxLng
      )
      .map((r) => ({
        ...r,
        distance_km: haversine(lat, lng, r.latitude, r.longitude),
      }))
      .filter((r) => r.distance_km <= radiusKm + 1e-6)
      .sort((a, b) => a.distance_km - b.distance_km)
      .slice(0, 15);

    const withMenus = await Promise.all(
      rows.map(async (r) => {
        const ms = await db
          .collection("restaurants")
          .doc(r.id)
          .collection("menus")
          .limit(6)
          .get();
        const menus = ms.docs.map((m) => {
          const d = m.data() as any;
          return { name: d.name || "", price: d.price ?? 0 };
        });
        return {
          id: r.id,
          name: r.name || "ร้านไม่มีชื่อ",
          rating: Number(r.rating || 0),
          price_range: r.price_range || "",
          address: r.address || "",
          image_url: r.image_url || "",
          distance_km: Number(r.distance_km?.toFixed(2) || 0),
          top_menus: menus.map((m) => m.name).filter(Boolean).slice(0, 4),
        };
      })
    );

    // ----- Prompt ให้ตอบเป็น JSON เท่านั้น -----
    const systemHint = `
คุณเป็นผู้ช่วยแนะนำอาหาร/ร้านอาหาร (ภาษาไทยสั้น กระชับ)
ใช้ข้อมูลเฉพาะใน CONTEXT เท่านั้น ห้ามแต่งเพิ่มเอง
ให้เลือก 3 ร้านที่เหมาะที่สุด พร้อมเหตุผลสั้นๆ
ตอบกลับเป็น JSON เท่านั้น (ห้ามมี Markdown)
รูปแบบ:
{
  "summary": "ข้อความสรุป",
  "items": [
    {"id":"<restaurant_id>", "name":"...", "distance_km":1.2, "rating":4.2, "price_range":"฿฿", "top_menus":["..."], "reason":"..."}
  ]
}
`;
    const contextJson = JSON.stringify(withMenus, null, 2);
    const finalPrompt = `
SYSTEM:
${systemHint}

CONTEXT(JSON):
${contextJson}

USER QUESTION:
${prompt}
`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:generateContent?key=${key}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: finalPrompt }] }] }),
    });

    const data: any = await resp.json();
    if (!resp.ok || data?.error) {
      res.status(500).json({ error: data?.error?.message || `Gemini API error (${resp.status})` });
      return;
    }

    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    // พยายาม parse JSON ที่โมเดลตอบ
    let parsed: any = null;
    try {
      // บางครั้งโมเดลเผลอแทรกข้อความ → ดึง {...} ก้อนแรก
      const match = raw.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(match ? match[0] : raw);
    } catch {
      // fallback: เลือกร้าน 3 ร้านแรก
      parsed = {
        summary: "นี่คือร้านใกล้คุณที่น่าสนใจ",
        items: withMenus.slice(0, 3).map((r) => ({
          id: r.id,
          name: r.name,
          distance_km: r.distance_km,
          rating: r.rating,
          price_range: r.price_range,
          top_menus: r.top_menus,
          reason: "ใกล้และคะแนนรีวิวดี",
        })),
      };
    }

    // จำกัด fields ที่จะส่งกลับ
    const clean = {
      summary: String(parsed.summary || ""),
      items: Array.isArray(parsed.items)
        ? parsed.items.slice(0, 6).map((it: any) => {
            const base = withMenus.find((w) => w.id === it.id);
            return {
              id: String(it.id || base?.id || ""),
              name: String(it.name || base?.name || ""),
              distance_km: Number(it.distance_km ?? base?.distance_km ?? 0),
              rating: Number(it.rating ?? base?.rating ?? 0),
              price_range: String(it.price_range ?? base?.price_range ?? ""),
              top_menus: Array.isArray(it.top_menus) ? it.top_menus : (base?.top_menus || []),
              image_url: base?.image_url || "",
              reason: String(it.reason || ""),
            };
          })
        : [],
    };

    res.status(200).json(clean);
    return;
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? String(e) });
    return;
  }
});
