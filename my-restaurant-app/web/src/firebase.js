// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";



const firebaseConfig = {
  apiKey: "AIzaSyATxyslPhRfwAmGdIhyJnBvLuXrmy_DMkM",
  authDomain: "eataroundu.firebaseapp.com",
  projectId: "eataroundu",
  storageBucket: "eataroundu.firebasestorage.app",
  messagingSenderId: "454655801815",
  appId: "1:454655801815:web:b8c130773b35018c84f392",
  measurementId: "G-SJM9RC8HT9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);