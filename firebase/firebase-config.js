// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA18SKorPrKkn7LmzadzZ4rxIa671Yq8Mc",
  authDomain: "quanlycaytrong-e0b15.firebaseapp.com",
  projectId: "quanlycaytrong-e0b15",
  storageBucket: "quanlycaytrong-e0b15.firebasestorage.app",
  messagingSenderId: "73794607095",
  appId: "1:73794607095:web:378e5b267146d735d2c0f2",
  measurementId: "G-RV00JGGY3S"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);