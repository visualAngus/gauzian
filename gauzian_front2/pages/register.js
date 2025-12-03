import { useState } from 'react';
import Link from 'next/link';

const buf2hex = (buffer) => {
    return [...new Uint8Array(buffer)]
        .map((x) => x.toString(16).padStart(2, '0'))
        .join('');
};

export default function RegisterPage() {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);

    async function handleSubmit(e) {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {

            // We'll mirror the bash script behavior using libsodium-wrappers:
            // - Argon2id to derive `encrypted_password`
            // - derive a key from that with `salt_e2e`
            // - encrypt a generated `storage_key` with XChaCha20-Poly1305
            // Note: this requires the `libsodium-wrappers` package in your project.
            const sodiumLib = await import('libsodium-wrappers-sumo');
            const sodium = sodiumLib.default || sodiumLib;
            await sodium.ready;

            const enc = new TextEncoder();

            // salts (16 bytes each) like the bash script
            const salt_e2e = sodium.randombytes_buf(16);
            const salt_auth = sodium.randombytes_buf(16);

            // storage_key: random 160 bytes (to match openssl rand -base64 160)
            const storageKeyRaw = sodium.randombytes_buf(160);

            // 1) encrypted_password = Argon2id.kdf(32, password, salt_auth)
            const passwordBytes = enc.encode(password);
            const encryptedPassword = sodium.crypto_pwhash(
                32,
                passwordBytes,
                salt_auth,
                sodium.crypto_pwhash_OPSLIMIT_MODERATE,
                sodium.crypto_pwhash_MEMLIMIT_MODERATE,
                sodium.crypto_pwhash_ALG_ARGON2ID13
            );

            // 2) derive a key from encryptedPassword + salt_e2e (Argon2id again)
            const derivedKey = sodium.crypto_pwhash(
                32,
                encryptedPassword,
                salt_e2e,
                sodium.crypto_pwhash_OPSLIMIT_MODERATE,
                sodium.crypto_pwhash_MEMLIMIT_MODERATE,
                sodium.crypto_pwhash_ALG_ARGON2ID13
            );

            // 3) encrypt storageKeyRaw with XChaCha20-Poly1305
            const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
            const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
                storageKeyRaw,
                null,
                null,
                nonce,
                derivedKey
            );

            // combine nonce + ciphertext like the bash script
            const combined = new Uint8Array(nonce.length + ciphertext.length);
            combined.set(nonce, 0);
            combined.set(ciphertext, nonce.length);

            // base64 versions for transport
            const b64 = (u8) => sodium.to_base64(u8, sodium.base64_variants.ORIGINAL);
            const b64NoPadding = (u8) => sodium.to_base64(u8, sodium.base64_variants.ORIGINAL).replace(/=+$/, '');
            const saltE2eB64 = b64NoPadding(salt_e2e);
            const saltAuthB64 = b64NoPadding(salt_auth);
            const storageKeyEncB64 = b64(combined);
            const storageKeyEncRecB64 = b64(sodium.randombytes_buf(160));

            // Build payload similar to the bash script (it sends plaintext password)
            const payload = {
                first_name: firstName,
                last_name: lastName,
                email,
                password, // plaintext password (matches bash script behavior)
                salt_e2e: saltE2eB64,
                salt_auth: saltAuthB64,
                storage_key_encrypted: storageKeyEncB64,
                storage_key_encrypted_recuperation: storageKeyEncRecB64
            };

            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            console.log(data)
            if (!res.ok) throw new Error(data.message || 'Erreur');
            
            setMessage({ type: 'success', text: data.message || 'Inscription réussie' });
            setFirstName('');
            setLastName('');
            setEmail('');
            setPassword('');
        } catch (err) {
            setMessage({ type: 'error', text: err.message });
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="page">
            <div className="card">
                <h1>Créer un compte</h1>
                <p className="muted">Entrez vos informations pour créer un compte de démonstration.</p>

                {message && (
                    <div className={`alert ${message.type === 'error' ? 'err' : 'ok'}`}>{message.text}</div>
                )}

                <form onSubmit={handleSubmit} className="form">
                    <label>
                        Prénom
                        <input value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={loading} required />
                    </label>

                    <label>
                        Nom
                        <input value={lastName} onChange={(e) => setLastName(e.target.value)} disabled={loading} required />
                    </label>

                    <label>
                        Email
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} required />
                    </label>

                    <label>
                        Mot de passe
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} required minLength={6} />
                    </label>

                    <div className="actions">
                        <button type="submit" disabled={loading}>{loading ? 'En cours…' : 'S’inscrire'}</button>
                        <Link href="/login" className="link">Déjà un compte ? Se connecter</Link>
                    </div>
                </form>
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
      `}</style>
        </main>
    );
}
