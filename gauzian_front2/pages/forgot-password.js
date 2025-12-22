import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Script from 'next/script';
import Gauzial from '../components/gauzial';

const bufToB64 = (buf) => {
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
};

const decodeRecoveryKeyBytes = (sodium, recoveryKeyRaw) => {
    const normalize = (val) => String(val || '').replace(/\s+/g, '');
    const normalized = normalize(recoveryKeyRaw).replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    try {
        return sodium.from_base64(normalized, sodium.base64_variants.ORIGINAL_NO_PADDING);
    } catch (e1) {
        try {
            return sodium.from_base64(padded, sodium.base64_variants.ORIGINAL);
        } catch (e2) {
            return sodium.from_base64(normalized, sodium.base64_variants.URLSAFE_NO_PADDING);
        }
    }
};

export default function ForgotPasswordPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [recoveryKey, setRecoveryKey] = useState('');
    const [recoveryFile, setRecoveryFile] = useState(null);
    const [message, setMessage] = useState(null);
    const [loading, setLoading] = useState(false);
    const [isEmailValid, setIsEmailValid] = useState(false);
    const [phase, setPhase] = useState('verify');
    const [recoveryAuthProof, setRecoveryAuthProof] = useState('');
    const [decryptedPrivateKeyB64, setDecryptedPrivateKeyB64] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isPasswordValid, setIsPasswordValid] = useState(false);
    const [isPasswordMatch, setIsPasswordMatch] = useState(true);

    const validateEmail = (value) => {
        if (value === '') return false;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(value);
    };

    const validatePassword = (value) => {
        return /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(value);
    };

    useEffect(() => {
        setIsEmailValid(validateEmail(email));
    }, [email]);

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        setRecoveryFile(file || null);
        if (file) {
            setRecoveryKey('');
        }
    };

    const handleKeyChange = (value) => {
        setRecoveryKey(value);
        if (value) {
            setRecoveryFile(null);
        }
    };

    const handleNewPasswordChange = (value) => {
        setNewPassword(value);
        setIsPasswordValid(validatePassword(value));
        if (confirmPassword) {
            setIsPasswordMatch(value === confirmPassword);
        }
    };

    const handleConfirmPasswordChange = (value) => {
        setConfirmPassword(value);
        setIsPasswordMatch(value === newPassword);
    };

    const readFileAsText = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    };

    const decryptPrivateKeyWithRecoveryKey = async (encryptedKeyB64, recoveryKeyRaw, sourceLabel = 'unknown') => {
        const sodiumLib = await import('libsodium-wrappers-sumo');
        const sodium = sodiumLib.default || sodiumLib;
        await sodium.ready;

        const normalize = (val) => String(val || '').replace(/\s+/g, '');

        const decodeCipher = () => {
            const normalized = normalize(encryptedKeyB64).replace(/-/g, '+').replace(/_/g, '/');
            const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
            try {
                return sodium.from_base64(padded, sodium.base64_variants.ORIGINAL);
            } catch (e1) {
                try {
                    return sodium.from_base64(normalized, sodium.base64_variants.ORIGINAL_NO_PADDING);
                } catch (e2) {
                    return sodium.from_base64(normalized, sodium.base64_variants.URLSAFE_NO_PADDING);
                }
            }
        };

        const encryptedBytes = decodeCipher();
        const nonceLength = sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES;
        if (!encryptedBytes || encryptedBytes.length <= nonceLength) {
            throw new Error('Clé chiffrée invalide renvoyée par le serveur.');
        }

        const nonce = encryptedBytes.slice(0, nonceLength);
        const ciphertext = encryptedBytes.slice(nonceLength);

        const recoveryKeyBytes = decodeRecoveryKeyBytes(sodium, recoveryKeyRaw);
        if (recoveryKeyBytes.length !== 32) {
            throw new Error('Clé de récupération invalide.');
        }

        try {
            const decrypted = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
                null,
                ciphertext,
                null,
                nonce,
                recoveryKeyBytes
            );
            return bufToB64(decrypted);
        } catch (e) {
            const info = `source=${sourceLabel}, cipherLen=${encryptedBytes.length}, keyLen=${recoveryKeyBytes.length}`;
            throw new Error(`Impossible de déchiffrer la clé (${info}).`);
        }
    };

    // FONCTION DE PARSING (100% Client-side)
    const parsePdf = async (file) => {
        // On utilise l'objet chargé globalement par le script
        const pdfjsLib = window['pdfjs-dist/build/pdf'];
        
        // Configuration du worker (obligatoire)
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(s => s.str).join(' ');
            fullText += pageText + '\n';
        }
        return fullText;
    };

    const deriveRecoveryProof = (sodium, recoveryKeyRaw, saltB64) => {
        const saltNormalized = (saltB64 || '').replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
        const saltPad = saltNormalized.length % 4;
        const saltPadded = saltPad ? saltNormalized + '='.repeat(4 - saltPad) : saltNormalized;
        const saltBytes = sodium.from_base64(saltPadded, sodium.base64_variants.ORIGINAL);
        const keyBytes = decodeRecoveryKeyBytes(sodium, recoveryKeyRaw);
        const proof = sodium.crypto_generichash(32, new Uint8Array([...keyBytes, ...saltBytes]));
        return sodium
            .to_base64(proof, sodium.base64_variants.ORIGINAL)
            .replace(/=+$/, '');
    };

    const fetchRecoverySalt = async (email) => {
        const res = await fetch('/api/auth/recovery/challenge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        });

        const data = await res.json();
        if (!res.ok) {
            throw new Error(data?.message || 'Impossible de récupérer le challenge.');
        }

        if (!data?.recovery_salt) {
            throw new Error('Challenge de récupération incomplet.');
        }

        return data.recovery_salt;
    };

    const requestRecoveryCipher = async (email, recoveryAuth) => {
        const res = await fetch('/api/auth/recovery/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, recovery_auth: recoveryAuth }),
        });

        const data = await res.json();
        if (!res.ok) {
            throw new Error(data?.message || "Preuve de récupération invalide.");
        }

        const encryptedKey = data?.private_key_encrypted_recuperation;
        if (!encryptedKey) {
            throw new Error('Aucune clé chiffrée retournée par le serveur.');
        }

        return encryptedKey;
    };

    const handleVerifySubmit = async (e) => {
        e.preventDefault();
        setMessage(null);

        if (!isEmailValid || (!recoveryKey && !recoveryFile)) {
            setMessage({ type: 'error', text: 'Renseignez un email valide et votre cle ou fichier.' });
            return;
        }

        setLoading(true);

        try {
            let payloadKey = recoveryKey.replace(/\s+/g, '').trim();
            if (payloadKey && payloadKey.length < 40) {
                throw new Error('Clé de récupération trop courte ou invalide.');
            }

            if (recoveryFile && !payloadKey) {
                if (recoveryFile.type === 'application/pdf') {
                    const pdfText = await parsePdf(recoveryFile);
                    payloadKey = pdfText.trim();
                    const keyMatch = pdfText.match(/(Cl[eé] de r[eé]cup[eé]ration)\s+([A-Za-z0-9+/=_-]{32,})/i);
                    if (keyMatch && (keyMatch[2] || keyMatch[1])) {
                        payloadKey = (keyMatch[2] || keyMatch[1]).replace(/\s+/g, '').trim();
                    } else {
                        throw new Error('Cle de recuperation non trouvee dans le PDF.');
                    }
                } else {
                    const fileContent = await readFileAsText(recoveryFile);
                    payloadKey = fileContent?.toString().replace(/\s+/g, '').trim();
                }
            }

            if (!payloadKey) {
                throw new Error('Impossible de lire la cle depuis le fichier.');
            }

            const sodiumLib = await import('libsodium-wrappers-sumo');
            const sodium = sodiumLib.default || sodiumLib;
            await sodium.ready;

            const challengeSalt = await fetchRecoverySalt(email);
            const proof = deriveRecoveryProof(sodium, payloadKey, challengeSalt);
            const encryptedKeyFromServer = await requestRecoveryCipher(email, proof);

            const decryptedPrivateKeyB64 = await decryptPrivateKeyWithRecoveryKey(
                encryptedKeyFromServer,
                payloadKey,
                'private_key_encrypted_recuperation'
            );

            setRecoveryAuthProof(proof);
            setDecryptedPrivateKeyB64(decryptedPrivateKeyB64);
            setPhase('reset');
            setMessage({
                type: 'success',
                text: 'Clé validée. Choisissez un nouveau mot de passe.',
            });
        } catch (err) {
            setMessage({ type: 'error', text: err.message || 'Erreur lors de la préparation de la demande.' });
        } finally {
            setLoading(false);
        }
    };

    const handleResetSubmit = async (e) => {
        e.preventDefault();
        setMessage(null);

        if (!decryptedPrivateKeyB64 || !recoveryAuthProof) {
            setMessage({ type: 'error', text: 'Validez d’abord votre clé de récupération.' });
            return;
        }

        if (!validatePassword(newPassword) || !isPasswordMatch) {
            setMessage({ type: 'error', text: 'Mot de passe invalide ou non confirmé.' });
            return;
        }

        setLoading(true);

        try {
            const sodiumLib = await import('libsodium-wrappers-sumo');
            const sodium = sodiumLib.default || sodiumLib;
            await sodium.ready;

            const enc = new TextEncoder();
            const saltAuth = sodium.randombytes_buf(16);
            const saltE2e = sodium.randombytes_buf(16);
            const passwordBytes = enc.encode(newPassword);

            const encryptedPassword = sodium.crypto_pwhash(
                32,
                passwordBytes,
                saltAuth,
                sodium.crypto_pwhash_OPSLIMIT_MODERATE,
                sodium.crypto_pwhash_MEMLIMIT_MODERATE,
                sodium.crypto_pwhash_ALG_ARGON2ID13
            );

            const derivedKey = sodium.crypto_pwhash(
                32,
                encryptedPassword,
                saltE2e,
                sodium.crypto_pwhash_OPSLIMIT_MODERATE,
                sodium.crypto_pwhash_MEMLIMIT_MODERATE,
                sodium.crypto_pwhash_ALG_ARGON2ID13
            );

            const userMasterKey = sodium.crypto_generichash(32, derivedKey);

            const privateKeyBytes = Uint8Array.from(atob(decryptedPrivateKeyB64), c => c.charCodeAt(0));
            const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
            const encryptedPrivateKeyBlob = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
                privateKeyBytes,
                null,
                null,
                nonce,
                userMasterKey
            );
            const finalEncryptedPrivateKey = new Uint8Array([...nonce, ...encryptedPrivateKeyBlob]);


            const b64 = (u8) => sodium.to_base64(u8, sodium.base64_variants.ORIGINAL);
            const b64NoPadding = (u8) => sodium.to_base64(u8, sodium.base64_variants.ORIGINAL).replace(/=+$/, '');

            // génération


            // generation du payload

            // Générer une nouvelle clé de récupération et le matériel associé
            const newRecoveryKeyBytes = sodium.randombytes_buf(32);
            const newRecoveryKey = b64NoPadding(newRecoveryKeyBytes);

            const newRecoverySalt = sodium.randombytes_buf(16);
            const newRecoverySaltB64 = b64NoPadding(newRecoverySalt);
            const newRecoveryProof = deriveRecoveryProof(sodium, newRecoveryKey, newRecoverySaltB64);

            // Chiffrer la clé privée pour la récupération
            const newRecoveryNonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
            const encryptedForRecovery = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
                privateKeyBytes,
                null,
                null,
                newRecoveryNonce,
                newRecoveryKeyBytes
            );
            const finalRecoveryCipher = new Uint8Array([...newRecoveryNonce, ...encryptedForRecovery]);

            const payload = {
                email,
                recovery_auth: recoveryAuthProof,
                new_password: newPassword,
                salt_auth: b64NoPadding(saltAuth),
                salt_e2e: b64NoPadding(saltE2e),
                private_key_encrypted: b64(finalEncryptedPrivateKey),
                private_key_encrypted_recuperation: b64(finalRecoveryCipher),
                new_recovery_salt: newRecoverySaltB64,
                new_recovery_auth: newRecoveryProof,
            };

            const res = await fetch('/api/auth/recovery/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data?.message || 'Erreur lors de la mise à jour du mot de passe.');

            if (typeof window !== 'undefined') {
                sessionStorage.setItem('gauzian_recovery_key', newRecoveryKey);
            }

            setMessage({
                type: 'success',
                text: 'Mot de passe mis à jour. Sauvegardez votre nouvelle clé.',
            });
            setPhase('done');

            router.push('/recovery-key');

        } catch (err) {
            setMessage({ type: 'error', text: err.message || 'Erreur lors de la mise à jour du mot de passe.' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setIsPasswordValid(validatePassword(newPassword));
        setIsPasswordMatch(newPassword === confirmPassword);
    }, [newPassword, confirmPassword]);

    const canSubmit = phase === 'verify' && isEmailValid && (recoveryKey.trim().length > 0 || recoveryFile);
    const canReset = phase !== 'verify' && isPasswordValid && isPasswordMatch && newPassword.length > 0;
    const statusClass = message?.type === 'error' ? 'err' : message?.type === 'success' ? 'ok' : 'warn';

    return (
        <>
            {/* ON CHARGE LA LIB ICI - Elle ne passera PAS par Webpack/Docker build */}
            <Script 
                src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"
                strategy="beforeInteractive" 
            />

            <main className="page">
            <div className="left-panel">
                <Gauzial isUnhappy={message?.type === 'error'} lookAway={false} isRequestGood={message?.type !== 'error'} isLoadingPage={false} />
                <div className="branding">
                    <h2>Gauzian</h2>
                    <p>Votre espace sécurisé</p>
                </div>
            </div>

            <div className="right-panel">
                <div className="card">
                    <div className="header">
                        <h1>Mot de passe oublié</h1>
                        <p className="subtitle">Saisissez votre email et votre cle de récupération (.key ou PDF).</p>
                    </div>

                    {message?.text && (
                        <div className={`alert ${statusClass}`}>{message.text}</div>
                    )}

                    <form onSubmit={handleVerifySubmit} className="form">
                        <div className="input-group">
                            <label>Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="vous@email.com"
                                className={!isEmailValid && email.length > 0 ? 'input-error' : ''}
                                required
                                disabled={phase !== 'verify'}
                            />
                            {!isEmailValid && email.length > 0 && (
                                <span className="error-text">Email invalide</span>
                            )}
                        </div>

                        {phase === 'verify' &&  (
                            <div className="input-group" >
                                <label>Entrer la cle de récupération</label>
                                <textarea
                                    value={recoveryKey}
                                    onChange={(e) => handleKeyChange(e.target.value)}
                                    placeholder="Collez votre cle ici"
                                    rows={3}
                                    disabled={!!recoveryFile || phase !== 'verify'}
                                />
                                <span className="helper-text">Vous pouvez soit coller la cle, soit envoyer le fichier .key ou le PDF.</span>
                            </div>

                            <div className="input-group">
                                <label>Ou importer le fichier (.key ou .pdf)</label>
                                <div className="file-row">
                                    <input
                                        type="file"
                                        accept=".key,.pdf"
                                        onChange={handleFileChange}
                                        aria-label="Importer la cle de recuperation"
                                        disabled={recoveryKey.trim().length > 0 || phase !== 'verify'}
                                    />
                                    {recoveryFile && <span className="file-name">{recoveryFile.name}</span>}
                                </div>
                            </div>

                            <button type="submit" className="submit-btn" disabled={!canSubmit || loading || phase !== 'verify'}>
                                {loading ? 'Préparation...' : 'Valider la récupération'}
                            </button>
                        )}
                    </form>

                    {phase !== 'verify' && (
                        <form onSubmit={handleResetSubmit} className="form secondary-form">
                            <div className="input-group">
                                <label>Nouveau mot de passe</label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => handleNewPasswordChange(e.target.value)}
                                    placeholder="Mot de passe fort"
                                    className={!isPasswordValid && newPassword.length > 0 ? 'input-error' : ''}
                                    required
                                    disabled={phase === 'done'}
                                />
                                {!isPasswordValid && newPassword.length > 0 && (
                                    <span className="error-text">8+ caractères, 1 majuscule, 1 chiffre, 1 spécial.</span>
                                )}
                            </div>

                            <div className="input-group">
                                <label>Confirmer le mot de passe</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => handleConfirmPasswordChange(e.target.value)}
                                    placeholder="Confirmez"
                                    className={!isPasswordMatch && confirmPassword.length > 0 ? 'input-error' : ''}
                                    required
                                    disabled={phase === 'done'}
                                />
                                {!isPasswordMatch && confirmPassword.length > 0 && (
                                    <span className="error-text">Les mots de passe ne correspondent pas.</span>
                                )}
                            </div>

                            <button
                                type="submit"
                                className="submit-btn"
                                disabled={!canReset || loading || phase === 'done'}
                            >
                                {loading ? 'Mise à jour...' : 'Mettre à jour le mot de passe'}
                            </button>
                        </form>
                    )}
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
                    max-width: 540px;
                    background: white;
                    padding: 3rem;
                    border-radius: 20px;
                    box-shadow: 0 10px 40px rgba(11, 17, 32, 0.08);
                }

                .header {
                    margin-bottom: 2rem;
                }

                .header h1 {
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

                .alert {
                    padding: 1rem;
                    border-radius: 12px;
                    margin-bottom: 1.5rem;
                    font-size: 0.95rem;
                }

                .alert.warn { background: #FEF3C7; color: #92400E; border: 1px solid #FDE68A; }
                .alert.err { background: #FEF2F2; color: #991B1B; border: 1px solid #FECACA; }
                .alert.ok { background: #ECFDF5; color: #065F46; border: 1px solid #A7F3D0; }

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

                input,
                textarea {
                    width: 100%;
                    padding: 0.875rem 1rem;
                    border-radius: 12px;
                    border: 2px solid #E2E8F0;
                    background: white;
                    font-size: 1rem;
                    transition: all 0.3s ease;
                    font-family: inherit;
                }

                textarea {
                    resize: vertical;
                    min-height: 100px;
                }

                input:focus,
                textarea:focus {
                    outline: none;
                    border-color: #F97316;
                    box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.1);
                }

                input.input-error {
                    border-color: #EF4444;
                    background-color: #FEF2F2;
                }

                .helper-text {
                    font-size: 0.85rem;
                    color: #64748B;
                }

                .error-text {
                    color: #EF4444;
                    font-size: 0.875rem;
                }

                .file-row {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    flex-wrap: wrap;
                }

                .file-name {
                    font-size: 0.9rem;
                    color: #334155;
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

                .submit-btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
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
                        max-width: 100%;
                    }

                    .header h1 {
                        font-size: 1.8rem;
                    }
                }
            `}</style>
        </main>
        </>
    );
}
