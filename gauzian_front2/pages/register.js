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


            const enc = new TextEncoder();

            // 1. Générer le "Sel" (Salt)
            // C'est une valeur aléatoire nécessaire pour renforcer la transformation du mot de passe.
            const salt = window.crypto.getRandomValues(new Uint8Array(16));
            
            const storageKey = await window.crypto.subtle.generateKey(
                { name: "AES-GCM", length: 256 },
                true, // extractable (on doit pouvoir l'exporter pour la chiffrer)
                ["encrypt", "decrypt"]
            );


            const keyMaterial = await window.crypto.subtle.importKey(
                "raw",
                enc.encode(password),
                { name: "PBKDF2" },
                false,
                ["deriveKey"]
            );


            const passwordKey = await window.crypto.subtle.deriveKey(
                {
                    name: "PBKDF2",
                    salt: salt,
                    iterations: 100000, // 100k itérations pour ralentir les attaques brute-force
                    hash: "SHA-256",
                },
                keyMaterial,
                { name: "AES-GCM", length: 256 },
                false,
                ["encrypt", "decrypt"]
            );
            const iv = window.crypto.getRandomValues(new Uint8Array(12)); 
            const rawStorageKey = await window.crypto.subtle.exportKey("raw", storageKey);

            const encryptedStorageKeyBuffer = await window.crypto.subtle.encrypt(
                { name: "AES-GCM", iv: iv },
                passwordKey,
                rawStorageKey
            );
            const hashBuffer = await window.crypto.subtle.digest(
                "SHA-256",
                enc.encode(password)
            );
            const passwordHashForServer = buf2hex(hashBuffer);

            // Note bien : on envoie 'passwordHashForServer' et non 'password'.
            const payload = {
                first_name: firstName,
                last_name: lastName,
                email,
                password: passwordHashForServer, // Hash pour le login
                // Les clés chiffrées (Le coffre-fort) :
                keys: {
                    salt: buf2hex(salt),
                    iv: buf2hex(iv),
                    encryptedStorageKey: buf2hex(encryptedStorageKeyBuffer)
                }
            };

            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
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
