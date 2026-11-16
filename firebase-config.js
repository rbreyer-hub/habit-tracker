/*
  Habit Tracker — Firebase config (same project as budget-planner-web / task-manager-web).
  Firestore path: users/{uid}/habitTracker/data
  Covered by the existing rule: match /users/{userId}/{document=**} { allow read, write: if request.auth.uid == userId; }
*/

const firebaseConfig = {
  apiKey:            "AIzaSyDwagvEPiQDLre2k6rku_pkwyKcBOxBnwE",
  authDomain:        "budget-planner-fb.firebaseapp.com",
  projectId:         "budget-planner-fb",
  storageBucket:     "budget-planner-fb.firebasestorage.app",
  messagingSenderId: "682449918354",
  appId:             "1:682449918354:web:c132bcec3976ce1988094b"
};

firebase.initializeApp(firebaseConfig);
