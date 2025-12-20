import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Gauzial from '../components/gauzial';

const buf2hex = (buffer) => {
    return [...new Uint8Array(buffer)]
        .map((x) => x.toString(16).padStart(2, '0'))
        .join('');
};

export default function RegisterPage() {
    const router = useRouter();
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false)
    const [isLoadingPage, setIsLoadingPage] = useState(false);
    const [message, setMessage] = useState(null);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isEmailValid, setIsEmailValid] = useState(true);
    const [isPasswordValid, setIsPasswordValid] = useState(true);
    const [isPasswordMatch, setIsPasswordMatch] = useState(true);
    const [isRequestGood, setIsRequestGood] = useState(true);

    // Fonction de validation d'email
    const validateEmail = (email) => {
        if (email === '') return true;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    // Fonction de validation du mot de passe
    const validatePassword = (password) => {
        // Au moins 8 caractères, une majuscule, un chiffre, un caractère spécial
        return /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(password);
    };

    // Gérer le changement d'email et valider
    const handleEmailChange = (e) => {
        setIsRequestGood(true);
        const newEmail = e.target.value;
        setEmail(newEmail);
        setIsEmailValid(validateEmail(newEmail));
    };

    // Gérer le changement du mot de passe et valider
    const handlePasswordChange = (e) => {
        setIsRequestGood(true);
        const newPassword = e.target.value;
        setPassword(newPassword);
        setIsPasswordValid(validatePassword(newPassword));
        // Vérifier la correspondance si le champ de confirmation n'est pas vide
        if (confirmPassword) {
            setIsPasswordMatch(newPassword === confirmPassword);
        }
    };

    // Gérer le changement du mot de passe de confirmation
    const handleConfirmPasswordChange = (e) => {
        setIsRequestGood(true);
        const newConfirmPassword = e.target.value;
        setConfirmPassword(newConfirmPassword);
        setIsPasswordMatch(password === newConfirmPassword);
    };

    async function generateKeyPair() {
        const keyPair = await window.crypto.subtle.generateKey(
            {
                name: "RSA-OAEP",
                modulusLength: 2048,
                publicExponent: new Uint8Array([1, 0, 1]),
                hash: "SHA-256",
            },
            true,
            ["encrypt", "decrypt"]
        );

        const publicKeyBuffer = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);
        const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(publicKeyBuffer)));

        const privateKeyBuffer = await window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
        const privateKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(privateKeyBuffer)));

        return {
            publicKey: publicKeyBase64,
            privateKey: privateKeyBase64,
        };
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        // Vérifier que tous les champs sont valides avant de soumettre
        if (!firstName || !lastName || !email || !password || !confirmPassword || !validateEmail(email) || !validatePassword(password) || password !== confirmPassword) {
            setIsRequestGood(false);
            setLoading(false);
            return;
        }

        setIsLoadingPage(true);

        try {
            const sodiumLib = await import('libsodium-wrappers-sumo');
            const sodium = sodiumLib.default || sodiumLib;
            await sodium.ready;

            const enc = new TextEncoder();

            // --- 1. GÉNÉRATION DES SECRETS ---
            const salt_e2e = sodium.randombytes_buf(16);
            const salt_auth = sodium.randombytes_buf(16);


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


            // --- 4. PRÉPARATION DU DOSSIER RACINE (CORRECTION ICI !) ---
            
            const keyPair = await generateKeyPair();
            // A. On dérive la clé utilisable (32 bytes) à partir de la grosse clé (derivedKey)
            // C'est CRUCIAL pour que ça matche avec ton code de lecture (Drive)
            const userMasterKey = sodium.crypto_generichash(32, derivedKey);

            // B. On crée la clé du dossier racine
            const rootFolderKey = sodium.randombytes_buf(32);

            // C. On chiffre la clé du dossier avec la userMasterKey (et PAS avec derivedKey)
            const nonceRootKey = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
            const encryptedRootKeyBlob = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
                rootFolderKey,
                null,
                null,
                nonceRootKey,
                keyPair.publicKey // <--- Chiffré avec la la clef public du user
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

            // E. Génération de la paire de clés asymétriques pour l'utilisateur 

            // F. On chiffrera la clé privée avec la userMasterKey avant envoi
            const privateKeyBytes = Uint8Array.from(atob(keyPair.privateKey), c => c.charCodeAt(0));
            const noncePrivKey = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
            const encryptedPrivateKeyBlob = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
                privateKeyBytes,
                null,
                null,
                noncePrivKey,
                userMasterKey
            );
            const finalEncryptedPrivateKey = new Uint8Array([...noncePrivKey, ...encryptedPrivateKeyBlob]);

            // On enverra la clé publique en clair
            const publicKeyToSend = keyPair.publicKey;


            // --- 5. ENCODAGE BASE64 POUR L'ENVOI ---
            const b64 = (u8) => sodium.to_base64(u8, sodium.base64_variants.ORIGINAL);
            const b64NoPadding = (u8) => sodium.to_base64(u8, sodium.base64_variants.ORIGINAL).replace(/=+$/, '');

            // encoder userPrivateKey avec userRestoreKey pour ensuite envoyer au serveur
            // Clé de récupération 
            const userRestoreKey = b64NoPadding(sodium.randombytes_buf(32));
            const userRestoreKeyBytes = sodium.from_base64(
                userRestoreKey,
                sodium.base64_variants.ORIGINAL_NO_PADDING
            );

            // encoder userPrivateKey avec userRestoreKey pour ensuite envoyer au serveur
            const privateKeyBytesForRecovery = Uint8Array.from(atob(keyPair.privateKey), c => c.charCodeAt(0));
            const noncePrivKeyRecovery = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
            const encryptedPrivateKeyBlobRecovery = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
                privateKeyBytesForRecovery,
                null,
                null,
                noncePrivKeyRecovery,
                userRestoreKeyBytes // <--- clé décodée (32 bytes)
            );
            const finalEncryptedPrivateKeyForRecovery = new Uint8Array([...noncePrivKeyRecovery, ...encryptedPrivateKeyBlobRecovery]);

            // --- 6. PRÉPARATION DU PAYLOAD ---
            const payload = {
                first_name: firstName,
                last_name: lastName,
                email,
                password, // Envoyer en clair (sur HTTPS) pour que le serveur hash pour l'auth, ou envoyer le hash selon ton back
                
                // Les sels
                salt_e2e: b64NoPadding(salt_e2e),
                salt_auth: b64NoPadding(salt_auth),
                
                // Clé de récupération - ici on met du dummy random pour l'exemple
                storage_key_encrypted_recuperation: b64(finalEncryptedPrivateKeyForRecovery),
                
                // Le dossier racine chiffré par la clé principale
                folder_key_encrypted: b64(finalRootFolderKey),
                folder_metadata_encrypted: b64(finalRootMetadata),

                // Clés asymétriques
                public_key: publicKeyToSend,
                private_key_encrypted: b64(finalEncryptedPrivateKey),
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


            // creation d'un ficher .key contenant la clée de récupération
            const element = document.createElement("a");
            const file = new Blob([userRestoreKey], {type: 'text/plain'});
            element.href = URL.createObjectURL(file);
            element.download = "gauzian_recovery_key.key";
            
            // téléchargement automatique
            document.body.appendChild(element); // Nécessaire pour Firefox
            element.click();
            document.body.removeChild(element);
                        
            // Optionnel : Auto-login ou redirection vers /login
            window.location.href = '/login';

        } catch (err) {
            console.error(err);
            setIsRequestGood(false);
            setIsLoadingPage(false);
            setMessage({ type: 'error', text: err.message });
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="page">
            <div className="left-panel">
                <Gauzial lookAway={showPassword || showConfirmPassword} isUnhappy={(!isEmailValid && email.length > 0) || (!isPasswordValid && password.length > 0) || (!isPasswordMatch && confirmPassword.length > 0) || !isRequestGood} isRequestGood={isRequestGood} isLoadingPage={isLoadingPage} />
                <div className="branding">
                    <h2>Gauzian</h2>
                    <p>Votre espace sécurisé</p>
                </div>
            </div>

            <div className="right-panel">
                <div className="card">
                    <div className="header">
                        <h1>Rejoignez-nous</h1>
                        <p className="subtitle">Créez votre compte sécurisé</p>
                    </div>

                    {message && (
                        <div className={`alert ${message.type === 'error' ? 'err' : 'ok'}`}>{message.text}</div>
                    )}

                    <form onSubmit={handleSubmit} className="form" style={{ opacity: isLoadingPage ? 0.5 : 1, pointerEvents: isLoadingPage ? 'none' : 'auto' }}>
                        <div className="form-row">
                            <div className="input-group">
                                <label>Prénom</label>
                                <input 
                                    type="text"
                                    value={firstName} 
                                    onChange={(e) => setFirstName(e.target.value)} 
                                    disabled={loading || isLoadingPage} 
                                    placeholder="Jean"
                                    required 
                                />
                            </div>

                            <div className="input-group">
                                <label>Nom</label>
                                <input 
                                    type="text"
                                    value={lastName} 
                                    onChange={(e) => setLastName(e.target.value)} 
                                    disabled={loading || isLoadingPage} 
                                    placeholder="Dupont"
                                    required 
                                />
                            </div>
                        </div>

                        <div className="input-group">
                            <label>Email</label>
                            <input 
                                type="email" 
                                value={email} 
                                onChange={handleEmailChange}
                                disabled={loading || isLoadingPage} 
                                placeholder="votre@email.com"
                                className={!validateEmail(email) && email.length > 0 ? 'input-error' : ''}
                                required 
                            />
                            {!validateEmail(email) && email.length > 0 && (
                                <span className="error-text">❌ Email invalide</span>
                            )}
                        </div>

                        <div className="input-group">
                            <label>Mot de passe</label>
                            <div className="password-wrapper">
                                <input 
                                    type={showPassword ? "text" : "password"}
                                    value={password} 
                                    onChange={handlePasswordChange}
                                    disabled={loading || isLoadingPage} 
                                    placeholder="••••••••"
                                    className={!validatePassword(password) && password.length > 0 ? 'input-error' : ''}
                                    required 
                                    minLength={6} 
                                />
                                <button 
                                    type="button" 
                                    className="toggle-password"
                                    onClick={() => {
                                        setShowPassword(!showPassword);
                                        
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
                            <span className="helper-text">Minimum 8 caractères, 1 majuscule, 1 chiffre, 1 caractère spécial</span>
                            {!validatePassword(password) && password.length > 0 && (
                                <span className="error-text">❌ Mot de passe non valide</span>
                            )}
                        </div>

                        <div className="input-group">
                            <label>Confirmer le mot de passe</label>
                            <div className="password-wrapper">
                                <input 
                                    type={showConfirmPassword ? "text" : "password"}
                                    value={confirmPassword} 
                                    onChange={handleConfirmPasswordChange}
                                    disabled={loading || isLoadingPage} 
                                    placeholder="••••••••"
                                    className={!isPasswordMatch && confirmPassword.length > 0 ? 'input-error' : ''}
                                    required 
                                    minLength={6} 
                                />
                                <button 
                                    type="button" 
                                    className="toggle-password"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    disabled={loading || isLoadingPage}
                                    aria-label={showConfirmPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                                >
                                    {showConfirmPassword ? (
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
                            {!isPasswordMatch && confirmPassword.length > 0 && (
                                <span className="error-text">❌ Les mots de passe ne correspondent pas</span>
                            )}
                        </div>

                        <button type="submit" className="submit-btn" disabled={loading || isLoadingPage}>
                            {loading ? 'Inscription en cours…' : 'S\'inscrire'}
                        </button>
                        
                        <div className="links login-btn">
                            <button 
                                type="button" 
                                className="link"
                                onClick={() => router.push('/login')}
                            >
                                Retour à la connexion
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
                    margin: 0;
                    font-size: 1rem;
                }

                .header {
                    margin-bottom: 2rem;
                }

                .form {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }

                .form-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1rem;
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

                .password-wrapper {
                    position: relative;
                    width: 100%;
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

                .helper-text {
                    font-size: 0.8rem;
                    color: #334155;
                    margin-top: -0.3rem;
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
                    background: none;
                    border: none;
                    cursor: pointer;
                    font-size: 1rem;
                    font-family: inherit;
                }

                .link:hover {
                    color: #FDBA74;
                    text-decoration: underline;
                }

                .login-btn {
                    margin-top: 2rem;
                    padding-top: 2rem;
                    border-top: 1px solid #E2E8F0;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 0.75rem;
                }

                .login-btn .link {
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

                .login-btn .link:hover {
                    background: linear-gradient(135deg, #F97316 0%, #FDBA74 100%);
                    color: white;
                    text-decoration: none;
                    transform: translateY(-2px);
                    box-shadow: 0 6px 16px rgba(249, 115, 22, 0.3);
                    border-color: #F97316;
                }

                .login-btn .link:active {
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

                .helper-text {
                    color: #A0AEC0;
                    font-size: 0.875rem;
                    margin-top: 0.25rem;
                    display: block;
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

                    .form-row {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
        </main>
    );
}
