import { useState, useEffect } from 'react';
import Gauzial from '../components/gauzial';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [recoveryKey, setRecoveryKey] = useState('');
    const [recoveryFile, setRecoveryFile] = useState(null);
    const [message, setMessage] = useState(null);
    const [loading, setLoading] = useState(false);
    const [isEmailValid, setIsEmailValid] = useState(false);

    const validateEmail = (value) => {
        if (value === '') return false;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(value);
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

    const readFileAsText = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage(null);

        if (!isEmailValid || (!recoveryKey && !recoveryFile)) {
            setMessage({ type: 'error', text: 'Renseignez un email valide et votre cle ou fichier.' });
            return;
        }

        setLoading(true);

        try {
            let payloadKey = recoveryKey.trim();
            if (recoveryFile && !payloadKey) {
                const fileContent = await readFileAsText(recoveryFile);
                payloadKey = fileContent?.toString().trim();
            }

            if (!payloadKey) {
                throw new Error('Impossible de lire la cle depuis le fichier.');
            }

            // TODO: brancher sur l'API de reinitialisation quand disponible
            console.log('Forgot password payload', { email, recovery_key: payloadKey });
            setMessage({ type: 'success', text: 'Demande prête à être envoyée. Branchez l’appel API de réinitialisation.' });
        } catch (err) {
            setMessage({ type: 'error', text: err.message || 'Erreur lors de la preparation de la demande.' });
        } finally {
            setLoading(false);
        }
    };

    const canSubmit = isEmailValid && (recoveryKey.trim().length > 0 || recoveryFile);
    const statusClass = message?.type === 'error' ? 'err' : message?.type === 'success' ? 'ok' : 'warn';

    return (
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

                    <form onSubmit={handleSubmit} className="form">
                        <div className="input-group">
                            <label>Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="vous@email.com"
                                className={!isEmailValid && email.length > 0 ? 'input-error' : ''}
                                required
                            />
                            {!isEmailValid && email.length > 0 && (
                                <span className="error-text">Email invalide</span>
                            )}
                        </div>

                        <div className="input-group">
                            <label>Entrer la cle de récupération</label>
                            <textarea
                                value={recoveryKey}
                                onChange={(e) => handleKeyChange(e.target.value)}
                                placeholder="Collez votre cle ici"
                                rows={3}
                                disabled={!!recoveryFile}
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
                                    disabled={recoveryKey.trim().length > 0}
                                />
                                {recoveryFile && <span className="file-name">{recoveryFile.name}</span>}
                            </div>
                        </div>

                        <button type="submit" className="submit-btn" disabled={!canSubmit || loading}>
                            {loading ? 'Préparation...' : 'Valider la récupération'}
                        </button>
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
    );
}
