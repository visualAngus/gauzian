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

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  useEffect(() => {
    async function autoLogin() {
      setLoading(true);
      setMessage(null);

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
      } catch (err) {
        setMessage({ type: 'error', text: err.message });
      } finally {
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
      const hashBuffer = await window.crypto.subtle.digest(
          "SHA-256",
          enc.encode(password)
      );
      const passwordHashForServer = buf2hex(hashBuffer);

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email, password: passwordHashForServer, client_ip }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Erreur');
       // Si le serveur nous renvoie le coffre (vault), on l'ouvre !
      if (data.vault && data.vault_salt && data.vault_iv) {
          setMessage({ type: 'success', text: 'Connexion API OK. Déchiffrement des clés...' });

          // 1. Récupérer les ingrédients binaires
          const salt = hex2buf(data.vault_salt);
          const iv = hex2buf(data.vault_iv);
          const encryptedVault = hex2buf(data.vault);

          // 2. Recréer la clé du mot de passe (PasswordKey)
          const keyMaterial = await window.crypto.subtle.importKey(
              "raw",
              enc.encode(password), // On utilise le mot de passe brut tapé par l'user
              { name: "PBKDF2" },
              false,
              ["deriveKey"]
          );

          const passwordKey = await window.crypto.subtle.deriveKey(
              {
                  name: "PBKDF2",
                  salt: salt,
                  iterations: 100000,
                  hash: "SHA-256",
              },
              keyMaterial,
              { name: "AES-GCM", length: 256 },
              false,
              ["decrypt"]
          );

          // 3. Déchiffrer le coffre (Vault) pour obtenir la StorageKey
          const decryptedStorageKeyBuffer = await window.crypto.subtle.decrypt(
              { name: "AES-GCM", iv: iv },
              passwordKey,
              encryptedVault
          );

          // 4. Importer la StorageKey pour qu'elle soit utilisable par JS
          const storageKey = await window.crypto.subtle.importKey(
              "raw",
              decryptedStorageKeyBuffer,
              { name: "AES-GCM" },
              true,
              ["encrypt", "decrypt"]
          );

          console.log("🔓 CLÉ MAÎTRE DÉCHIFFRÉE AVEC SUCCÈS !");
          
          // STOCKAGE TEMPORAIRE DE LA CLÉ
          // Dans une vraie app, utilise un Context React (ex: AuthContext)
          // Pour l'instant, on la met dans window pour tester que ça marche.
          window.GAUZIAN_MASTER_KEY = storageKey;

          setMessage({ type: 'success', text: 'Connexion réussie & Clés déchiffrées !' });
          
          // Redirection vers le tableau de bord après court délai
          setTimeout(() => {
              window.location.href = '/';
          }, 1000);

      } else {
          // Cas bizarre : login OK mais pas de vault renvoyé ?
          throw new Error("Erreur critique : Aucune clé de chiffrement reçue du serveur.");
      }

    } catch (err) {
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
