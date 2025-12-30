// utils/crypto.js

// 1. Générer une nouvelle clé (pour un nouveau document)
export async function generateKey() {
  const key = await window.crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  )
  return key
}

// 2. Exporter la clé en base64 (pour la mettre dans l'URL après le #)
export async function exportKey(key) {
  const exported = await window.crypto.subtle.exportKey('raw', key)
  return btoa(String.fromCharCode(...new Uint8Array(exported)))
}

// 3. Importer la clé depuis l'URL (base64 -> CryptoKey)
export async function importKey(base64Key) {
  try {
    const raw = Uint8Array.from(atob(base64Key), (c) => c.charCodeAt(0))
    return await window.crypto.subtle.importKey(
      'raw',
      raw,
      { name: 'AES-GCM' },
      true,
      ['encrypt', 'decrypt']
    )
  } catch (e) {
    console.error("Clé invalide", e)
    return null
  }
}

// 4. CHIFFRER (Data -> IV + EncryptedData)
export async function encrypt(data, key) {
  const iv = window.crypto.getRandomValues(new Uint8Array(12)) // IV unique par message
  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    data
  )
  
  // On colle l'IV au début du message pour que le destinataire puisse le lire
  const result = new Uint8Array(iv.length + encrypted.byteLength)
  result.set(iv)
  result.set(new Uint8Array(encrypted), iv.length)
  return result
}

// 5. DÉCHIFFRER (IV + EncryptedData -> Data)
export async function decrypt(data, key) {
  // Data peut être ArrayBuffer ou Uint8Array
  const bytes = new Uint8Array(data)
  
  // Récupérer l'IV (les 12 premiers octets)
  const iv = bytes.slice(0, 12)
  const ciphertext = bytes.slice(12)

  try {
    return await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      ciphertext
    )
  } catch (e) {
    console.error("Échec du déchiffrement (mauvaise clé ou fichier corrompu)", e)
    throw e
  }
}