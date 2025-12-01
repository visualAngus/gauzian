// src/utils/storage.js

const DB_NAME = "GauzianDB";
const STORE_NAME = "keyStore";

// Ouvrir la base de données
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject("Erreur ouverture DB");
    });
}

// Sauvegarder la CryptoKey (Ne la transforme pas en string !)
export async function saveKeyToStorage(key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        // On stocke la clé sous le nom 'masterKey'
        const request = store.put(key, "masterKey");
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject("Erreur sauvegarde clé");
    });
}

// Récupérer la CryptoKey
export async function getKeyFromStorage() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const request = store.get("masterKey");
        
        request.onsuccess = () => resolve(request.result); // Renvoie undefined si vide
        request.onerror = () => reject("Erreur lecture clé");
    });
}

// Supprimer la clé (Logout)
export async function clearKeyStorage() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.delete("masterKey");
        tx.oncomplete = () => resolve();
    });
}