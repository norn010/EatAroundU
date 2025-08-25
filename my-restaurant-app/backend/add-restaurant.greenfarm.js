// backend/add-restaurant.greenfarm.js
import { db, FieldValue } from './db.firebase.js';
import { geohashForLocation } from 'geofire-common';

async function addRestaurantWithMenusTables({
  owner_id,
  name,
  type,
  latitude,
  longitude,
  address,
  price_range,
  open_time,
  close_time,
  rating,
  description,
  is_new,
  menus = [],
  tables = [{ table_number: 1, status: 'available' }],
}) {
  const geohash = geohashForLocation([latitude, longitude]);

  // ร้าน
  const restRef = await db.collection('restaurants').add({
    owner_id, name, type, latitude, longitude, address,
    price_range, open_time, close_time, rating, description,
    image_url: '', is_new, geohash, created_at: FieldValue.serverTimestamp()
  });

  // เมนู
  for (const m of menus) {
    await db.collection('restaurants').doc(restRef.id).collection('menus').add({
      ...m,
      created_at: FieldValue.serverTimestamp()
    });
  }

  // โต๊ะ
  for (const t of tables) {
    await db.collection('restaurants').doc(restRef.id).collection('tables').add({
      ...t,
      updated_at: FieldValue.serverTimestamp()
    });
  }

  console.log('✅ Added:', name, '→', restRef.id);
  return restRef.id;
}

(async () => {
  try {
    await addRestaurantWithMenusTables({
      owner_id: 'owner-4',
      name: 'ครัวยามดึก',
      type: 'Thai/Isan',
      latitude: 14.88589217401599,
      longitude: 102.14282552799668,
      address: 'ปากช่อง, นครราชสีมา (โซนตลาดเก่า)',
      price_range: '$$',
      open_time: '18.00',
      close_time: '02.30',
      rating: 5.0,
      description: 'อาหารไทย-อีสาน วัตถุดิบสดใหม่ บรรยากาศกันเอง',
      is_new: true,
      menus: [
        { name: 'กะเพราเนื้อไข่ดาว', description: 'เผ็ดหอมกะเพราแท้', price: 85, calories: 650, is_popular: 1 },
        { name: 'ต้มยำกุ้งน้ำใส', description: 'เปรี้ยวเผ็ดกลมกล่อม', price: 120, calories: 220, is_popular: 1 },
        { name: 'ไข่เจียวหมูสับ', description: 'หนาฟู กรอบนอกนุ่มใน', price: 70, calories: 420, is_popular: 0 },
        { name: 'น้ำสมุนไพรอัญชันมะนาว', description: 'สดชื่น ไม่หวานจัด', price: 35, calories: 90, is_popular: 0 },
      ],
      tables: [
        { table_number: 1, status: 'available' },
        { table_number: 2, status: 'available' }
      ]
    });

    console.log('🎉 Done');
    process.exit(0);
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }
})();
