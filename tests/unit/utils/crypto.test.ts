import { describe, it, expect, beforeEach } from 'vitest'
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
} from '~/utils/crypto'

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
