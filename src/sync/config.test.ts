import { describe, it, expect } from 'vitest'
import { parseFirebaseConfig } from './config'

const expected = { apiKey: 'AIzaSyEXAMPLE', authDomain: 'h2c-tracker.firebaseapp.com', projectId: 'h2c-tracker', storageBucket: 'h2c-tracker.firebasestorage.app', messagingSenderId: '123456', appId: '1:123456:web:abcdef' }

describe('parseFirebaseConfig', () => {
  it('reads pure JSON', () => {
    expect(parseFirebaseConfig(JSON.stringify(expected))).toEqual(expected)
  })
  it('reads the `const firebaseConfig = {…};` form with bare keys and trailing comma', () => {
    const s = `const firebaseConfig = {
  apiKey: "AIzaSyEXAMPLE",
  authDomain: "h2c-tracker.firebaseapp.com",
  projectId: "h2c-tracker",
  storageBucket: "h2c-tracker.firebasestorage.app",
  messagingSenderId: "123456",
  appId: "1:123456:web:abcdef",
};`
    expect(parseFirebaseConfig(s)).toEqual(expected)
  })
  it('reads the whole console snippet with imports and comments', () => {
    const s = `// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyEXAMPLE",
  authDomain: "h2c-tracker.firebaseapp.com",
  projectId: "h2c-tracker",
  storageBucket: "h2c-tracker.firebasestorage.app",
  messagingSenderId: "123456",
  appId: "1:123456:web:abcdef"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);`
    expect(parseFirebaseConfig(s)).toEqual(expected)
  })
  it('rejects junk', () => {
    expect(parseFirebaseConfig('hello { world }')).toBeNull()
    expect(parseFirebaseConfig('')).toBeNull()
  })
})
