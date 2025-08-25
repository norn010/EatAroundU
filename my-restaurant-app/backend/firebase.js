import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyATxyslPhRfwAmGdIhyJnBvLuXrmy_DMkM",
  authDomain: "eataroundu.firebaseapp.com",
  projectId: "eataroundu",
  storageBucket: "eataroundu.firebasestorage.app",
  messagingSenderId: "454655801815",
  appId: "1:454655801815:web:b8c130773b35018c84f392",
  measurementId: "G-SJM9RC8HT9"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const firestore = getFirestore(app);
export const analytics = getAnalytics(app);
