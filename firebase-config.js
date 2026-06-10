// Firebase Configuration - Candour RVNL Tracker
// Project: candour-rvnl-tracker
const firebaseConfig = {
    apiKey: "AIzaSyBoO7BNAsj4gi-9g2_z_P1S4QHjfHuMJ2Q",
    authDomain: "candour-rvnl-tracker.firebaseapp.com",
    projectId: "candour-rvnl-tracker",
    storageBucket: "candour-rvnl-tracker.firebasestorage.app",
    messagingSenderId: "478816161915",
    appId: "1:478816161915:web:f30572caad2846365b92de",
    measurementId: "G-6F1GBCRDY4"
};

// Initialize Firebase (using compat SDK loaded in index.html)
firebase.initializeApp(firebaseConfig);

// Firestore instance — used by app.js
const db = firebase.firestore();
