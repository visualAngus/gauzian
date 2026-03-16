import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  strToBuff,
  buffToB64,
  b64ToBuff,
  toPem,
  pemToArrayBuffer,
  generateDataKey,
  encryptSimpleDataWithDataKey,
  decryptSimpleDataWithDataKey,
  encryptPrivateKeyPemWithPassword,
  decryptPrivateKeyPemWithPassword,
  encryptDataWithDataKey,
  decryptDataWithDataKey,
  encryptDataWithDataKeyRaw,
  decryptDataWithDataKeyRaw,
  generateRecordKey,
  decryptRecordKey,
  saveUserKeysToIndexedDb,
  getKeyStatus,
  getUserPublicKeyFromIndexedDb,
  getUserPrivateKeyFromIndexedDb,
  clearAllKeys,
  encryptWithStoredPublicKey,
  decryptWithStoredPrivateKey,
  importPublicKeyFromPem,
  encryptWithPublicKey,
  deleteKeyStore,
} from '~/utils/crypto'

type MemoryStore = Map<string, unknown>

function createIndexedDbMock(options?: { clearFails?: boolean; deleteMode?: 'success' | 'blocked' }) {
  const stores = new Map<string, MemoryStore>()

  const getStore = (storeName: string): MemoryStore => {
    if (!stores.has(storeName)) {
      stores.set(storeName, new Map())
    }
    return stores.get(storeName)!
  }

  const indexedDBMock = {
    open: vi.fn((_dbName: string, _version: number) => {
      const request: Record<string, (() => void) | undefined> & { result?: unknown } = {}

      setTimeout(() => {
        const db = {
          objectStoreNames: {
            contains: (name: string) => stores.has(name),
          },
          createObjectStore: (name: string) => {
            getStore(name)
            return {}
          },
          transaction: (storeNameOrNames: string | string[], _mode: string) => {
            const storeName = Array.isArray(storeNameOrNames)
              ? storeNameOrNames[0]!
              : storeNameOrNames
            const store = getStore(storeName)
            const tx: Record<string, (() => void) | undefined> & {
              objectStore?: () => {
                get: (key: string) => Record<string, (() => void) | undefined> & { result?: unknown }
                put: (value: { id: string }) => void
                clear: () => Record<string, (() => void) | undefined>
              }
            } = {}

            const objectStore = {
              get: (key: string) => {
                const req: Record<string, (() => void) | undefined> & { result?: unknown } = {}
                setTimeout(() => {
                  req.result = store.get(key)
                  req.onsuccess?.()
                }, 0)
                return req
              },
              put: (value: { id: string }) => {
                store.set(value.id, value)
                setTimeout(() => tx.oncomplete?.(), 0)
              },
              clear: () => {
                const req: Record<string, (() => void) | undefined> = {}
                setTimeout(() => {
                  if (options?.clearFails) {
                    req.onerror?.()
                    tx.onerror?.()
                    return
                  }
                  store.clear()
                  req.onsuccess?.()
                }, 0)
                return req
              },
            }

            tx.objectStore = () => objectStore
            return tx
          },
        }

        request.result = db
        request.onupgradeneeded?.({ target: request } as unknown as IDBVersionChangeEvent)
        request.onsuccess?.({ target: request } as unknown as Event)
      }, 0)

      return request
    }),
    deleteDatabase: vi.fn((_dbName: string) => {
      const req: Record<string, (() => void) | undefined> = {}
      setTimeout(() => {
        if (options?.deleteMode === 'blocked') {
          req.onblocked?.()
          return
        }
        req.onsuccess?.()
      }, 0)
      return req
    }),
  }

  return { indexedDBMock, stores }
}

// ─────────────────────────────────────────────────────────────────────────
// strToBuff : convertit une string en Uint8Array (bytes UTF-8)
// ─────────────────────────────────────────────────────────────────────────
describe('strToBuff', () => {
  it('encode une chaîne ASCII en Uint8Array', () => {
    const result = strToBuff('hello')
    expect(result).toBeInstanceOf(Uint8Array)
    expect(result.length).toBe(5)
    expect(result[0]).toBe(104) // 'h' = 104 en ASCII
  })

  it('encode correctement les caractères UTF-8 multi-octets', () => {
    // 'é' prend 2 octets en UTF-8
    const result = strToBuff('é')
    expect(result.length).toBe(2)
  })

  it('retourne un Uint8Array vide pour une chaîne vide', () => {
    expect(strToBuff('').length).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────
// buffToB64 / b64ToBuff : encodage/décodage base64
// ─────────────────────────────────────────────────────────────────────────
describe('buffToB64 et b64ToBuff', () => {
  it('round-trip : encode puis décode donne la même valeur', () => {
    const original = new Uint8Array([72, 101, 108, 108, 111]) // "Hello"
    const encoded = buffToB64(original)
    const decoded = b64ToBuff(encoded)
    expect(Array.from(decoded)).toEqual(Array.from(original))
  })

  it('buffToB64 retourne une chaîne base64 valide', () => {
    const data = new Uint8Array([0, 1, 2, 255])
    const result = buffToB64(data)
    expect(typeof result).toBe('string')
    expect(result).toMatch(/^[A-Za-z0-9+/]+=*$/)
  })

  it('deux buffers différents donnent des base64 différents', () => {
    const a = buffToB64(new Uint8Array([1, 2, 3]))
    const b = buffToB64(new Uint8Array([4, 5, 6]))
    expect(a).not.toBe(b)
  })
})

// ─────────────────────────────────────────────────────────────────────────
// toPem / pemToArrayBuffer : conversion format PEM
// ─────────────────────────────────────────────────────────────────────────
describe('toPem et pemToArrayBuffer', () => {
  it('toPem entoure les données avec les bons en-têtes PEM', () => {
    const data = new Uint8Array([1, 2, 3, 4, 5])
    const pem = toPem(data.buffer, 'PUBLIC')
    expect(pem).toContain('-----BEGIN PUBLIC KEY-----')
    expect(pem).toContain('-----END PUBLIC KEY-----')
  })

  it('round-trip : toPem puis pemToArrayBuffer donne le même buffer', () => {
    const original = new Uint8Array([10, 20, 30, 40, 50, 100, 200, 255])
    const pem = toPem(original.buffer, 'PRIVATE')
    const recovered = pemToArrayBuffer(pem)
    expect(Array.from(new Uint8Array(recovered))).toEqual(Array.from(original))
  })
})

// ─────────────────────────────────────────────────────────────────────────
// generateDataKey : génère une clé AES-256 (32 bytes) encodée en base64
// ─────────────────────────────────────────────────────────────────────────
describe('generateDataKey', () => {
  it('retourne une chaîne base64 de 44 caractères (32 bytes)', async () => {
    const key = await generateDataKey()
    expect(typeof key).toBe('string')
    expect(key.length).toBe(44) // 32 bytes en base64 = 44 chars avec padding
    expect(key).toMatch(/^[A-Za-z0-9+/]+=*$/)
  })

  it('génère des clés différentes à chaque appel (aléatoire)', async () => {
    const key1 = await generateDataKey()
    const key2 = await generateDataKey()
    expect(key1).not.toBe(key2)
  })
})

// ─────────────────────────────────────────────────────────────────────────
// encryptSimpleDataWithDataKey / decryptSimpleDataWithDataKey
// Chiffrement AES-256-GCM de métadonnées (strings)
// ─────────────────────────────────────────────────────────────────────────
describe('encryptSimpleDataWithDataKey / decryptSimpleDataWithDataKey', () => {
  // beforeEach : génère une clé fraîche avant chaque test de ce groupe
  let dataKey: string

  beforeEach(async () => {
    dataKey = await generateDataKey()
  })

  it('round-trip : chiffre puis déchiffre donne le texte original', async () => {
    const original = 'Réunion client à 14h30 — confidentiel'
    const cipher = await encryptSimpleDataWithDataKey(original, dataKey)
    const decrypted = await decryptSimpleDataWithDataKey(cipher, dataKey)
    expect(decrypted).toBe(original)
  })

  it('round-trip avec une chaîne vide', async () => {
    const cipher = await encryptSimpleDataWithDataKey('', dataKey)
    const decrypted = await decryptSimpleDataWithDataKey(cipher, dataKey)
    expect(decrypted).toBe('')
  })

  it('round-trip avec caractères spéciaux et emoji', async () => {
    const original = 'Données: €£¥ 🔐 日本語'
    const cipher = await encryptSimpleDataWithDataKey(original, dataKey)
    const decrypted = await decryptSimpleDataWithDataKey(cipher, dataKey)
    expect(decrypted).toBe(original)
  })

  it('le texte chiffré est différent du texte original', async () => {
    const cipher = await encryptSimpleDataWithDataKey('hello', dataKey)
    expect(cipher).not.toBe('hello')
  })

  it('deux chiffrements du même texte donnent des résultats différents (IV aléatoire)', async () => {
    const cipher1 = await encryptSimpleDataWithDataKey('hello', dataKey)
    const cipher2 = await encryptSimpleDataWithDataKey('hello', dataKey)
    expect(cipher1).not.toBe(cipher2)
  })

  it('lève une erreur si on déchiffre avec la mauvaise clé', async () => {
    const cipher = await encryptSimpleDataWithDataKey('secret', dataKey)
    const wrongKey = await generateDataKey()
    await expect(decryptSimpleDataWithDataKey(cipher, wrongKey)).rejects.toThrow()
  })
})

// ─────────────────────────────────────────────────────────────────────────
// encryptPrivateKeyPemWithPassword / decryptPrivateKeyPemWithPassword
// PBKDF2 (310k itérations) + AES-256-GCM — TESTS LENTS (~2-4s)
// ─────────────────────────────────────────────────────────────────────────
describe('encryptPrivateKeyPemWithPassword / decryptPrivateKeyPemWithPassword', () => {
  const fakePem = '-----BEGIN PRIVATE KEY-----\nfakebase64data==\n-----END PRIVATE KEY-----'

  it('round-trip avec le bon mot de passe', async () => {
    const password = 'mot_de_passe_tres_securise_123!'
    const encrypted = await encryptPrivateKeyPemWithPassword(fakePem, password)

    // Le résultat contient 3 champs
    expect(typeof encrypted.encrypted_private_key).toBe('string')
    expect(typeof encrypted.private_key_salt).toBe('string')
    expect(typeof encrypted.iv).toBe('string')

    const decrypted = await decryptPrivateKeyPemWithPassword({ ...encrypted, password })
    expect(decrypted).toBe(fakePem)
  }, 15000) // timeout 15s pour PBKDF2

  it('lève une erreur avec un mauvais mot de passe', async () => {
    const encrypted = await encryptPrivateKeyPemWithPassword(fakePem, 'correct')
    await expect(
      decryptPrivateKeyPemWithPassword({ ...encrypted, password: 'incorrect' }),
    ).rejects.toThrow()
  }, 15000)
})


describe('crypto utils - fonctions de base', () => {

  it("Verifie que strToBuff convertit correctement une string en Uint8Array", () => {
    const str = "Hello, Gauzian!"
    const buff = strToBuff(str)
    expect(buff).toBeInstanceOf(Uint8Array)
    expect(buff.length).toBe(str.length)
    // Vérifie que les codes UTF-8 correspondent
    for (let i = 0; i < str.length; i++) {
      expect(buff[i]).toBe(str.charCodeAt(i))
    }
  })

  it("Verifier la verification du client assertClient", () => {
    // sont dans les suites dédiées ci-dessus.
    expect(typeof strToBuff).toBe("function")
    expect(typeof buffToB64).toBe("function")
    expect(typeof b64ToBuff).toBe("function")
    expect(typeof toPem).toBe("function")
    expect(typeof pemToArrayBuffer).toBe("function")
    expect(typeof generateDataKey).toBe("function")
    expect(typeof encryptSimpleDataWithDataKey).toBe("function")
    expect(typeof decryptSimpleDataWithDataKey).toBe("function")
    expect(typeof encryptPrivateKeyPemWithPassword).toBe("function")
    expect(typeof decryptPrivateKeyPemWithPassword).toBe("function")
  })
})

// ─────────────────────────────────────────────────────────────────────────
// b64ToBuff : chemins d'erreur
// ─────────────────────────────────────────────────────────────────────────
describe('b64ToBuff - chemins d\'erreur', () => {
  it('lève une erreur pour une chaîne avec des caractères invalides', () => {
    expect(() => b64ToBuff('abc!def=')).toThrow(/Invalid base64 string/)
  })

  it('lève une erreur pour une longueur invalide (pas multiple de 4)', () => {
    // "abc" (3 chars) n'est pas un multiple de 4
    expect(() => b64ToBuff('abc')).toThrow(/Invalid base64 string/)
  })

  it('accepte une chaîne base64 avec des espaces/retours à la ligne (les ignore)', () => {
    // "SGVsbG8=" = "Hello" en base64
    const withNewlines = 'SGVs\nbG8='
    const result = b64ToBuff(withNewlines)
    expect(result).toBeInstanceOf(Uint8Array)
    expect(result.length).toBe(5)
  })

  it('lève une erreur pour une entrée non-string (null-like via empty)', () => {
    // Une chaîne vide doit lever une erreur
    expect(() => b64ToBuff('')).toThrow()
  })
})

// ─────────────────────────────────────────────────────────────────────────
// encryptDataWithDataKey / decryptDataWithDataKey
// Chiffrement AES-256-GCM pour fichiers (string → base64 + iv séparé)
// ─────────────────────────────────────────────────────────────────────────
describe('encryptDataWithDataKey / decryptDataWithDataKey', () => {
  let dataKey: string

  beforeEach(async () => {
    dataKey = await generateDataKey()
  })

  it('retourne un objet { cipherText, iv }', async () => {
    const result = await encryptDataWithDataKey('test content', dataKey)
    expect(typeof result.cipherText).toBe('string')
    expect(typeof result.iv).toBe('string')
    expect(result.cipherText.length).toBeGreaterThan(0)
    expect(result.iv.length).toBeGreaterThan(0)
  })

  it('round-trip string : chiffre puis déchiffre donne les mêmes octets', async () => {
    const original = 'Contenu secret du fichier'
    const { cipherText, iv } = await encryptDataWithDataKey(original, dataKey)
    const decrypted = await decryptDataWithDataKey(cipherText, iv, dataKey)
    expect(decrypted).toBeInstanceOf(Uint8Array)
    const text = new TextDecoder().decode(decrypted)
    expect(text).toBe(original)
  })

  it('round-trip ArrayBuffer : chiffre un buffer puis déchiffre', async () => {
    const originalBytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])
    const { cipherText, iv } = await encryptDataWithDataKey(originalBytes.buffer, dataKey)
    const decrypted = await decryptDataWithDataKey(cipherText, iv, dataKey)
    expect(Array.from(decrypted)).toEqual(Array.from(originalBytes))
  })

  it('round-trip Blob : chiffre un Blob puis déchiffre', async () => {
    const content = 'fichier texte'
    const blob = new Blob([content], { type: 'text/plain' })
    const { cipherText, iv } = await encryptDataWithDataKey(blob, dataKey)
    const decrypted = await decryptDataWithDataKey(cipherText, iv, dataKey)
    const text = new TextDecoder().decode(decrypted)
    expect(text).toBe(content)
  })

  it('l\'IV est différent à chaque chiffrement (aléatoire)', async () => {
    const { iv: iv1 } = await encryptDataWithDataKey('data', dataKey)
    const { iv: iv2 } = await encryptDataWithDataKey('data', dataKey)
    expect(iv1).not.toBe(iv2)
  })

  it('lève une erreur si on déchiffre avec le mauvais IV', async () => {
    const { cipherText } = await encryptDataWithDataKey('secret', dataKey)
    const wrongIv = buffToB64(window.crypto.getRandomValues(new Uint8Array(12)))
    await expect(decryptDataWithDataKey(cipherText, wrongIv, dataKey)).rejects.toThrow()
  })

  it('lève une erreur si on déchiffre avec la mauvaise clé', async () => {
    const { cipherText, iv } = await encryptDataWithDataKey('secret', dataKey)
    const wrongKey = await generateDataKey()
    await expect(decryptDataWithDataKey(cipherText, iv, wrongKey)).rejects.toThrow()
  })
})

// ─────────────────────────────────────────────────────────────────────────
// encryptDataWithDataKeyRaw / decryptDataWithDataKeyRaw
// Version binaire (Uint8Array) pour les chunks upload/download
// ─────────────────────────────────────────────────────────────────────────
describe('encryptDataWithDataKeyRaw / decryptDataWithDataKeyRaw', () => {
  let dataKey: string

  beforeEach(async () => {
    dataKey = await generateDataKey()
  })

  it('retourne un objet { cipherBytes: Uint8Array, iv: string }', async () => {
    const result = await encryptDataWithDataKeyRaw('raw content', dataKey)
    expect(result.cipherBytes).toBeInstanceOf(Uint8Array)
    expect(typeof result.iv).toBe('string')
    expect(result.cipherBytes.length).toBeGreaterThan(0)
  })

  it('round-trip string → raw bytes → decrypt donne le contenu original', async () => {
    const original = 'données binaires test'
    const { cipherBytes, iv } = await encryptDataWithDataKeyRaw(original, dataKey)
    const decrypted = await decryptDataWithDataKeyRaw(cipherBytes, iv, dataKey)
    expect(new TextDecoder().decode(decrypted)).toBe(original)
  })

  it('round-trip ArrayBuffer → raw bytes → decrypt', async () => {
    const originalBytes = new Uint8Array([10, 20, 30, 40, 50])
    const { cipherBytes, iv } = await encryptDataWithDataKeyRaw(originalBytes.buffer, dataKey)
    const decrypted = await decryptDataWithDataKeyRaw(cipherBytes, iv, dataKey)
    expect(Array.from(decrypted)).toEqual(Array.from(originalBytes))
  })

  it('round-trip Blob → raw bytes → decrypt', async () => {
    const content = 'blob content'
    const blob = new Blob([content])
    const { cipherBytes, iv } = await encryptDataWithDataKeyRaw(blob, dataKey)
    const decrypted = await decryptDataWithDataKeyRaw(cipherBytes, iv, dataKey)
    expect(new TextDecoder().decode(decrypted)).toBe(content)
  })

  it('accepte un ArrayBuffer (pas Uint8Array) pour decryptDataWithDataKeyRaw', async () => {
    const original = 'test ab'
    const { cipherBytes, iv } = await encryptDataWithDataKeyRaw(original, dataKey)
    // Passer un ArrayBuffer au lieu de Uint8Array
    const decrypted = await decryptDataWithDataKeyRaw(cipherBytes.buffer, iv, dataKey)
    expect(new TextDecoder().decode(decrypted)).toBe(original)
  })

  it('lève une erreur avec la mauvaise clé', async () => {
    const { cipherBytes, iv } = await encryptDataWithDataKeyRaw('secret', dataKey)
    const wrongKey = await generateDataKey()
    await expect(decryptDataWithDataKeyRaw(cipherBytes, iv, wrongKey)).rejects.toThrow()
  })
})

// ─────────────────────────────────────────────────────────────────────────
// generateRecordKey / decryptRecordKey
// Chiffrement de la clé privée avec une clé AES pour la récupération
// ─────────────────────────────────────────────────────────────────────────
describe('generateRecordKey / decryptRecordKey', () => {
  const fakePrivateKeyPem = '-----BEGIN PRIVATE KEY-----\nfakebase64content==\n-----END PRIVATE KEY-----'

  it('retourne encrypted_private_key_reco et recovery_key (strings base64)', async () => {
    const result = await generateRecordKey(fakePrivateKeyPem)
    expect(typeof result.encrypted_private_key_reco).toBe('string')
    expect(typeof result.recovery_key).toBe('string')
    expect(result.encrypted_private_key_reco.length).toBeGreaterThan(0)
    expect(result.recovery_key.length).toBeGreaterThan(0)
  })

  it('round-trip : generateRecordKey puis decryptRecordKey donne la clé privée originale', async () => {
    const { encrypted_private_key_reco, recovery_key } = await generateRecordKey(fakePrivateKeyPem)
    const recovered = await decryptRecordKey(encrypted_private_key_reco, recovery_key)
    expect(recovered).toBe(fakePrivateKeyPem)
  })

  it('deux appels génèrent des clés différentes (IV aléatoire)', async () => {
    const r1 = await generateRecordKey(fakePrivateKeyPem)
    const r2 = await generateRecordKey(fakePrivateKeyPem)
    expect(r1.encrypted_private_key_reco).not.toBe(r2.encrypted_private_key_reco)
    expect(r1.recovery_key).not.toBe(r2.recovery_key)
  })

  it('lève une erreur si la recovery_key est invalide', async () => {
    const { encrypted_private_key_reco } = await generateRecordKey(fakePrivateKeyPem)
    const wrongKey = await generateDataKey() // clé AES aléatoire
    await expect(decryptRecordKey(encrypted_private_key_reco, wrongKey)).rejects.toThrow()
  })
})

// ─────────────────────────────────────────────────────────────────────────
// buffToB64 : cas supplémentaires
// ─────────────────────────────────────────────────────────────────────────
describe('buffToB64 - cas supplémentaires', () => {
  it('encode un buffer vide en chaîne vide', () => {
    const result = buffToB64(new Uint8Array(0))
    expect(result).toBe('')
  })

  it('accepte un ArrayBuffer (pas ArrayBufferView)', () => {
    const ab = new Uint8Array([65, 66, 67]).buffer // "ABC"
    const result = buffToB64(ab)
    expect(typeof result).toBe('string')
    expect(result).toBe('QUJD')
  })

  it('encode un Uint8Array avec offset (vue partielle) correctement', () => {
    // Crée un buffer avec des données, puis une vue décalée
    const full = new Uint8Array([0, 72, 101, 108, 108, 111, 0]) // "Hello" au milieu
    const view = full.subarray(1, 6) // Vue sur "Hello" uniquement
    const result = buffToB64(view)
    const expected = buffToB64(new Uint8Array([72, 101, 108, 108, 111]))
    expect(result).toBe(expected)
  })
})

// ─────────────────────────────────────────────────────────────────────────
// pemToArrayBuffer : cas supplémentaires
// ─────────────────────────────────────────────────────────────────────────
describe('pemToArrayBuffer - cas supplémentaires', () => {
  it('ignore correctement les en-têtes PUBLIC KEY', () => {
    const data = new Uint8Array([42, 43, 44, 45])
    const pem = toPem(data.buffer, 'PUBLIC')
    const recovered = pemToArrayBuffer(pem)
    expect(Array.from(new Uint8Array(recovered))).toEqual(Array.from(data))
  })

  it('gère les PEM avec des lignes de 64 caractères (formatées)', () => {
    // Données de plus de 48 bytes pour forcer le découpage en lignes de 64 chars base64
    const data = new Uint8Array(60).fill(123)
    const pem = toPem(data.buffer, 'PRIVATE')
    // Vérifie que le PEM contient des retours à la ligne dans le body
    const bodyLines = pem.split('\n').slice(1, -1) // Enlève BEGIN/END
    expect(bodyLines.length).toBeGreaterThan(1)
    // Round-trip
    const recovered = pemToArrayBuffer(pem)
    expect(Array.from(new Uint8Array(recovered))).toEqual(Array.from(data))
  })
})

describe('crypto key store (IndexedDB) et helpers avancés', () => {
  const config = {
    dbName: 'test_key_store',
    dbVersion: 1,
    storeName: 'keys',
  }

  let originalIndexedDb: IDBFactory | undefined

  beforeEach(() => {
    originalIndexedDb = globalThis.indexedDB
    vi.restoreAllMocks()
  })

  afterEach(() => {
    if (originalIndexedDb) {
      // @ts-expect-error test override
      globalThis.indexedDB = originalIndexedDb
    }
    vi.restoreAllMocks()
  })

  it('saveUserKeysToIndexedDb puis getKeyStatus retourne ready', async () => {
    const { indexedDBMock } = createIndexedDbMock()
    // @ts-expect-error test override
    globalThis.indexedDB = indexedDBMock

    const privateKey = { type: 'private' } as CryptoKey
    const publicKey = { type: 'public' } as CryptoKey

    vi.spyOn(window.crypto.subtle, 'importKey')
      .mockResolvedValueOnce(privateKey)
      .mockResolvedValueOnce(publicKey)

    const privatePem = toPem(new Uint8Array([1, 2, 3, 4]).buffer, 'PRIVATE')
    const publicPem = toPem(new Uint8Array([5, 6, 7, 8]).buffer, 'PUBLIC')

    await saveUserKeysToIndexedDb(privatePem, publicPem, config)
    await expect(getKeyStatus(config)).resolves.toBe('ready')
  })

  it('getKeyStatus retourne expired quand la clé est expirée', async () => {
    const { indexedDBMock, stores } = createIndexedDbMock()
    // @ts-expect-error test override
    globalThis.indexedDB = indexedDBMock

    const privateKey = { type: 'private' } as CryptoKey
    const publicKey = { type: 'public' } as CryptoKey
    vi.spyOn(window.crypto.subtle, 'importKey')
      .mockResolvedValueOnce(privateKey)
      .mockResolvedValueOnce(publicKey)

    await saveUserKeysToIndexedDb(
      toPem(new Uint8Array([1, 1, 1, 1]).buffer, 'PRIVATE'),
      toPem(new Uint8Array([2, 2, 2, 2]).buffer, 'PUBLIC'),
      config,
    )

    const keysStore = stores.get('keys')!
    keysStore.set('user_private_key', {
      id: 'user_private_key',
      key: privateKey,
      expires: Date.now() - 1000,
    })

    await expect(getKeyStatus(config)).resolves.toBe('expired')
  })

  it('getKeyStatus retourne none quand aucune clé privée n existe', async () => {
    const { indexedDBMock } = createIndexedDbMock()
    // @ts-expect-error test override
    globalThis.indexedDB = indexedDBMock

    await expect(getKeyStatus(config)).resolves.toBe('none')
  })

  it('getUserPublicKeyFromIndexedDb et getUserPrivateKeyFromIndexedDb lèvent si absentes', async () => {
    const { indexedDBMock } = createIndexedDbMock()
    // @ts-expect-error test override
    globalThis.indexedDB = indexedDBMock

    await expect(getUserPublicKeyFromIndexedDb(config)).rejects.toThrow('No public key found')
    await expect(getUserPrivateKeyFromIndexedDb(config)).rejects.toThrow('No private key found')
  })

  it('clearAllKeys vide le store', async () => {
    const { indexedDBMock } = createIndexedDbMock()
    // @ts-expect-error test override
    globalThis.indexedDB = indexedDBMock

    const privateKey = { type: 'private' } as CryptoKey
    const publicKey = { type: 'public' } as CryptoKey
    vi.spyOn(window.crypto.subtle, 'importKey')
      .mockResolvedValueOnce(privateKey)
      .mockResolvedValueOnce(publicKey)

    await saveUserKeysToIndexedDb(
      toPem(new Uint8Array([9, 9, 9, 9]).buffer, 'PRIVATE'),
      toPem(new Uint8Array([8, 8, 8, 8]).buffer, 'PUBLIC'),
      config,
    )

    await expect(getKeyStatus(config)).resolves.toBe('ready')
    await clearAllKeys(config)
    await expect(getKeyStatus(config)).resolves.toBe('none')
  })

  it('deleteKeyStore résout sur succès et sur blocked', async () => {
    const success = createIndexedDbMock({ deleteMode: 'success' })
    // @ts-expect-error test override
    globalThis.indexedDB = success.indexedDBMock
    await expect(deleteKeyStore(config)).resolves.toBeUndefined()

    const blocked = createIndexedDbMock({ deleteMode: 'blocked' })
    // @ts-expect-error test override
    globalThis.indexedDB = blocked.indexedDBMock
    await expect(deleteKeyStore(config)).resolves.toBeUndefined()
  })

  it('encryptWithStoredPublicKey et decryptWithStoredPrivateKey utilisent les clés stockées', async () => {
    const { indexedDBMock } = createIndexedDbMock()
    // @ts-expect-error test override
    globalThis.indexedDB = indexedDBMock

    const privateKey = { type: 'private' } as CryptoKey
    const publicKey = { type: 'public' } as CryptoKey

    vi.spyOn(window.crypto.subtle, 'importKey')
      .mockResolvedValueOnce(privateKey)
      .mockResolvedValueOnce(publicKey)

    await saveUserKeysToIndexedDb(
      toPem(new Uint8Array([3, 3, 3, 3]).buffer, 'PRIVATE'),
      toPem(new Uint8Array([4, 4, 4, 4]).buffer, 'PUBLIC'),
      config,
    )

    vi.spyOn(window.crypto.subtle, 'encrypt').mockResolvedValueOnce(new Uint8Array([65, 66, 67]).buffer)
    vi.spyOn(window.crypto.subtle, 'decrypt').mockResolvedValueOnce(new TextEncoder().encode('secret-data').buffer)

    const encrypted = await encryptWithStoredPublicKey('payload', config)
    const decrypted = await decryptWithStoredPrivateKey(encrypted, config)
    expect(typeof encrypted).toBe('string')
    expect(decrypted).toBe('secret-data')
  })

  it('encryptWithStoredPublicKey lève une erreur si payload RSA trop grand', async () => {
    const { indexedDBMock } = createIndexedDbMock()
    // @ts-expect-error test override
    globalThis.indexedDB = indexedDBMock

    const privateKey = { type: 'private' } as CryptoKey
    const publicKey = { type: 'public' } as CryptoKey
    vi.spyOn(window.crypto.subtle, 'importKey')
      .mockResolvedValueOnce(privateKey)
      .mockResolvedValueOnce(publicKey)

    await saveUserKeysToIndexedDb(
      toPem(new Uint8Array([1, 2, 3, 4]).buffer, 'PRIVATE'),
      toPem(new Uint8Array([5, 6, 7, 8]).buffer, 'PUBLIC'),
      config,
    )

    const oversized = 'x'.repeat(447)
    await expect(encryptWithStoredPublicKey(oversized, config)).rejects.toThrow('Data too large for RSA encryption')
  })

  it('importPublicKeyFromPem et encryptWithPublicKey appellent subtle.importKey/encrypt', async () => {
    const publicKey = { type: 'public' } as CryptoKey
    const importSpy = vi.spyOn(window.crypto.subtle, 'importKey').mockResolvedValue(publicKey)
    vi.spyOn(window.crypto.subtle, 'encrypt').mockResolvedValue(new Uint8Array([10, 11]).buffer)

    const publicPem = toPem(new Uint8Array([10, 20, 30, 40]).buffer, 'PUBLIC')
    const imported = await importPublicKeyFromPem(publicPem)
    expect(imported).toBe(publicKey)

    const cipher = await encryptWithPublicKey(publicPem, 'hello')
    expect(typeof cipher).toBe('string')
    expect(importSpy).toHaveBeenCalled()
  })
})

describe('assertClient guard', () => {
  it('lève une erreur si window est indisponible', () => {
    const originalWindow = globalThis.window
    // @ts-expect-error simulate SSR runtime
    delete globalThis.window

    expect(() => strToBuff('hello')).toThrow('Crypto utilities are only available client-side')

    // @ts-expect-error restore test environment
    globalThis.window = originalWindow
  })
})