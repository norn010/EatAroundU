// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

import { getAI, getGenerativeModel, GoogleAIBackend } from "firebase/ai";




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

// Initialize the Gemini Developer API backend service
// const ai = getAI(firebaseApp, { backend: new GoogleAIBackend() });

// // Create a `GenerativeModel` instance with a model that supports your use case
// const model = getGenerativeModel(ai, { model: "gemini-2.5-flash" });

// //  Wrap in an async function so you can use await
// async function run() {
//   // Provide a prompt that contains text
//   const prompt = "Write a story about a magic backpack."

//   // To generate text output, call generateContent with the text input
//   const result = await model.generateContent(prompt);

//   const response = result.response;
//   const text = response.text();
//   console.log(text);
// }

// run();


