// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyACK3uMHjoVcwJcGGRE_RWD0yTmkPgVXZY",
  authDomain: "authenticator-703a5.firebaseapp.com",
  projectId: "authenticator-703a5",
  storageBucket: "authenticator-703a5.firebasestorage.app",
  messagingSenderId: "202276326603",
  appId: "1:202276326603:web:8786e9dd04bca9041e5f4e",
  measurementId: "G-QQVZB7EYNL"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const auth = getAuth(app);