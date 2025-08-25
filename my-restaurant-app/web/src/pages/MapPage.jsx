import {useEffect, useRef, useState} from 'react';
import { getNearby } from '../api';

export default function MapPage({onOpenRestaurant}) {
  const mapRef = useRef(null);
  const [radius, setRadius] = useState(2);

  useEffect(()=> {
    const map = L.map('map').setView([13.7563, 100.5018], 13);
    mapRef.current = map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:'© OpenStreetMap'
    }).addTo(map);

    navigator.geolocation.getCurrentPosition(async pos=>{
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      map.setView([lat,lng], 14);

      const circle = L.circle([lat,lng], {radius: radius*1000}).addTo(map);
      circle.bindPopup('ตำแหน่งของคุณ').openPopup();

      const data = await getNearby(lat,lng,radius);
      data.forEach(r=>{
        const m = L.marker([r.latitude, r.longitude]).addTo(map);
        m.bindPopup(`
          <b>${r.name}</b><br>
          ${r.type || ''} • ⭐ ${r.rating ?? '-'} • ${r.distance_km.toFixed(2)} km<br>
          <button id="go-${r.id}" style="margin-top:6px">ไปหน้าร้าน</button>
        `);
        m.on('popupopen', ()=>{
          setTimeout(()=>{
            const btn = document.getElementById(`go-${r.id}`);
            if (btn) btn.onclick = ()=> onOpenRestaurant(r.id);
          },0);
        });
      });

    }, ()=> alert('ใช้พิกัดไม่ได้'));
    return ()=> map.remove();
  }, [radius, onOpenRestaurant]);

  return (
    <div className="container">
      <div className="card">
        <label>รัศมี (กม.) </label>
        <input type="range" min="1" max="10" value={radius}
          onChange={e=>setRadius(Number(e.target.value))}/>
        <b> {radius} km</b>
      </div>
      <div id="map"></div>
    </div>
  );
}
