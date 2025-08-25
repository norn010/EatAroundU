// backend/db.firebase.js
import admin from 'firebase-admin';
import fs from 'fs';

const serviceAccount = JSON.parse(
  fs.readFileSync('./serviceAccountKey.json', 'utf8')
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export const db = admin.firestore();
// 👉 export ตัวที่ต้องใช้ให้ครบ
export const FieldValue = admin.firestore.FieldValue;
export const Timestamp = admin.firestore.Timestamp;
export const Admin = admin; // เผื่ออยากใช้ admin ตรง ๆ ในสคริปต์อื่น
