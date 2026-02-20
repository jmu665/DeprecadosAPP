import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyBinOYcfptLZg9Oytvo5fzPdXDdaBRdOtE",
    authDomain: "deprecadosapp.firebaseapp.com",
    projectId: "deprecadosapp",
    storageBucket: "deprecadosapp.firebasestorage.app",
    messagingSenderId: "689438490674",
    appId: "1:689438490674:web:39f1008de5baccde9d7c2b",
    measurementId: "G-TG202LK162"
};

const app = initializeApp(firebaseConfig);
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
export const db = getFirestore(app);
