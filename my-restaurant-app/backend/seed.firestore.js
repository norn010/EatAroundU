import { db, FieldValue } from './db.firebase.js';
import { geohashForLocation } from 'geofire-common';

// helper
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
  tables = [ { table_number: 1, status: 'available' } ],
}) {
  const geohash = geohashForLocation([latitude, longitude]);
  const restRef = await db.collection('restaurants').add({
    owner_id, name, type, latitude, longitude, address,
    price_range, open_time, close_time, rating, description,
    image_url: '', is_new, geohash, created_at: FieldValue.serverTimestamp()
  });

  for (const m of menus) {
    await db.collection('restaurants').doc(restRef.id).collection('menus').add({
      ...m,
      created_at: FieldValue.serverTimestamp()
    });
  }
  for (const t of tables) {
    await db.collection('restaurants').doc(restRef.id).collection('tables').add({
      ...t,
      updated_at: FieldValue.serverTimestamp()
    });
  }
  console.log('✅ Seeded:', name, '→', restRef.id);
}

(async () => {
  try {
    // ร้าน #1 (พิกัดที่คุณให้รอบก่อน)
    await addRestaurantWithMenusTables({
      owner_id: 'owner-1',
      name: 'ร้านเขาใหญ่วิวดี',
      type: 'Thai/Isan',
      latitude: 14.888272036508443,
      longitude: 102.15873613557329,
      address: 'ปากช่อง, นครราชสีมา',
      price_range: '$$',
      open_time: '09:00',
      close_time: '20:00',
      rating: 4.5,
      description: 'ร้านท้องถิ่นบรรยากาศดี ใกล้ธรรมชาติ',
      is_new: true,
      menus: [
        { name: 'ไก่ย่างสมุนไพร', description: 'ย่างเตาถ่าน หอมมาก', price: 120, calories: 450, is_popular: 1 },
        { name: 'ส้มตำไทย', description: 'รสกลมกล่อม', price: 60, calories: 180, is_popular: 1 },
      ],
      tables: [
        { table_number: 1, status: 'available' },
        { table_number: 2, status: 'available' },
      ],
    });

    // ร้าน #2 (พิกัดล่าสุดที่คุณให้)
    await addRestaurantWithMenusTables({
      owner_id: 'owner-2',
      name: 'ร้านครัวภูเขียว',
      type: 'Thai/Isan',
      latitude: 14.899283266628345,
      longitude: 102.13260069319136,
      address: 'ปากช่อง, นครราชสีมา',
      price_range: '$$',
      open_time: '10:00',
      close_time: '21:00',
      rating: 4.3,
      description: 'บรรยากาศอบอุ่น อาหารพื้นบ้าน',
      is_new: true,
      menus: [
        { name: 'ลาบหมูคั่ว', description: 'ลาบสูตรอีสานแท้ๆ', price: 80, calories: 300, is_popular: 1 },
        { name: 'แกงเห็ดรวม', description: 'แกงพื้นบ้านหอมสมุนไพร', price: 70, calories: 220, is_popular: 0 },
      ],
      tables: [
        { table_number: 1, status: 'available' }
      ],
    });

    console.log('🎉 Seeding done.');
    process.exit(0);
  } catch (e) {
    console.error('❌ Seed error:', e.message);
    process.exit(1);
  }
})();
