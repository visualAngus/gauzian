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
            const sodiumLib = await import('libsodium-wrappers-sumo');
            const sodium = sodiumLib.default || sodiumLib;
            await sodium.ready;

            const enc = new TextEncoder();

            // --- 1. GÉNÉRATION DES SECRETS ---
            const salt_e2e = sodium.randombytes_buf(16);
            const salt_auth = sodium.randombytes_buf(16);

            // La clé maîtresse brute (160 bytes)
            const storageKeyRaw = sodium.randombytes_buf(160);

            // --- 2. DÉRIVATION DU MOT DE PASSE (Pour protéger la storageKey) ---
            const passwordBytes = enc.encode(password);
            
            // a) Hachage du mot de passe pour l'étape intermédiaire
            const encryptedPassword = sodium.crypto_pwhash(
                32,
                passwordBytes,
                salt_auth,
                sodium.crypto_pwhash_OPSLIMIT_MODERATE,
                sodium.crypto_pwhash_MEMLIMIT_MODERATE,
                sodium.crypto_pwhash_ALG_ARGON2ID13
            );

            // b) Dérivation de la KEK (Key Encryption Key)
            const derivedKey = sodium.crypto_pwhash(
                32,
                encryptedPassword,
                salt_e2e,
                sodium.crypto_pwhash_OPSLIMIT_MODERATE,
                sodium.crypto_pwhash_MEMLIMIT_MODERATE,
                sodium.crypto_pwhash_ALG_ARGON2ID13
            );

            // --- 3. CHIFFREMENT DE LA STORAGE KEY (Le coffre-fort) ---
            const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
            const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
                storageKeyRaw,
                null,
                null,
                nonce,
                derivedKey
            );
            
            // Concaténation [Nonce + Cipher]
            const storageKeyEncrypted = new Uint8Array(nonce.length + ciphertext.length);
            storageKeyEncrypted.set(nonce, 0);
            storageKeyEncrypted.set(ciphertext, nonce.length);


            // --- 4. PRÉPARATION DU DOSSIER RACINE (CORRECTION ICI !) ---
            
            // A. On dérive la clé utilisable (32 bytes) à partir de la grosse clé (160 bytes)
            // C'est CRUCIAL pour que ça matche avec ton code de lecture (Drive)
            const userMasterKey = sodium.crypto_generichash(32, storageKeyRaw);

            // B. On crée la clé du dossier racine
            const rootFolderKey = sodium.randombytes_buf(32);

            // C. On chiffre la clé du dossier avec la userMasterKey (et PAS avec derivedKey)
            const nonceRootKey = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
            const encryptedRootKeyBlob = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
                rootFolderKey,
                null,
                null,
                nonceRootKey,
                userMasterKey // <--- On utilise bien la clé dérivée du storageKey
            );
            const finalRootFolderKey = new Uint8Array([...nonceRootKey, ...encryptedRootKeyBlob]);

            // D. On chiffre les métadonnées du dossier racine avec sa propre clé
            const folderMetadata = JSON.stringify({
                name: 'Mon Drive', // Nom par défaut
                created_at: new Date().toISOString(),
            });

            const nonceMeta = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
            const encryptedMetadataBlob = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
                sodium.from_string(folderMetadata),
                null,
                null,
                nonceMeta,
                rootFolderKey // <--- Chiffré avec la clé du dossier
            );
            const finalRootMetadata = new Uint8Array([...nonceMeta, ...encryptedMetadataBlob]);


            // --- 5. ENCODAGE BASE64 POUR L'ENVOI ---
            const b64 = (u8) => sodium.to_base64(u8, sodium.base64_variants.ORIGINAL);
            const b64NoPadding = (u8) => sodium.to_base64(u8, sodium.base64_variants.ORIGINAL).replace(/=+$/, '');

            const payload = {
                first_name: firstName,
                last_name: lastName,
                email,
                password, // Envoyer en clair (sur HTTPS) pour que le serveur hash pour l'auth, ou envoyer le hash selon ton back
                
                // Les sels
                salt_e2e: b64NoPadding(salt_e2e),
                salt_auth: b64NoPadding(salt_auth),
                
                // La clé principale chiffrée par le mot de passe
                storage_key_encrypted: b64(storageKeyEncrypted),
                
                // (Optionnel) Clé de récupération - ici on met du dummy random pour l'exemple
                storage_key_encrypted_recuperation: b64(sodium.randombytes_buf(160)), 
                
                // Le dossier racine chiffré par la clé principale
                folder_key_encrypted: b64(finalRootFolderKey),
                folder_metadata_encrypted: b64(finalRootMetadata),
            };

            // --- 6. APPEL API ---
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            
            const data = await res.json();
            console.log('Réponse serveur:', data);

            if (!res.ok) throw new Error(data.message || 'Erreur lors de l\'inscription');

            setMessage({ type: 'success', text: 'Inscription réussie ! Redirection...' });
            
            // Optionnel : Auto-login ou redirection vers /login
            // window.location.href = '/login';

        } catch (err) {
            console.error(err);
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