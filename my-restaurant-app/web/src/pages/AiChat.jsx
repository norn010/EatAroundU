// web/src/pages/AIChat.jsx
import { useEffect, useRef, useState } from "react";

const FN_URL = "https://us-central1-eataroundu.cloudfunctions.net/askGemini";

export default function AIChat({ onOpenRestaurant }) {
  const [msgs, setMsgs] = useState([
    { role: "bot", text: "สวัสดีค่ะ 👋 ฉันคือผู้ช่วยแนะนำอาหารและร้านใกล้คุณ พิมพ์เมนูที่อยากกินหรือตั้งงบ/ทำเลได้เลย" }
  ]);
  const [cards, setCards] = useState([]); // เก็บการ์ดชุดล่าสุด
  const [input, setInput] = useState("");
  const [pos, setPos] = useState(null);
  const [radiusKm] = useState(3);
  const listRef = useRef(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setPos(null),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    );
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo(0, listRef.current.scrollHeight);
  }, [msgs, cards]);

  async function send() {
    const text = input.trim();
    if (!text) return;

    setMsgs((m) => [...m, { role: "me", text }]);
    setInput("");
    setCards([]); // เคลียร์การ์ดเก่า

    try {
      const resp = await fetch(FN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text, center: pos, radiusKm }),
      });
      const data = await resp.json();

      // กรณี function ตอบเป็น JSON ที่เรากำหนด
      if (data?.items && Array.isArray(data.items)) {
        const summary = data.summary || "นี่คือร้านที่แนะนำ";
        setMsgs((m) => [...m, { role: "bot", text: summary }]);
        setCards(data.items);
      } else {
        // fallback กรณีตอบเป็น text เดิม
        const reply =
          data?.candidates?.[0]?.content?.parts?.[0]?.text ||
          "ขออภัย ไม่พบคำตอบค่ะ";
        setMsgs((m) => [...m, { role: "bot", text: reply }]);
      }
    } catch (e) {
      setMsgs((m) => [...m, { role: "bot", text: "เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์" }]);
    }
  }

  return (
    <div style={{maxWidth: 760, margin: "0 auto"}}>
      <h2>AI Chat</h2>

      <div ref={listRef} style={{
        minHeight: 380, maxHeight: 520, overflowY: "auto",
        border: "1px solid #eee", borderRadius: 12, padding: 12
      }}>
        {msgs.map((m, i) => (
          <div key={i} style={{textAlign: m.role === "me" ? "right" : "left", margin: "10px 0"}}>
            <div style={{
              display: "inline-block",
              background: m.role === "me" ? "#111" : "#f3f3f3",
              color: m.role === "me" ? "#fff" : "#000",
              borderRadius: 10, padding: "10px 12px", maxWidth: "90%", whiteSpace: "pre-wrap"
            }}>
              {m.text}
            </div>
          </div>
        ))}

        {/* การ์ดร้านแนะนำ */}
        {cards.length > 0 && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 12, marginTop: 8
          }}>
            {cards.map((c, idx) => (
              <div key={c.id || idx} style={{
                border: "1px solid #eee", borderRadius: 12, overflow: "hidden", background: "#fff"
              }}>
                {c.image_url ? (
                  <div style={{height: 120, overflow: "hidden", background: "#f6f6f6"}}>
                    <img src={c.image_url} alt={c.name} style={{width: "100%", height: "100%", objectFit: "cover"}} />
                  </div>
                ) : (
                  <div style={{
                    height: 120, display: "grid", placeItems: "center",
                    background: "#f6f6f6", color: "#999", fontSize: 12
                  }}>ไม่มีรูป</div>
                )}

                <div style={{padding: 10}}>
                  <div style={{fontWeight: 700, marginBottom: 4}}>{c.name}</div>
                  <div style={{fontSize: 12, opacity: .8, marginBottom: 4}}>
                    ⭐ {Number(c.rating || 0).toFixed(1)} • {c.price_range || "฿"} • {c.distance_km} กม.
                  </div>
                  {c.top_menus?.length > 0 && (
                    <div style={{fontSize: 12, opacity: .9, marginBottom: 6}}>
                      เมนูแนะนำ: {c.top_menus.slice(0,3).join(", ")}
                    </div>
                  )}
                  {c.reason && (
                    <div style={{fontSize: 12, opacity: .8, marginBottom: 8}}>
                      {c.reason}
                    </div>
                  )}
                  <button
                    onClick={() => onOpenRestaurant?.(c.id)}
                    style={{
                      width: "100%", padding: "8px 10px",
                      borderRadius: 8, background: "#111", color: "#fff", border: "none"
                    }}
                  >
                    ไปหน้าร้าน
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{display: "flex", gap: 8, marginTop: 10}}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="พิมพ์ข้อความ… (กด Enter เพื่อส่ง)"
          style={{flex: 1, border: "1px solid #ddd", borderRadius: 10, padding: "10px 12px"}}
        />
        <button onClick={send} style={{padding: "10px 16px", borderRadius: 10}}>ส่ง</button>
      </div>

      <div style={{fontSize: 12, opacity: .6, marginTop: 6}}>
        Function URL: {FN_URL}
      </div>
    </div>
  );
}
