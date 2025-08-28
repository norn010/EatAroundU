// src/pages/StoreList.jsx
import { useEffect, useMemo, useState } from "react";
import {
  collection, getDocs, collectionGroup,
  query as fsQuery, orderBy, startAt, endAt, limit
} from "firebase/firestore";
import { db } from "../firebase";

function distanceKm(lat1, lon1, lat2, lon2) {
  if ([lat1, lon1, lat2, lon2].some(v => typeof v !== "number" || Number.isNaN(v)))
    return Infinity;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat/2)**2 +
            Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) *
            Math.sin(dLon/2)**2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export default function StoreList({ onOpenStore }) {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [queryText, setQueryText] = useState("");
  const [me, setMe] = useState({ lat: null, lng: null });

  // debounce
  useEffect(() => {
    const t = setTimeout(() => setQueryText(q.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [q]);

  // พิกัดผู้ใช้
  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      pos => setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setMe({ lat: null, lng: null }),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  // โหลดร้านทั้งหมด
  useEffect(() => {
    (async () => {
      setLoading(true);
      const snap = await getDocs(collection(db, "restaurants"));
      setStores(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    })();
  }, []);

  // หาเมนูที่ตรงคำค้น
  const [menuHitsByRest, setMenuHitsByRest] = useState({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!queryText) {
        setMenuHitsByRest({});
        return;
      }
      const qMen = fsQuery(
        collectionGroup(db, "menus"),
        orderBy("name_lc"),
        startAt(queryText),
        endAt(queryText + "\uf8ff"),
        limit(60)
      );
      const snap = await getDocs(qMen);
      if (cancelled) return;

      const map = {};
      snap.forEach(docSnap => {
        const d = docSnap.data();
        if (!d.restaurant_id) return;
        if (!map[d.restaurant_id]) map[d.restaurant_id] = [];
        map[d.restaurant_id].push(d.name);
      });
      setMenuHitsByRest(map);
    })();
    return () => { cancelled = true; };
  }, [queryText]);

  // รวมและเรียง
  const list = useMemo(() => {
    const withDist = stores.map(r => ({
      ...r,
      _distance:
        me.lat == null || me.lng == null
          ? Infinity
          : distanceKm(me.lat, me.lng, r.latitude, r.longitude),
      _menuHits: menuHitsByRest[r.id] || [],
    }));

    const byText = (r) => {
      if (!queryText) return true;
      const base = `${r.name || ""} ${r.description || ""} ${(r.type || "")} ${(r.tags || "").toString()}`.toLowerCase();
      const matchBase = base.includes(queryText);
      const matchMenu = (r._menuHits || []).some(n => (n || "").toLowerCase().includes(queryText));
      return matchBase || matchMenu;
    };
    const filtered = withDist.filter(byText);

    return filtered.sort((a, b) => {
      const aHit = a._menuHits.length ? 1 : 0;
      const bHit = b._menuHits.length ? 1 : 0;
      if (aHit !== bHit) return bHit - aHit;
      if (a._distance !== b._distance) return a._distance - b._distance;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }, [stores, me.lat, me.lng, queryText, menuHitsByRest]);

  // click handler ปลอดภัย
  const handleOpen = (id, e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (typeof onOpenStore === "function") {
      console.log("[StoreList] click:", id);
      onOpenStore(id);
    } else {
      console.warn("[StoreList] onOpenStore prop is not provided");
    }
  };

  return (
    <div style={{ maxWidth: 520, margin: "0 auto" }}>
      {/* Search */}
      <div style={{
        display:"flex", alignItems:"center", gap:8, background:"#f5f5f7",
        borderRadius:14, padding:"10px 12px", marginBottom:12, position:"sticky", top:8, zIndex:2
      }}>
        <span style={{fontSize:18}}>🔎</span>
        <input
          value={q}
          onChange={(e)=>setQ(e.target.value)}
          placeholder="Search store or menu…"
          style={{ flex:1, border:"none", outline:"none", background:"transparent", fontSize:16 }}
        />
      </div>

      {loading && <div>Loading stores…</div>}
      {!loading && list.length === 0 && <div style={{opacity:.7}}>No result</div>}

      {list.map(r => {
        const km = r._distance === Infinity ? "-" : (Math.round(r._distance * 10) / 10).toFixed(1);
        const menuPreview = r._menuHits.slice(0, 3).join(", ");
        return (
          <div
            key={r.id}
            role="button"
            tabIndex={0}
            
            onClick={(e) => handleOpen(r.id, e)}
            onKeyDown={(e)=>{ if (e.key==='Enter') handleOpen(r.id, e); }}
            style={{
              cursor:"pointer",
              width:"100%", textAlign:"left",
              background:"transparent", marginBottom:12
            }}
          >
            <div style={{
              display:"grid", gridTemplateColumns:"80px 1fr", gap:12, padding:10,
              background:"#fff", borderRadius:12, boxShadow:"0 1px 6px rgba(0,0,0,.06)"
            }}>
              <div style={{ width:80, height:80, borderRadius:10, overflow:"hidden", background:"#eee" }}>
                {r.image_url ? (
                  <img src={r.image_url} alt={r.name}
                       style={{width:"100%", height:"100%", objectFit:"cover"}}/>
                ) : (
                  <div style={{width:"100%", height:"100%", display:"grid", placeItems:"center", color:"#999"}}>🖼️</div>
                )}
              </div>
              <div>
                <div style={{fontWeight:700, marginBottom:4}}>{r.name}</div>
                <div style={{display:"flex", alignItems:"center", gap:8}}>
                  <span>⭐</span><span>{r.rating ?? "N/A"}</span>
                </div>
                <div style={{display:"flex", alignItems:"center", gap:6, marginTop:4, color:"#666", fontSize:13}}>
                  <span>📍</span><span>{km === "-" ? "-" : `${km} km`}</span>
                </div>
                {!!menuPreview && (
                  <div style={{marginTop:6, fontSize:12, color:"#444"}}>
                    <span style={{opacity:.7}}>menu: </span>{menuPreview}
                    {r._menuHits.length > 3 ? "…" : ""}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
