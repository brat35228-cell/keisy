/** Публічний клієнтський конфіг наявної гри (ключі Firebase і так видимі в браузері). */
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyB-QEsXUTEeoLqwM9kkJJ4HeZzc6m24_Ds",
  authDomain: "kejsy-63fd1.firebaseapp.com",
  projectId: "kejsy-63fd1",
  storageBucket: "kejsy-63fd1.firebasestorage.app",
  messagingSenderId: "969447100088",
  appId: "1:969447100088:web:7bfcb6d7a6700deff72e4d",
};

const SDK = [
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js",
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js",
];

function loadScript(src) {
  return new Promise((resolve) => {
    if ([...document.scripts].some((script) => script.src === src)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    const done = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(done, 5000);
    script.src = src;
    script.onload = done;
    script.onerror = done;
    document.head.appendChild(script);
  });
}

export async function ensureFirebase() {
  if (typeof firebase !== "undefined") return true;
  for (const src of SDK) await loadScript(src);
  return typeof firebase !== "undefined";
}
