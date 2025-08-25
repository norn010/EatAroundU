const API = 'http://localhost:3000/api';

export const getNearby = async (lat,lng,radius=2,user_id=1) =>
  fetch(`${API}/restaurants/nearby?lat=${lat}&lng=${lng}&radius=${radius}&user_id=${user_id}`).then(r=>r.json());

export const getRestaurant = async (id) =>
  fetch(`${API}/restaurants/${id}`).then(r=>r.json());

// เปลี่ยน path: ต้องส่ง restaurantId + tableId
export const bookTable = async (restaurantId, tableId, user_id=1) =>
  fetch(`${API}/tables/${restaurantId}/${tableId}/book`,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({user_id})
  }).then(r=>r.json());

export const clearTable = async (restaurantId, tableId) =>
  fetch(`${API}/tables/${restaurantId}/${tableId}/clear`,{method:'PATCH'}).then(r=>r.json());

export const myQueue = async (user_id=1) =>
  fetch(`${API}/my-queue?user_id=${user_id}`).then(r=>r.json());
