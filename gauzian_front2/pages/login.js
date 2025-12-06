import { useState } from 'react';
import Link from 'next/link';
import { useEffect } from 'react';

const buf2hex = (buffer) => {
  return [...new Uint8Array(buffer)]
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
};

const hex2buf = (hex) => {
  const bytes = new Uint8Array(hex.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));
  return bytes.buffer;
};

const hexToBuf = (hex) => {
  if (!hex || typeof hex !== 'string') return new Uint8Array();
  const cleaned = hex.replace(/^0x/, '').replace(/\s+/g, '');
  try {
    return new Uint8Array(hex2buf(cleaned));
  } catch (e) {
    return new Uint8Array();
  }
};

const b64ToBuf = (b64) => {
  if (!b64) return new Uint8Array();
  // support base64url variants
  b64 = String(b64).trim();
  b64 = b64.replace(/\s+/g, '');
  b64 = b64.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4;
  if (pad) b64 += '='.repeat(4 - pad);
  try {
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr;
  } catch (e) {
    console.warn('b64ToBuf decode failed for value (prefix 80):', (b64 || '').slice(0, 80), e);
    return new Uint8Array();
  }
};

const bufToB64 = (buf) => {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};


// fonction qui cache tout les éléments de la page pendant le login
const hidePageElementsDuringLogin = (hide) => {
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const elements = document.querySelectorAll('body > *:not(script):not(style)');
    elements.forEach(el => {
      el.style.display = hide ? 'none' : '';
    });
  }
};


export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  useEffect(() => {
    async function autoLogin() {
      hidePageElementsDuringLogin(true);
      setLoading(true);
      setMessage(null);

      const storageKey_from_storage = localStorage.getItem('storageKey');

      if (storageKey_from_storage) {
        try {
          const res = await fetch('/api/auth/autologin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
          const data = await res.json();
          if (res.ok) {
            setMessage({ type: 'success', text: 'Connecté automatiquement' });
            // redirigé vers la page d'accueil ou tableau de bord
            // Par exemple, utiliser router.push('/') si vous utilisez Next.js router
            window.location.href = '/';
          }
          hidePageElementsDuringLogin(false);
        } catch (err) {
          hidePageElementsDuringLogin(false);
          setMessage({ type: 'error', text: err.message });
        } finally {
          setLoading(false);
        }
      }
      else { 
        hidePageElementsDuringLogin(false);
        setLoading(false);
      }

    }

    autoLogin();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    // Best-effort: get client's public IP to include for server logs (non-trusted)
    let client_ip = null;
    try {
      const ipr = await fetch('https://api.ipify.org?format=json');
      if (ipr.ok) {
        const ipj = await ipr.json();
        if (ipj && ipj.ip) client_ip = ipj.ip;
      }
    } catch (_e) {
      // ignore failures
    }

    try {
      const enc = new TextEncoder();

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email, password, client_ip }),
      });
      const data = await res.json();
      console.log(data)

      if (!res.ok) throw new Error(data.message || 'Erreur');
      // Si le serveur nous renvoie le coffre (vault), on l'ouvre !
      if (data.salt_e2e && data.storage_key_encrypted && data.salt_auth) {
        setMessage({ type: 'success', text: 'Connexion Déchiffrement des clés...' });
        hidePageElementsDuringLogin(true);

        try {
          const sodiumLib = await import('libsodium-wrappers-sumo');
          const sodium = sodiumLib.default || sodiumLib;
          await sodium.ready;



          const passwordBytes = enc.encode(password);

          // Decode salts from base64 into Uint8Array and validate lengths
          const saltAuthBuf = b64ToBuf(data.salt_auth);
          const saltE2eBuf = b64ToBuf(data.salt_e2e);

          if (saltAuthBuf.length !== sodium.crypto_pwhash_SALTBYTES || saltE2eBuf.length !== sodium.crypto_pwhash_SALTBYTES) {
            throw new Error("Erreur lors du déchiffrement des clés : longueur de sel invalide");
            hidePageElementsDuringLogin(false);
          }

          const encryptedPassword = sodium.crypto_pwhash(
            32,
            passwordBytes,
            saltAuthBuf,
            sodium.crypto_pwhash_OPSLIMIT_MODERATE,
            sodium.crypto_pwhash_MEMLIMIT_MODERATE,
            sodium.crypto_pwhash_ALG_ARGON2ID13
          );

          const derivedKey = sodium.crypto_pwhash(
            32,
            encryptedPassword,
            saltE2eBuf,
            sodium.crypto_pwhash_OPSLIMIT_MODERATE,
            sodium.crypto_pwhash_MEMLIMIT_MODERATE,
            sodium.crypto_pwhash_ALG_ARGON2ID13
          );
          // Debug: show derived key and salts (prefixes) to compare with register

          // déchiffrement de storage_key_encrypted
          const encryptedDataBuf = b64ToBuf(data.storage_key_encrypted);

          const npubBytes = sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES || 24;
          if (!encryptedDataBuf || encryptedDataBuf.length <= npubBytes) {
            throw new Error(`Donnée chiffrée trop courte: ${encryptedDataBuf.length} bytes (expected > ${npubBytes})`);
            hidePageElementsDuringLogin(false);
          }

          const nonce = encryptedDataBuf.slice(0, npubBytes);
          const ciphertext = encryptedDataBuf.slice(npubBytes);

          if (ciphertext == null) {
            throw new Error('ciphertext is null or undefined after slicing encrypted data');
            hidePageElementsDuringLogin(false);
          }

          const ciphertextU8 = new Uint8Array(ciphertext);
          const nonceU8 = new Uint8Array(nonce);
          const keyU8 = new Uint8Array(derivedKey);

          let decryptedStorageKey = null;
          try {
            // libsodium binding expects (nsec, ciphertext, ad, nonce, key)
            // nsec is unused for XChaCha20-Poly1305; pass null
            decryptedStorageKey = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
              null,
              ciphertextU8,
              null,
              nonceU8,
              keyU8
            );
          } catch (innerErr) {
            console.error('AEAD decrypt threw:', innerErr && innerErr.message, innerErr);
            hidePageElementsDuringLogin(false);
            throw innerErr;
          }

          const storageKeyHex = buf2hex(decryptedStorageKey.buffer);

          // Ici, vous pouvez stocker storageKeyHex dans le contexte global, localStorage, etc.
          // Par exemple :
          localStorage.setItem('storageKey', storageKeyHex);
        } catch (e) {
          hidePageElementsDuringLogin(false);
          throw new Error("Erreur lors du déchiffrement des clés : " + e.message);
        }
        // redirigé vers la page d'accueil ou tableau de bord
        // Par exemple, utiliser router.push('/') si vous utilisez Next.js router
        window.location.href = '/';

      } else {
        hidePageElementsDuringLogin(false);
        throw new Error("Erreur critique : Aucune clé de chiffrement reçue du serveur.");
      }

    } catch (err) {
      hidePageElementsDuringLogin(false);
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <div className="card">
        <h1>Se connecter</h1>
        <p className="muted">Entrez vos identifiants pour vous connecter (démo).</p>

        {message && (
          <div className={`alert ${message.type === 'error' ? 'err' : 'ok'}`}>{message.text}</div>
        )}

        <form onSubmit={handleSubmit} className="form">
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} required />
          </label>

          <label>
            Mot de passe
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} required />
          </label>

          <div className="actions">
            <button type="submit" disabled={loading}>{loading ? 'Connexion…' : 'Se connecter'}</button>
            <Link href="/register" className="link">Pas encore inscrit ?</Link>
          </div>
        </form>

        <p className="hint">Pour tester en démo : email <code>test@example.com</code> / mot de passe <code>password</code></p>
      </div>

      <style jsx>{`
        .page{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem;background:linear-gradient(180deg,#eef2f7, #f8fafc)}
        .card{width:100%;max-width:540px;background:#fff;padding:2rem;border-radius:12px;box-shadow:0 8px 30px rgba(2,6,23,0.08);border:1px solid #e6eef8}
        h1{margin:0 0 0.25rem;color:#0b63a7}
        .muted{color:#61708a;margin:0 0 1rem}
        .form label{display:block;margin-bottom:0.75rem;font-size:0.95rem}
        input{width:100%;padding:0.65rem 0.75rem;margin-top:0.35rem;border-radius:8px;border:1px solid #d7e3f2;background:#fbfdff}
        .actions{display:flex;align-items:center;gap:1rem;margin-top:1rem}
        button{background:#0b63a7;color:#fff;padding:0.6rem 1rem;border-radius:8px;border:none;cursor:pointer}
        button:disabled{opacity:0.6;cursor:default}
        .link{color:#0b63a7;text-decoration:underline}
        .alert{padding:0.6rem 0.75rem;border-radius:8px;margin:0.5rem 0}
        .alert.err{background:#fff0f0;color:#8b1a1a;border:1px solid #ffd6d6}
        .alert.ok{background:#f0fff6;color:#075e2e;border:1px solid #c5f7d7}
        .hint{margin-top:1rem;color:#6b7788;font-size:0.9rem}
        code{background:#f3f6fb;padding:0.15rem 0.35rem;border-radius:4px}
      `}</style>
    </main>
  );
}
