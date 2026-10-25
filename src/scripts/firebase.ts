// The parts of the Firebase JavaScript SDK the site uses, loaded only when accounts are: sign-in (Google, or an email
// address and a password) and Firestore Lite, the small Firestore client without live updates or an offline cache,
// which the site does not need, since what you read is kept on your device first anyway.
export { initializeApp } from "firebase/app";
export {
  initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, browserPopupRedirectResolver, connectAuthEmulator,
  onAuthStateChanged, GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendPasswordResetEmail, sendEmailVerification, signOut, deleteUser, reauthenticateWithPopup, reauthenticateWithCredential,
  EmailAuthProvider,
} from "firebase/auth";
export {
  getFirestore, connectFirestoreEmulator, doc, getDoc, getDocs, setDoc, deleteDoc, writeBatch, runTransaction, collection,
  query, where, serverTimestamp, Timestamp,
} from "firebase/firestore/lite";
