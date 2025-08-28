// backend/add-restaurants.bulk.js
// เพิ่ม 5 ร้าน ตัวอย่าง พร้อม 10 เมนู/ร้าน และโครงสร้างเมนูให้ค้นหาได้ (name_lc, restaurant_id, tags)

import { db, FieldValue } from "./db.firebase.js";
import { geohashForLocation } from "geofire-common";

/** helper: ทำให้เป็น lowercase ปลอดภัย */
const lc = (s) => (s || "").toString().trim().toLowerCase();

/** เพิ่มร้าน 1 ร้าน พร้อมเมนูและโต๊ะ */
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
  rating = 4.5,
  description = "",
  image_url = "",
  is_new = false,
  menus = [],
  tables = [{ table_number: 1, status: "available" }],
}) {
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    throw new Error(`Restaurant "${name}" ต้องกำหนดพิกัด latitude/longitude เป็นตัวเลข`);
  }

  const geohash = geohashForLocation([latitude, longitude]);

  // ---- ร้าน ----
  const restRef = await db.collection("restaurants").add({
    owner_id,
    name,
    type,
    latitude,
    longitude,
    geohash,
    address,
    price_range,
    open_time,
    close_time,
    rating,
    description,
    image_url,
    is_new,
    created_at: FieldValue.serverTimestamp(),
  });

  const restaurant_id = restRef.id;

  // ---- เมนู (เขียนให้ค้นหาได้ด้วย name_lc + restaurant_id + tags) ----
  const batchMenus = db.batch();
  const menusCol = db.collection("restaurants").doc(restaurant_id).collection("menus");

  menus.forEach((m) => {
    const ref = menusCol.doc();
    batchMenus.set(ref, {
      name: m.name,
      name_lc: lc(m.name),
      description: m.description || "",
      price: m.price ?? 0,
      calories: m.calories ?? 0,
      is_popular: m.is_popular ? 1 : 0,
      image_url: m.image_url || "",
      tags: (m.tags || []).map(lc),
      restaurant_id,
      created_at: FieldValue.serverTimestamp(),
    });
  });
  await batchMenus.commit();

  // ---- โต๊ะ ----
  const batchTables = db.batch();
  const tablesCol = db.collection("restaurants").doc(restaurant_id).collection("tables");

  (tables.length ? tables : [{ table_number: 1, status: "available" }]).forEach((t) => {
    const ref = tablesCol.doc();
    batchTables.set(ref, {
      table_number: t.table_number,
      status: t.status || "available",
      updated_at: FieldValue.serverTimestamp(),
    });
  });
  await batchTables.commit();

  console.log(`✅ Added restaurant: ${name} → ${restaurant_id}`);
  return restaurant_id;
}

/** ====== กำหนดข้อมูลชุดตัวอย่าง (ใส่พิกัดเอง) ====== */
const DATA = [
  {
    owner_id: "c7uKxv2GD5bqg8IOoYg9vse3Cfu2",
    name: "ครัวชานสวน",
    type: "Thai",
    latitude: 14.880143523810725,    // TODO: ใส่พิกัดจริง
    longitude: 102.11212548273343,  // TODO: ใส่พิกัดจริง
    address: "โซนชานเมือง",
    price_range: "$$",
    open_time: "10:00",
    close_time: "22:00",
    rating: 4.6,
    description: "อาหารไทยรสจัดจ้าน วัตถุดิบจากสวน",
    is_new: true,
    menus: [
      { name: "กะเพราเนื้อไข่ดาว", description: "เผ็ดหอมกะเพรา", price: 85, calories: 650, is_popular: 1, tags: ["ข้าว", "เผ็ด"] },
      { name: "ผัดไทยกุ้งสด", description: "หอมมัน", price: 95, calories: 620, is_popular: 1, tags: ["เส้น"] },
      { name: "แกงส้มชะอมกุ้ง", description: "เปรี้ยวหวานเค็มกลมกล่อม", price: 120, calories: 210, tags: ["แกง", "เผ็ด"] },
      { name: "ต้มยำกุ้งน้ำใส", description: "ซดคล่องคอ", price: 120, calories: 220, is_popular: 1, tags: ["แกง", "เผ็ด"] },
      { name: "ข้าวผัดกุ้ง", description: "หอมกระทะ", price: 75, calories: 560, tags: ["ข้าว"] },
      { name: "ไก่ทอดน้ำปลา", description: "กรอบนอกนุ่มใน", price: 89, calories: 480, tags: ["กับข้าว"] },
      { name: "คอหมูย่าง", description: "นุ่มหอม", price: 110, calories: 520, is_popular: 1, tags: ["ปิ้งย่าง"] },
      { name: "ยำทะเล", description: "แซ่บซี๊ด", price: 129, calories: 190, tags: ["ยำ", "เผ็ด"] },
      { name: "ปลาทอดน้ำปลา", description: "กินคู่ยำมะม่วง", price: 220, calories: 430, tags: ["ปลา"] },
      { name: "ชาเย็น", description: "หวานมันกำลังดี", price: 35, calories: 180, tags: ["เครื่องดื่ม"] },
    ],
  },
  {
    owner_id: "c7uKxv2GD5bqg8IOoYg9vse3Cfu2",
    name: "บ้านเส้นราเมง",
    type: "Japanese",
    latitude:  14.897562816857628, // TODO
    longitude: 102.17632683320977, // TODO
    address: "ถนนหลัก",
    price_range: "$$",
    open_time: "11:00",
    close_time: "21:00",
    rating: 4.7,
    description: "ราเมงซุปเข้ม เส้นทำเอง",
    menus: [
      { name: "ทงคตสึราเมง", description: "ซุปกระดูกหมูเข้ม", price: 189, calories: 690, is_popular: 1, tags: ["ราเมง"] },
      { name: "โชยุราเมง", description: "เค็มกำลังดี", price: 169, calories: 630, tags: ["ราเมง"] },
      { name: "ชาชูด้ง", description: "ข้าวหน้าหมูชาชู", price: 149, calories: 720, tags: ["ข้าว"] },
      { name: "ไก่คาราอะเกะ", description: "แป้งกรอบ", price: 99, calories: 520, is_popular: 1, tags: ["ของทอด"] },
      { name: "กิวด้ง", description: "ข้าวหน้าเนื้อ", price: 169, calories: 710, tags: ["ข้าว"] },
      { name: "ไข้ออนเซ็น", description: "ท็อปปิ้ง", price: 20, calories: 70, tags: ["ท็อปปิ้ง"] },
      { name: "เกี๊ยวซ่า", description: "ทอดไส้หมู", price: 89, calories: 360, tags: ["ของทอด"] },
      { name: "ยากิโซบะ", description: "เส้นผัดสไตล์ญี่ปุ่น", price: 139, calories: 600, tags: ["เส้น"] },
      { name: "ชาเขียวเย็น", description: "ไม่หวานมาก", price: 39, calories: 45, tags: ["เครื่องดื่ม"] },
      { name: "พุดดิ้งนมฮอกไกโด", description: "เดสเสิร์ต", price: 59, calories: 240, tags: ["ของหวาน"] },
    ],
  },
  {
    owner_id: "c7uKxv2GD5bqg8IOoYg9vse3Cfu2",
    name: "คาเฟ่ข้าวหอม",
    type: "Cafe",
    latitude: 14.90560839569548,    // TODO
    longitude: 102.15435417937708, // TODO
    address: "ใกล้สวนสาธารณะ",
    price_range: "$",
    open_time: "08:00",
    close_time: "18:00",
    rating: 4.5,
    description: "กาแฟคั่วกลาง เบเกอรี่โฮมเมด",
    menus: [
      { name: "ลาเต้เย็น", description: "นมหอม", price: 65, calories: 150, is_popular: 1, tags: ["กาแฟ"] },
      { name: "อเมริกาโน่", description: "ไม่หวาน", price: 55, calories: 10, tags: ["กาแฟ"] },
      { name: "คาปูชิโน่ร้อน", description: "ฟองนมหนา", price: 60, calories: 120, tags: ["กาแฟ"] },
      { name: "มอคค่าเย็น", description: "ช็อกโกแลตผสมนม", price: 70, calories: 220, tags: ["กาแฟ"] },
      { name: "ชานมไต้หวัน", description: "หอมชา", price: 65, calories: 260, tags: ["ชา"] },
      { name: "ครัวซองต์เนยสด", description: "อบใหม่", price: 55, calories: 310, is_popular: 1, tags: ["เบเกอรี่"] },
      { name: "บลูเบอร์รี่ชีสเค้ก", description: "เปรี้ยวหวาน", price: 95, calories: 420, tags: ["เค้ก"] },
      { name: "คุกกี้ช็อกชิพ", description: "โฮมเมด", price: 35, calories: 210, tags: ["เบเกอรี่"] },
      { name: "น้ำผึ้งมะนาวโซดา", description: "ซ่า สดชื่น", price: 65, calories: 110, tags: ["โซดา"] },
      { name: "ขนมปังสังขยา", description: "สังขยาใบเตย", price: 49, calories: 380, tags: ["ขนมปัง"] },
    ],
  },
  {
    owner_id: "c7uKxv2GD5bqg8IOoYg9vse3Cfu2",
    name: "อีสานย่าง & หม้อ",
    type: "Thai/Isan/BBQ",
    latitude: 14.92037166558354, // TODO
    longitude: 102.14740189405428, // TODO
    address: "ตลาดเย็น",
    price_range: "$$",
    open_time: "16:30",
    close_time: "23:30",
    rating: 4.8,
    description: "ปิ้งย่าง-แจ่วฮ้อน แซ่บอีหลี",
    menus: [
      { name: "เนื้อย่างจิ้มแจ่ว", description: "คัดส่วนมันแทรก", price: 180, calories: 520, is_popular: 1, tags: ["ปิ้งย่าง"] },
      { name: "หมูย่างจิ้มแจ่ว", description: "หมูคุโรบูตะ", price: 150, calories: 480, tags: ["ปิ้งย่าง"] },
      { name: "ต้มแซ่บกระดูกอ่อน", description: "เผ็ดจี๊ด", price: 129, calories: 190, tags: ["แกง", "เผ็ด"] },
      { name: "ส้มตำไทย", description: "รสจัดนัว", price: 65, calories: 150, is_popular: 1, tags: ["ส้มตำ"] },
      { name: "ส้มตำปูปลาร้า", description: "หอมปลาร้า", price: 75, calories: 160, tags: ["ส้มตำ"] },
      { name: "ไก่ย่างหนังกรอบ", description: "หอมถ่าน", price: 160, calories: 560, tags: ["ปิ้งย่าง"] },
      { name: "ลาบหมู", description: "ข้าวคั่วหอม", price: 99, calories: 250, tags: ["ลาบ", "เผ็ด"] },
      { name: "คอหมูย่าง", description: "นุ่มเด้ง", price: 140, calories: 520, tags: ["ปิ้งย่าง"] },
      { name: "ข้าวเหนียว", description: "นึ่งใหม่", price: 15, calories: 280, tags: ["ข้าว"] },
      { name: "โค้กกระป๋อง", description: "เย็นเฉียบ", price: 25, calories: 140, tags: ["เครื่องดื่ม"] },
    ],
  },
  {
    owner_id: "c7uKxv2GD5bqg8IOoYg9vse3Cfu2",
    name: "วีแกนกรีนเฮ้าส์",
    type: "Vegan/Healthy",
    latitude: 14.91614184359691,   // TODO
    longitude: 102.1692028865289, // TODO
    address: "ชุมชนสีเขียว",
    price_range: "$$",
    open_time: "10:00",
    close_time: "20:00",
    rating: 4.4,
    description: "เมนูพืชล้วน แคลอรี่กำกับ",
    menus: [
      { name: "สลัดควินัวอโวคาโด", description: "โปรตีนสูง", price: 159, calories: 380, is_popular: 1, tags: ["สลัด", "วีแกน"] },
      { name: "สปาเก็ตตี้เพสโต้เจ", description: "โหระพาหอม", price: 149, calories: 520, tags: ["เส้น", "วีแกน"] },
      { name: "บูด้าโบวล์", description: "ธัญพืช-ผักรวม", price: 169, calories: 450, tags: ["ข้าว", "วีแกน"] },
      { name: "ข้าวกล้องผัดเห็ดรวม", description: "ผัดน้ำมันมะกอก", price: 129, calories: 540, tags: ["ข้าว", "วีแกน"] },
      { name: "เต้าหู้ย่างซอสเทอริยากิ", description: "หอมหวาน", price: 119, calories: 390, tags: ["ปิ้งย่าง", "วีแกน"] },
      { name: "ซุปฟักทอง", description: "ครีมถั่ว", price: 99, calories: 210, tags: ["ซุป", "วีแกน"] },
      { name: "สลัดผลไม้โยเกิร์ตถั่ว", description: "สดชื่น", price: 129, calories: 260, tags: ["สลัด"] },
      { name: "สมูทตี้กรีนดีท็อกซ์", description: "ผักผลไม้รวม", price: 95, calories: 180, is_popular: 1, tags: ["เครื่องดื่ม"] },
      { name: "อัลมอนด์นมสด", description: "ไม่ใส่น้ำตาล", price: 85, calories: 130, tags: ["เครื่องดื่ม"] },
      { name: "บราวนี่วีแกน", description: "ใช้โกโก้แท้", price: 79, calories: 300, tags: ["ของหวาน", "วีแกน"] },
    ],
  },
];

/** main */
(async () => {
  try {
    for (const r of DATA) {
      await addRestaurantWithMenusTables(r);
    }
    console.log("🎉 Done");
    process.exit(0);
  } catch (e) {
    console.error("❌ Error:", e.stack || e.message);
    process.exit(1);
  }
})();
