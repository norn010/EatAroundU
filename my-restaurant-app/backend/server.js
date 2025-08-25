import express from 'express';
import cors from 'cors';
import { db, FieldValue, Timestamp, Admin } from './db.firebase.js';
import { geohashForLocation, geohashQueryBounds, distanceBetween } from 'geofire-common';

const app = express();
app.use(cors());
app.use(express.json());

/** สร้าง/อัปเดตร้าน (owner ใช้) */
app.post('/api/restaurants', async (req, res) => {
  try {
    const {
      owner_id, name, type, latitude, longitude, address,
      price_range, open_time, close_time, rating = 0,
      description = '', image_url = '', is_new = false
    } = req.body;

    const geohash = geohashForLocation([latitude, longitude]);

    const doc = await db.collection('restaurants').add({
      owner_id, name, type, latitude, longitude, address,
      price_range, open_time, close_time, rating, description, image_url,
      is_new, geohash, created_at: FieldValue.serverTimestamp()
    });

    res.json({ id: doc.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Nearby restaurants by radius (km) + log */
app.get('/api/restaurants/nearby', async (req, res) => {
  try {
    const user_id = req.query.user_id || 'anon';
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const radiusInKm = Number(req.query.radius || 2);

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({ error: 'lat/lng required' });
    }

    await db.collection('user_map_search_logs').add({
      user_id,
      user_latitude: lat,
      user_longitude: lng,
      radius_km: radiusInKm,
      created_at: FieldValue.serverTimestamp(),
    });

    const center = [lat, lng];
    const bounds = geohashQueryBounds(center, radiusInKm * 1000);
    const promises = bounds.map(([start, end]) =>
      db.collection('restaurants').orderBy('geohash').startAt(start).endAt(end).get()
    );
    const snaps = await Promise.all(promises);

    const matches = [];
    for (const snap of snaps) {
      for (const doc of snap.docs) {
        const r = doc.data();
        const d = distanceBetween([lat, lng], [r.latitude, r.longitude]) * 1000; // meters
        const km = d / 1000;
        if (km <= radiusInKm) matches.push({ id: doc.id, ...r, distance_km: km });
      }
    }
    const uniq = Object.values(Object.fromEntries(matches.map(m => [m.id, m])))
      .sort((a, b) => a.distance_km - b.distance_km);

    res.json(uniq);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Restaurant detail (menus + tables) */
app.get('/api/restaurants/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const doc = await db.collection('restaurants').doc(id).get();
    if (!doc.exists) return res.status(404).json({ error: 'not found' });

    const menusSnap = await db.collection('restaurants').doc(id).collection('menus')
      .orderBy('created_at', 'asc').get();
    const tablesSnap = await db.collection('restaurants').doc(id).collection('tables')
      .orderBy('table_number', 'asc').get();

    res.json({
      restaurant: { id: doc.id, ...doc.data() },
      menus: menusSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      tables: tablesSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** owner: add table */
app.post('/api/restaurants/:id/tables', async (req, res) => {
  try {
    const { table_number } = req.body;
    const ref = await db.collection('restaurants').doc(req.params.id).collection('tables').add({
      table_number,
      status: 'available',
      updated_at: FieldValue.serverTimestamp(),
    });
    res.json({ id: ref.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** owner: clear table */
app.patch('/api/tables/:restaurantId/:tableId/clear', async (req, res) => {
  try {
    const { restaurantId, tableId } = req.params;
    await db.collection('restaurants').doc(restaurantId).collection('tables').doc(tableId).update({
      status: 'available',
      updated_at: FieldValue.serverTimestamp(),
    });
    res.json({ updated: 1 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** user: book table */
app.post('/api/tables/:restaurantId/:tableId/book', async (req, res) => {
  try {
    const user_id = req.body.user_id || 'guest';
    const { restaurantId, tableId } = req.params;

    const tableRef = db.collection('restaurants').doc(restaurantId).collection('tables').doc(tableId);
    const tableDoc = await tableRef.get();
    if (!tableDoc.exists) return res.status(404).json({ error: 'table not found' });
    if (tableDoc.data().status !== 'available') return res.status(400).json({ error: 'table not available' });

    const bookingRef = await db.collection('table_bookings').add({
      restaurant_id: restaurantId,
      table_id: tableId,
      user_id,
      reserved_at: FieldValue.serverTimestamp(),
      created_at: FieldValue.serverTimestamp(),
    });

    await tableRef.update({
      status: 'reserved',
      updated_at: FieldValue.serverTimestamp(),
    });

    const countSnap = await db.collection('table_bookings').where('user_id', '==', user_id).get();
    if (countSnap.size === 1) {
      await db.collection('user_achievements').add({
        user_id,
        achievement_id: 'first_booking',
        date_earned: Timestamp.now(),
      });
    }

    res.json({ booking_id: bookingRef.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** my queue */
app.get('/api/my-queue', async (req, res) => {
  try {
    const user_id = req.query.user_id || 'guest';
    const snap = await db.collection('table_bookings')
      .where('user_id', '==', user_id)
      .orderBy('created_at', 'desc')
      .get();

    const rows = [];
    for (const d of snap.docs) {
      const b = d.data();
      const tableDoc = await db.collection('restaurants').doc(b.restaurant_id)
        .collection('tables').doc(b.table_id).get();
      const restDoc = await db.collection('restaurants').doc(b.restaurant_id).get();
      rows.push({
        booking_id: d.id,
        table_number: tableDoc.data()?.table_number,
        restaurant_name: restDoc.data()?.name,
        restaurant_id: b.restaurant_id,
        created_at: b.created_at?.toDate?.() || new Date(),
      });
    }
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(3000, () => console.log('✅ API (Firestore) http://localhost:3000'));
