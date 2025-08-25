import {useEffect, useState} from 'react';
import { myQueue } from '../api';

export default function MyQueuePage({goRestaurant}) {
  const [rows, setRows] = useState([]);
  useEffect(()=>{ (async()=> setRows(await myQueue(1)))() }, []);
  return (
    <div className="container">
      <h2>My Queue</h2>
      {rows.map(r=>(
        <div className="card" key={r.booking_id} onClick={()=>goRestaurant(r.restaurant_id)}>
          <b>{r.restaurant_name}</b> — โต๊ะ {r.table_number}
          <div>จองเมื่อ: {new Date(r.created_at).toLocaleString()}</div>
        </div>
      ))}
      {rows.length===0 && <div>ยังไม่มีการจอง</div>}
    </div>
  );
}
