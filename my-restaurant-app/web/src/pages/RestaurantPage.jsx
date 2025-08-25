import {useEffect, useState} from 'react';
import { getRestaurant, bookTable, clearTable } from '../api';

export default function RestaurantPage({id, goBack}) {
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState('');

  useEffect(()=>{ (async()=> setData(await getRestaurant(id)))(); }, [id]);

  if (!data) return <div className="container">Loading...</div>;
  const {restaurant, menus, tables} = data;

  return (
    <div className="container">
      <button onClick={goBack}>← กลับ</button>
      <h2>{restaurant.name}</h2>
      <div>{restaurant.type} • ⭐ {restaurant.rating}</div>
      <p>{restaurant.description}</p>

      <h3>Popular Menu</h3>
      {menus?.map(m=>(
        <div className="card" key={m.id}>
          <b>{m.name}</b> — {m.price} บาท
          <div>แคลอรี่: {m.calories} kcal</div>
        </div>
      ))}

      <h3>Queue / โต๊ะ</h3>
      {tables?.map(t=>(
        <div className="card" key={t.id}>
          โต๊ะ {t.table_number} — {t.status==='available'?'ว่าง':'เต็ม'}
          {t.status==='available'
            ? <button onClick={async()=>{
                const r = await bookTable(restaurant.id, t.id, 1);
                setMsg(r.error || 'จองสำเร็จ!');
              }}>จอง</button>
            : <button onClick={async()=>{
                const r = await clearTable(restaurant.id, t.id);
                setMsg(r.error || 'เคลียร์โต๊ะแล้ว (เดโม)');
              }}>เคลียร์ (เดโม owner)</button>}
        </div>
      ))}
      {msg && <div className="card">{msg}</div>}
    </div>
  );
}
