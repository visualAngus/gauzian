import { useState } from 'react';
import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Gauzial from '../components/gauzial';

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
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLoadingPage, setIsLoadingPage] = useState(false);
  const [message, setMessage] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isValid, setIsValid] = useState(true);
  const [isRequestGood, setIsRequestGood] = useState(true);

  // Fonction de validation d'email
  const validateEmail = (email) => {
    if (email === '') return true; // Ne pas afficher d'erreur si le champ est vide
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password) => {
    // Au moins 8 caractères, une majuscule, un chiffre, un caractère spécial
    return /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(password);
  }

  // Gérer le changement d'email et valider
  const handleEmailChange = (e) => {  
    setIsRequestGood(true);
    const newEmail = e.target.value;
    setEmail(newEmail);
    setIsValid(validateEmail(newEmail));
  };

  const handelPasswordChange = (e) => {
    setIsRequestGood(true);
    setPassword(e.target.value);
    setIsValid(validatePassword(e.target.value));
  }

  useEffect(() => {
    async function autoLogin() {
      setIsLoadingPage(true);
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
          setIsLoadingPage(false);
        } catch (err) {
          setIsLoadingPage(false);
          setIsRequestGood(false);
          setMessage({ type: 'error', text: err.message });
        } finally {
          setLoading(false);
        }
      }
      else { 
        setIsLoadingPage(false);
        setLoading(false);
      }

    }

    autoLogin();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setIsRequestGood(true);

    // Best-effort: get client's public IP to include for server logs (non-trusted)
    try {
      const enc = new TextEncoder();

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      console.log(data)

      if (!res.ok) throw new Error(data.message || 'Erreur');
      // Si le serveur nous renvoie le coffre (vault), on l'ouvre !
      if (data.salt_e2e && data.salt_auth && data.public_key && data.private_key_encrypted) {
        setMessage({ type: 'success', text: 'Connexion Déchiffrement des clés...' });
        setIsLoadingPage(true);

        try {
          const sodiumLib = await import('libsodium-wrappers-sumo');
          const sodium = sodiumLib.default || sodiumLib;
          await sodium.ready;



          const passwordBytes = enc.encode(password);

          // Decode salts from base64 into Uint8Array and validate lengths
          const saltAuthBuf = b64ToBuf(data.salt_auth);
          const saltE2eBuf = b64ToBuf(data.salt_e2e);

          if (saltAuthBuf.length !== sodium.crypto_pwhash_SALTBYTES || saltE2eBuf.length !== sodium.crypto_pwhash_SALTBYTES) {
            setIsLoadingPage(false);
            throw new Error("Erreur lors du déchiffrement des clés : longueur de sel invalide");
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

          // Recompute the user master key exactly like register (hash of the derived key)
          const userMasterKey = sodium.crypto_generichash(32, derivedKey);
          // Debug: show derived key and salts (prefixes) to compare with register

          // déchiffrement de storage_key_encrypted
          const encryptedDataBuf = b64ToBuf(data.private_key_encrypted);

          const npubBytes = sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES || 24;
          if (!encryptedDataBuf || encryptedDataBuf.length <= npubBytes) {
            setIsLoadingPage(false);
            throw new Error(`Donnée chiffrée trop courte: ${encryptedDataBuf.length} bytes (expected > ${npubBytes})`);
          }

          const nonce = encryptedDataBuf.slice(0, npubBytes);
          const ciphertext = encryptedDataBuf.slice(npubBytes);

          if (ciphertext == null) {
            setIsLoadingPage(false);
            throw new Error('ciphertext is null or undefined after slicing encrypted data');
          }

          const ciphertextU8 = new Uint8Array(ciphertext);
          const nonceU8 = new Uint8Array(nonce);
          const keyU8 = new Uint8Array(userMasterKey);

          let decryptedPrivateKey = null;
          try {
            // libsodium binding expects (nsec, ciphertext, ad, nonce, key)
            // nsec is unused for XChaCha20-Poly1305; pass null
            decryptedPrivateKey = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
              null,
              ciphertextU8,
              null,
              nonceU8,
              keyU8
            );
          } catch (innerErr) {
            console.error('AEAD decrypt threw:', innerErr && innerErr.message, innerErr);
            setIsLoadingPage(false);
            throw innerErr;
          }

          // Stocker la clé privée au même format qu'à l'inscription (base64 PKCS#8)
          const privateKeyB64 = bufToB64(decryptedPrivateKey);
          console.log('Déchiffrement réussi, clé privée (prefix 80):', privateKeyB64.slice(0, 80));
          sessionStorage.setItem('privateKey', privateKeyB64);
        } catch (e) {
          setIsLoadingPage(false);
          throw new Error("Erreur lors du déchiffrement des clés : " + e.message);
        }
        // redirigé vers la page d'accueil ou tableau de bord
        // Par exemple, utiliser router.push('/') si vous utilisez Next.js router
        // window.location.href = '/';

      } else {
        setIsLoadingPage(false);
        throw new Error("Erreur critique : Aucune clé de chiffrement reçue du serveur.");
      }

    } catch (err) {
      setIsLoadingPage(false);
      setIsRequestGood(false);
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <div className="left-panel">
        <Gauzial 
          lookAway={showPassword} 
          isUnhappy={!isValid} 
          isRequestGood={isRequestGood}
          isLoadingPage={isLoadingPage}
        />
        <div className="branding">
          <h2>Gauzian</h2>
          <p>Votre espace sécurisé</p>
        </div>
      </div>
      
      <div className="right-panel">
        <div className="card">
          <h1>Bienvenue !</h1>
          <p className="subtitle">Connectez-vous pour accéder à votre espace</p>

          {message && (
            <div className={`alert ${message.type === 'error' ? 'err' : 'ok'}`}>
              {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="form" style={{ opacity: isLoadingPage ? 0.5 : 1, pointerEvents: isLoadingPage ? 'none' : 'auto' }}>
            <div className="input-group">
              <label>Email</label>
              <input 
                type="email" 
                value={email} 
                onChange={handleEmailChange}
                disabled={loading || isLoadingPage} 
                placeholder="votre@email.com"
                className={ !validateEmail(email) && email.length > 0 ? 'input-error' : '' }
                required 
              />
              {!validateEmail(email) && email.length > 0 && (
                <span className="error-text">Veuillez entrer une adresse email valide.</span>
              )}
            </div>

            <div className="input-group">
              <label>Mot de passe</label>
              <div className="password-wrapper">
                <input 
                  type={showPassword ? "text" : "password"}
                  value={password} 
                  onChange={ (e) => handelPasswordChange(e)}
                  className={ !validatePassword(password) && password.length > 0 ? 'input-error' : '' }
                  disabled={loading || isLoadingPage} 
                  placeholder="••••••••"
                  required 
                />
                <button 
                  type="button" 
                  className="toggle-password"
                  onClick={() => {
                    setShowPassword(!showPassword);
                    if (!showPassword) { setIsRequestGood(true); }
                  }}
                  disabled={loading || isLoadingPage}
                  aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                >
                  {showPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button type="submit" className="submit-btn" disabled={loading || isLoadingPage}>
              {loading ? 'Connexion en cours…' : 'Se connecter'}
            </button>
            
            <div className="links register-btn">
              <button 
                type="button" 
                className="link"
                onClick={() => router.push('/register')}
              >
                Créer un compte
              </button>
            </div>
          </form>
        </div>
      </div>

      <style jsx>{`
        .page {
          min-height: 100vh;
          display: flex;
          background-color: #F8FAFC;
        }

        .left-panel {
          flex: 1;
          background: linear-gradient(135deg, #F97316 0%, #FDBA74 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 3rem;
          position: relative;
          overflow: hidden;
        }

        .left-panel::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
          animation: pulse 15s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.1); opacity: 0.8; }
        }

        .branding {
          margin-top: 3rem;
          text-align: center;
          color: white;
          z-index: 1;
        }

        .branding h2 {
          font-size: 3rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
          text-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }

        .branding p {
          font-size: 1.2rem;
          opacity: 0.9;
        }

        .right-panel {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
        }

        .card {
          width: 100%;
          max-width: 480px;
          background: white;
          padding: 3rem;
          border-radius: 20px;
          box-shadow: 0 10px 40px rgba(11, 17, 32, 0.08);
        }

        h1 {
          margin: 0 0 0.5rem;
          color: #0B1120;
          font-size: 2.2rem;
          font-weight: 700;
        }

        .subtitle {
          color: #334155;
          margin: 0 0 2rem;
          font-size: 1rem;
        }

        .form {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .input-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .input-group label {
          font-size: 0.95rem;
          font-weight: 600;
          color: #0B1120;
        }

        .password-wrapper {
          position: relative;
          width: 100%;
        }

        input {
          width: 100%;
          padding: 0.875rem 1rem;
          border-radius: 12px;
          border: 2px solid #E2E8F0;
          background: white;
          font-size: 1rem;
          transition: all 0.3s ease;
          font-family: inherit;
        }

        .password-wrapper input {
          padding-right: 3rem;
        }

        .toggle-password {
          position: absolute;
          right: 0.75rem;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: #334155;
          cursor: pointer;
          padding: 0.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.2s ease;
          border-radius: 6px;
        }

        .toggle-password:hover:not(:disabled) {
          color: #F97316;
          background: rgba(249, 115, 22, 0.05);
        }

        .toggle-password:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .toggle-password svg {
          width: 20px;
          height: 20px;
        }

        input:focus {
          outline: none;
          border-color: #F97316;
          box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.1);
        }

        input:disabled {
          background-color: #F8FAFC;
          cursor: not-allowed;
        }

        input.input-error {
          border-color: #EF4444;
          background-color: #FEF2F2;
        }

        input.input-error:focus {
          border-color: #EF4444;
          box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
        }

        .error-text {
          color: #EF4444;
          font-size: 0.875rem;
          margin-top: 0.25rem;
          display: block;
        }

        .submit-btn {
          background: linear-gradient(135deg, #F97316 0%, #FDBA74 100%);
          color: white;
          padding: 1rem;
          border-radius: 12px;
          border: none;
          font-size: 1.05rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          margin-top: 0.5rem;
          box-shadow: 0 4px 12px rgba(249, 115, 22, 0.3);
        }

        .submit-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(249, 115, 22, 0.4);
        }

        .submit-btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .links {
          text-align: center;
          margin-top: 1rem;
        }

        .link {
          color: #F97316;
          text-decoration: none;
          font-weight: 500;
          transition: color 0.2s ease;
        }

        .link:hover {
          color: #FDBA74;
          text-decoration: underline;
        }

        .register-btn {
          margin-top: 2rem;
          padding-top: 2rem;
          border-top: 1px solid #E2E8F0;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
        }

        .register-btn .link {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          max-width: 300px;
          padding: 1rem 2rem;
          background: transparent;
          border: 2px solid #E2E8F0;
          border-radius: 12px;
          color: #A0AEC0;
          text-decoration: none;
          font-weight: 600;
          font-size: 1rem;
          transition: all 0.3s ease;
          cursor: pointer;
        }

        .register-btn .link:hover {
          background: linear-gradient(135deg, #F97316 0%, #FDBA74 100%);
          color: white;
          text-decoration: none;
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(249, 115, 22, 0.3);
          border-color: #F97316;
        }

        .register-btn .link:active {
          transform: translateY(0);
        }

        .alert {
          padding: 1rem;
          border-radius: 12px;
          margin-bottom: 1.5rem;
          font-size: 0.95rem;
        }

        .alert.err {
          background: #FEF2F2;
          color: #991B1B;
          border: 1px solid #FECACA;
        }

        .alert.ok {
          background: #ECFDF5;
          color: #065F46;
          border: 1px solid #A7F3D0;
        }

        .demo-hint {
          display: none;
        }

        .demo-hint p {
          display: none;
        }

        .demo-hint strong {
          display: none;
        }

        @media (max-width: 968px) {
          .page {
            flex-direction: column;
          }

          .left-panel {
            min-height: 40vh;
            padding: 2rem;
          }

          .branding h2 {
            font-size: 2rem;
          }

          .branding p {
            font-size: 1rem;
          }

          .card {
            padding: 2rem;
          }

          h1 {
            font-size: 1.8rem;
          }
        }
      `}</style>
    </main>
  );
}
