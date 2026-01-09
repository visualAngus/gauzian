type KeyType = "PUBLIC" | "PRIVATE";

// Correction : Suppression du générique <ArrayBuffer> qui cause souvent des erreurs
type U8 = Uint8Array & { buffer: ArrayBuffer };

export type KeyStoreConfig = {
  dbName: string;
  dbVersion: number;
  storeName: string;
};

export const DEFAULT_KEYSTORE: KeyStoreConfig = {
  dbName: "GauzianSecureDB",
  dbVersion: 2,
  storeName: "keys",
};

function assertClient(): void {
  if (typeof window === "undefined") {
    throw new Error("Crypto utilities are only available client-side");
  }
}

function normalizeU8(u8: Uint8Array): U8 {
  // Crée une copie propre pour s'assurer qu'on ne travaille pas sur une vue partielle (offset)
  const copy = new Uint8Array(u8.byteLength) as U8;
  copy.set(u8);
  return copy;
}

function toArrayBuffer(source: ArrayBuffer | ArrayBufferView): ArrayBuffer {
  if (source instanceof ArrayBuffer) return source.slice(0);
  const view = new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
  const out = new ArrayBuffer(view.byteLength);
  new Uint8Array(out).set(view);
  return out;
}

export function buffToB64(buff: ArrayBuffer | ArrayBufferView): string {
  assertClient();
  const arr = normalizeU8(new Uint8Array(toArrayBuffer(buff)) as U8);
  // Utilisation d'un reduce pour éviter l'erreur de pile sur les très gros buffers avec spread operator (...)
  let binary = "";
  const len = arr.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(arr[i]!);
  }
  return window.btoa(binary);
}

export function b64ToBuff(str: string): U8 {
  assertClient();

  // Validate base64 format
  if (!str || typeof str !== 'string') {
    throw new Error(`Invalid base64 string: input is not a string or is empty`);
  }

  // Check for invalid characters
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  if (!base64Regex.test(str)) {
    throw new Error(`Invalid base64 string: contains invalid characters. String: "${str.substring(0, 50)}${str.length > 50 ? '...' : ''}"`);
  }

  // Check length (base64 should be multiple of 4, except possibly with padding)
  if (str.length % 4 !== 0 && str.length % 4 !== 2 && str.length % 4 !== 3) {
    throw new Error(`Invalid base64 string: length ${str.length} is not valid for base64`);
  }

  try {
    const bin = window.atob(str);
    const out = new Uint8Array(bin.length) as U8;
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch (error) {
    const message = typeof error === "object" && error !== null && "message" in error
      ? (error as { message: string }).message
      : String(error);
    throw new Error(`Failed to decode base64 string: ${message}. String: "${str.substring(0, 50)}${str.length > 50 ? '...' : ''}"`);
  }
}

export function strToBuff(str: string): U8 {
  assertClient();
  return new TextEncoder().encode(str) as U8;
}

export function toPem(buffer: ArrayBuffer, type: KeyType): string {
  assertClient();
  const u8 = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < u8.length; i++) binary += String.fromCharCode(u8[i]!);
  const b64 = window.btoa(binary);
  const formatted = b64.match(/.{1,64}/g)?.join("\n") ?? b64;
  return `-----BEGIN ${type} KEY-----\n${formatted}\n-----END ${type} KEY-----`;
}

export function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN.*?-----/g, "")
    .replace(/-----END.*?-----/g, "")
    .replace(/\s/g, ""); // Enlève aussi les retours à la ligne
  return toArrayBuffer(b64ToBuff(b64));
}

export async function generateRsaKeyPairPem(): Promise<{
  publicKey: string;
  privateKey: string;
}> {
  assertClient();
  // Correction : Cast explicite en CryptoKeyPair car generateKey peut renvoyer CryptoKey simple
  const keyPair = (await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 4096,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  )) as CryptoKeyPair;

  const pubBuf = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);
  const privBuf = await window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey);

  return {
    publicKey: toPem(pubBuf as ArrayBuffer, "PUBLIC"),
    privateKey: toPem(privBuf as ArrayBuffer, "PRIVATE"),
  };
}

export async function generateRecordKey(privateKey: string): Promise<{
  encrypted_private_key_reco: string;
  recovery_key: string;
}> {
  assertClient();

  // Générer une clé AES de 256 bits pour chiffrer la clé privée
  const aesKey = await window.crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"]
  );
  
  // Exporter la clé AES brute
  const rawAesKey = await window.crypto.subtle.exportKey("raw", aesKey);
  
  // Générer un IV aléatoire pour AES-GCM
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  
  // Chiffrer la clé privée avec AES-GCM
  const privateKeyBuffer = strToBuff(privateKey);
  const encryptedPrivateKey = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    privateKeyBuffer
  );
  
  // Créer la clé de récupération (recovery_key) à partir de la clé AES
  const recoveryKey = buffToB64(rawAesKey);
  
  // Combiner IV et clé privée chiffrée
  const combined = new Uint8Array(iv.length + encryptedPrivateKey.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encryptedPrivateKey), iv.length);

  return {
    encrypted_private_key_reco: buffToB64(combined),
    recovery_key: recoveryKey,
  };
  
}

export async function decryptRecordKey(
  encrypted_private_key_reco: string,
  recovery_key: string,
): Promise<string> {
  assertClient();

  // Décoder la clé de récupération (clé AES)
  const rawAesKey = b64ToBuff(recovery_key);
  
  // Importer la clé AES
  const aesKey = await window.crypto.subtle.importKey(
    "raw",
    rawAesKey,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );
  
  // Décoder les données chiffrées (IV + clé privée chiffrée)
  const combined = b64ToBuff(encrypted_private_key_reco);
  const iv = combined.slice(0, 12);
  const encryptedPrivateKey = combined.slice(12);
  
  // Déchiffrer la clé privée
  const decryptedKeyBuffer = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    aesKey,
    encryptedPrivateKey
  );
  
  // Convertir le buffer en string (clé privée PEM)
  const decoder = new TextDecoder();
  return decoder.decode(decryptedKeyBuffer);
}

async function openDB(config: KeyStoreConfig = DEFAULT_KEYSTORE): Promise<IDBDatabase> {
  assertClient();
  return await new Promise((resolve, reject) => {
    const request = indexedDB.open(config.dbName, config.dbVersion);
    
    request.onupgradeneeded = (e: IDBVersionChangeEvent) => {
      // Correction : Typage explicite de l'event target
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(config.storeName)) {
        db.createObjectStore(config.storeName, { keyPath: "id" });
      }
    };
    
    request.onsuccess = (e: Event) => resolve((e.target as IDBOpenDBRequest).result);
    request.onerror = () => reject(new Error("Erreur ouverture DB"));
  });
}

async function idbGet<T>(key: string, config: KeyStoreConfig = DEFAULT_KEYSTORE): Promise<T | null> {
  const db = await openDB(config);
  const tx = db.transaction(config.storeName, "readonly");
  const request = tx.objectStore(config.storeName).get(key);
  
  return await new Promise((resolve, reject) => {
    request.onsuccess = () => resolve((request.result as T) ?? null);
    request.onerror = () => reject(new Error("Error retrieving from IndexedDB"));
  });
}

async function idbPut(value: unknown, config: KeyStoreConfig = DEFAULT_KEYSTORE): Promise<void> {
  const db = await openDB(config);
  const tx = db.transaction(config.storeName, "readwrite");
  const store = tx.objectStore(config.storeName);
  
  store.put(value);
  
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error("Error writing to IndexedDB"));
    tx.onabort = () => reject(new Error("IndexedDB transaction aborted"));
  });
}

export async function saveUserKeysToIndexedDb(
  privateKeyPem: string,
  publicKeyPem: string,
  config: KeyStoreConfig = DEFAULT_KEYSTORE
): Promise<void> {
  assertClient();
  const binaryKey = pemToArrayBuffer(privateKeyPem);
  const binaryPubKey = pemToArrayBuffer(publicKeyPem);

  const privateKey = await window.crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["decrypt"]
  );

  const publicKey = await window.crypto.subtle.importKey(
    "spki",
    binaryPubKey,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"]
  );

  await idbPut(
    {
      id: "user_private_key",
      key: privateKey,
      expires: Date.now() + 10 * 24 * 60 * 60 * 1000, // 10 jours
    },
    config
  );

  await idbPut(
    {
      id: "user_public_key",
      key: publicKey,
    },
    config
  );
}

export type KeyStatus = "none" | "expired" | "ready";

export async function getKeyStatus(config: KeyStoreConfig = DEFAULT_KEYSTORE): Promise<KeyStatus> {
  const record = await idbGet<{ id: string; key?: CryptoKey; expires?: number }>(
    "user_private_key",
    config
  );

  if (!record?.key) return "none";
  if (typeof record.expires === "number" && Date.now() > record.expires) return "expired";
  return "ready";
}

export async function getUserPublicKeyFromIndexedDb(
  config: KeyStoreConfig = DEFAULT_KEYSTORE
): Promise<CryptoKey> {
  const record = await idbGet<{ id: string; key?: CryptoKey }>("user_public_key", config);
  if (!record?.key) throw new Error("No public key found");
  return record.key;
}

export async function getUserPrivateKeyFromIndexedDb(
  config: KeyStoreConfig = DEFAULT_KEYSTORE
): Promise<CryptoKey> {
  const record = await idbGet<{ id: string; key?: CryptoKey }>("user_private_key", config);
  if (!record?.key) throw new Error("No private key found");
  return record.key;
}

export async function encryptWithStoredPublicKey(
  data: string,
  config: KeyStoreConfig = DEFAULT_KEYSTORE
): Promise<string> {
  assertClient();
  const publicKey = await getUserPublicKeyFromIndexedDb(config);
  const encodedData = new TextEncoder().encode(data) as U8;
  const encryptedData = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    publicKey,
    toArrayBuffer(encodedData) as BufferSource
  );
  return buffToB64(encryptedData);
}

export async function decryptWithStoredPrivateKey(
  cipherB64: string,
  config: KeyStoreConfig = DEFAULT_KEYSTORE
): Promise<string> {
  assertClient();
  const privateKey = await getUserPrivateKeyFromIndexedDb(config);
  const encryptedData = toArrayBuffer(b64ToBuff(cipherB64));
  const decryptedData = await window.crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    encryptedData as BufferSource
  );
  return new TextDecoder().decode(decryptedData);
}

export async function encryptPrivateKeyPemWithPassword(privateKeyPem: string, password: string): Promise<{
  encrypted_private_key: string;
  private_key_salt: string;
  iv: string;
}> {
  assertClient();
  const cryptoSubtle = window.crypto.subtle;

  // Correction: Initialisation propre des TypedArrays
  const private_key_salt = new Uint8Array(16) as U8;
  const iv = new Uint8Array(12) as U8;
  
  window.crypto.getRandomValues(private_key_salt);
  window.crypto.getRandomValues(iv);

  const passwordKey = await cryptoSubtle.importKey(
    "raw", 
    toArrayBuffer(strToBuff(password)) as BufferSource,
    "PBKDF2", 
    false, 
    ["deriveKey"]
  );

  const aesKey = await cryptoSubtle.deriveKey(
    {
      name: "PBKDF2",
      salt: toArrayBuffer(private_key_salt) as BufferSource,
      iterations: 100000,
      hash: "SHA-256",
    },
    passwordKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );

  const encryptedBuffer = await cryptoSubtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) as BufferSource },
    aesKey,
    toArrayBuffer(strToBuff(privateKeyPem)) as BufferSource
  );

  return {
    encrypted_private_key: buffToB64(encryptedBuffer),
    private_key_salt: buffToB64(private_key_salt),
    iv: buffToB64(iv),
  };
}

export async function decryptPrivateKeyPemWithPassword(params: {
  encrypted_private_key: string;
  private_key_salt: string;
  iv: string;
  password: string;
}): Promise<string> {
  assertClient();
  const cryptoSubtle = window.crypto.subtle;

  try {
    const saltBuf = b64ToBuff(params.private_key_salt);
    const ivBuf = b64ToBuff(params.iv);
    const encryptedBuf = b64ToBuff(params.encrypted_private_key);

  const passwordKey = await cryptoSubtle.importKey(
    "raw",
    toArrayBuffer(strToBuff(params.password)) as BufferSource,
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  const aesKey = await cryptoSubtle.deriveKey(
    {
      name: "PBKDF2",
      salt: toArrayBuffer(saltBuf) as BufferSource,
      iterations: 100000,
      hash: "SHA-256",
    },
    passwordKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );

  const decryptedBuf = await cryptoSubtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(ivBuf) as BufferSource },
    aesKey,
    toArrayBuffer(encryptedBuf) as BufferSource
  );
  return new TextDecoder().decode(decryptedBuf);
  } catch (error) {
    throw new Error("Failed to decrypt private key with provided password");
  }
}

export async function deleteKeyStore(config: KeyStoreConfig = DEFAULT_KEYSTORE): Promise<void> {
  assertClient();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(config.dbName);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(new Error("Failed to delete DB"));
    req.onblocked = () => resolve(); // Souvent bloqué si des onglets sont ouverts, on résout quand même pour ne pas crash
  });
}

export async function generateDataKey(): Promise<string> {
  assertClient();
  const aesKey = await window.crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"]
  );
  const rawAesKey = await window.crypto.subtle.exportKey("raw", aesKey);
  return buffToB64(rawAesKey);
}

// for metatdata for exemple
export async function encryptSimpleDataWithDataKey(
  data: string,
  dataKeyB64: string
): Promise<string> {
  assertClient();
  const dataKeyBuf = b64ToBuff(dataKeyB64);
  const aesKey = await window.crypto.subtle.importKey(
    "raw",
    toArrayBuffer(dataKeyBuf) as BufferSource,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  const iv = new Uint8Array(12);
  window.crypto.getRandomValues(iv);

  const encodedData = strToBuff(data);
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) as BufferSource },
    aesKey,
    toArrayBuffer(encodedData) as BufferSource
  );

  // Combiner IV et texte chiffré
  const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encryptedBuffer), iv.length);

  return buffToB64(combined);
}

export async function decryptSimpleDataWithDataKey(
  cipherTextB64: string,
  dataKeyB64: string
): Promise<string> {
  assertClient();
  const dataKeyBuf = b64ToBuff(dataKeyB64);
  const aesKey = await window.crypto.subtle.importKey(
    "raw",
    toArrayBuffer(dataKeyBuf) as BufferSource,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  const combined = b64ToBuff(cipherTextB64);
  const iv = combined.slice(0, 12);
  const cipherBuffer = combined.slice(12);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) as BufferSource },
    aesKey,
    toArrayBuffer(cipherBuffer) as BufferSource
  );

  return new TextDecoder().decode(decryptedBuffer);
}

// for import data like files
export async function encryptDataWithDataKey(
  data: string,
  dataKeyB64: string
): Promise<{ cipherText: string; iv: string }> {
  assertClient();
  const dataKeyBuf = b64ToBuff(dataKeyB64);
  const aesKey = await window.crypto.subtle.importKey(
    "raw",
    toArrayBuffer(dataKeyBuf) as BufferSource,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  const iv = new Uint8Array(12);
  window.crypto.getRandomValues(iv);

  const encodedData = strToBuff(data);
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) as BufferSource },
    aesKey,
    toArrayBuffer(encodedData) as BufferSource
  );

  return {
    cipherText: buffToB64(encryptedBuffer),
    iv: buffToB64(iv),
  };
}
  
export async function decryptDataWithDataKey(
  cipherTextB64: string,
  ivB64: string,
  dataKeyB64: string
): Promise<string> {
  assertClient();
  const dataKeyBuf = b64ToBuff(dataKeyB64);
  const aesKey = await window.crypto.subtle.importKey(
    "raw",
    toArrayBuffer(dataKeyBuf) as BufferSource,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  const iv = b64ToBuff(ivB64);
  const cipherBuffer = b64ToBuff(cipherTextB64);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) as BufferSource },
    aesKey,
    toArrayBuffer(cipherBuffer) as BufferSource
  );

  return new TextDecoder().decode(decryptedBuffer);
}