import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Gauzial from '../components/gauzial';

export default function RecoveryKeyPage() {
    const router = useRouter();
    const [recoveryKey, setRecoveryKey] = useState('');
    const [shareUrl, setShareUrl] = useState('');
    const [qrDataUrl, setQrDataUrl] = useState('');
    const [status, setStatus] = useState({ type: 'warning', text: "Sauvegardez cette cle avant de continuer." });
    const [hasInteracted, setHasInteracted] = useState(false);
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const storedKey = sessionStorage.getItem('gauzian_recovery_key');
        if (!storedKey) {
            setStatus({ type: 'error', text: "Impossible de charger la cle de recuperation. Reprenez l'inscription." });
            return;
        }

        setRecoveryKey(storedKey);
        const url = `${window.location.origin}/recover#k=${encodeURIComponent(storedKey)}`;
        setShareUrl(url);

        const generateQR = async () => {
            try {
                const QRCode = await import('qrcode');
                const dataUrl = await QRCode.toDataURL(url);
                setQrDataUrl(dataUrl);
            } catch (err) {
                setStatus({ type: 'error', text: 'Generation du QR code impossible. Copiez la cle ou telechargez-la.' });
            }
        };

        generateQR();
    }, []);

    const markInteraction = () => setHasInteracted(true);

    const copyKey = async () => {
        try {
            await navigator.clipboard.writeText(recoveryKey);
            setStatus({ type: 'success', text: 'Cle copiee dans le presse-papiers.' });
            markInteraction();
        } catch (err) {
            setStatus({ type: 'error', text: "Impossible de copier la cle. Essayez a nouveau." });
        }
    };

    const downloadKeyFile = () => {
        const element = document.createElement('a');
        const file = new Blob([recoveryKey], { type: 'text/plain' });
        element.href = URL.createObjectURL(file);
        element.download = 'gauzian_recovery_key.key';
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
        markInteraction();
        setStatus({ type: 'success', text: 'Fichier .key telecharge.' });
    };

    const downloadPdf = () => {
        try {
            const htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>Gauzian - Cle de recuperation</title>
                    <style>
                        * { margin: 0; padding: 0; box-sizing: border-box; }
                        body { font-family: Arial, sans-serif; background: white; }
                        .container { max-width: 800px; margin: 0 auto; padding: 40px; background: white; }
                        .header { text-align: center; margin-bottom: 40px; }
                        .logo { font-size: 36px; font-weight: bold; color: #0B1120; margin-bottom: 10px; }
                        .subtitle { color: #666; font-size: 14px; }
                        .warning { background: #FEF2F2; border: 2px solid #EF4444; border-radius: 10px; padding: 20px; margin: 30px 0; color: #991B1B; }
                        .warning-title { font-weight: bold; font-size: 16px; margin-bottom: 10px; }
                        .section { margin: 30px 0; }
                        .section-title { font-weight: bold; font-size: 14px; color: #0B1120; margin-bottom: 10px; border-bottom: 2px solid #F97316; padding-bottom: 5px; }
                        .key-box { background: #f5f5f5; border: 1px solid #ddd; padding: 15px; border-radius: 8px; font-family: monospace; word-break: break-all; font-size: 12px; line-height: 1.6; }
                        .url-box { background: #f5f5f5; border: 1px solid #ddd; padding: 15px; border-radius: 8px; font-family: monospace; word-break: break-all; font-size: 11px; line-height: 1.4; }
                        .qr-section { margin-top: 40px; display: flex; flex-direction: column; align-items: center; }
                        .qr-img { max-width: 250px; height: auto; border: 2px solid #ddd; padding: 10px; background: white; }
                        .footer { margin-top: 50px; text-align: center; color: #999; font-size: 12px; border-top: 1px solid #ddd; padding-top: 20px; }
                        @media print { body { margin: 0; padding: 0; } }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <div class="logo">Gauzian</div>
                            <div class="subtitle">Votre coffre-fort chiffre</div>
                        </div>
                        
                        <div class="warning">
                            <div class="warning-title">IMPORTANT - Conservez cette cle !</div>
                            <p>Cette cle de recuperation est la SEULE facon de recuperer vos donnees si vous perdez votre mot de passe. Sans cette cle, vos donnees sont definitivement perdues. Ne la partagez pas et gardez-la en lieu sur.</p>
                        </div>
                        
                        <div class="section">
                            <div class="section-title">Cle de recuperation</div>
                            <div class="key-box">${recoveryKey}</div>
                        </div>
                        
                        <div class="section">
                            <div class="section-title">URL de restauration (avec #k=)</div>
                            <div class="url-box">${shareUrl}</div>
                        </div>
                        
                        <div class="qr-section">
                            <div class="section-title">Code QR</div>
                            <p style="text-align: center; margin: 10px 0; font-size: 12px; color: #666;">Scannez ce code pour acceder a la page de restauration</p>
                            <img src="${qrDataUrl}" alt="QR code" class="qr-img" />
                        </div>
                        
                        <div class="footer">
                            Document genere le ${new Date().toLocaleDateString('fr-FR')} a ${new Date().toLocaleTimeString('fr-FR')}
                        </div>
                    </div>
                </body>
                </html>
            `;
            
            const blob = new Blob([htmlContent], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const printWindow = window.open(url, '_blank');
            
            setTimeout(() => {
                printWindow.print();
            }, 250);
            
            markInteraction();
            setStatus({ type: 'success', text: 'PDF pret a imprimer. Utilisez Ctrl+P pour sauvegarder.' });
        } catch (err) {
            console.error(err);
            setStatus({ type: 'error', text: "Erreur lors de la generation du PDF." });
        }
    };

    const handleContinue = () => {
        if (!hasInteracted) {
            setStatus({ type: 'error', text: "Sauvegardez ou copiez la cle avant de continuer." });
            return;
        }
        if (typeof window !== 'undefined') {
            sessionStorage.removeItem('gauzian_recovery_key');
        }
        router.push('/login');
    };

    const handleBackToRegister = () => {
        router.push('/register');
    };

    const statusClass = status?.type === 'error' ? 'err' : status?.type === 'success' ? 'ok' : 'warn';

    return (
        <main className="page">
            <div className="left-panel">
                <Gauzial isUnhappy={status.type === 'error'} lookAway={false} isRequestGood={status.type !== 'error'} isLoadingPage={false} />
                <div className="branding">
                    <h2>Gauzian</h2>
                    <p>Votre coffre-fort chiffre</p>
                </div>
            </div>

            <div className="right-panel">
                <div className="card">
                    <div className="header">
                        <h1>Conservez votre clé</h1>
                        <p className="subtitle">Cette clé est la seule façon de récupérer vos données.</p>
                    </div>

                    {status?.text && (
                        <div className={`alert ${statusClass}`}>{status.text}</div>
                    )}

                    {!recoveryKey && (
                        <div className="empty">
                            <p>Aucune clé à afficher.</p>
                            <button className="secondary" onClick={handleBackToRegister}>Retour à l'inscription</button>
                        </div>
                    )}

                    {recoveryKey && (
                        <div className="content">
                            <section className="warning">
                                <h3>Avant d'aller plus loin</h3>
                                <p>Sans cette clé, si vous perdez votre mot de passe, vos données sont définitivement perdues.</p>
                            </section>

                            <section className="key-block">
                                <div className="key-text">{recoveryKey}</div>
                                <div className="actions">
                                    <button onClick={copyKey} className="primary">Copier la clé</button>
                                    <button onClick={downloadPdf} className="accent">Télécharger en PDF (recommandé)</button>
                                    <button onClick={downloadKeyFile} className="secondary">Télécharger .key</button>
                                </div>
                            </section>

                            {/* <section className="qr">
                                <div className="qr-info">
                                    <h3>QR code avec #k=</h3>
                                    <p>Scannez ou partagez ce QR code. L'URL contient la cle dans le fragment #k= pour une importation rapide.</p>
                                    {shareUrl && <p className="share-url">{shareUrl}</p>}
                                </div>
                                <div className="qr-visual">
                                    {qrDataUrl ? <img src={qrDataUrl} alt="QR code de la cle" /> : <div className="qr-placeholder">QR en cours...</div>}
                                </div>
                            </section> */}

                            <div className="cta">
                                <button className="primary large" onClick={handleContinue} disabled={!hasInteracted}>J'ai sauvegardé ma clé, continuer</button>
                                <p className="note">Vous devez copier ou télécharger la clé avant de continuer.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <style jsx>{`
                .page {
                    min-height: 100vh;
                    display: flex;
                    background-color: #F8FAFC;
                }
                section{
                    height: auto;}

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

                .warning {
                    background: #FEF3C7;
                    border: 2px solid #FBBF24;
                    border-radius: 12px;
                    padding: 1rem 1.25rem;
                    margin-bottom: 1.5rem;
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .warning h3 {
                    margin: 0 0 0.4rem;
                    color: #92400E;
                    font-size: 1rem;
                    font-weight: 600;
                }

                .warning p {
                    margin: 0;
                    color: #78350F;
                    line-height: 1.5;
                    font-size: 0.9rem;
                }

                .key-block {
                    background: #F8FAFC;
                    border: 2px solid #E2E8F0;
                    border-radius: 12px;
                    padding: 1rem;
                    margin-bottom: 1.5rem;
                }

                .key-text {
                    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
                    background: white;
                    color: #0B1120;
                    padding: 1rem;
                    border-radius: 10px;
                    word-break: break-all;
                    border: 1px solid #E2E8F0;
                    font-size: 0.85rem;
                    line-height: 1.5;
                }

                .actions {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 0.75rem;
                    margin-top: 1rem;
                }

                .qr {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                    background: #F8FAFC;
                    border: 2px solid #E2E8F0;
                    border-radius: 12px;
                    padding: 1.5rem;
                    margin-bottom: 1.5rem;
                }

                .qr-info h3 {
                    margin: 0 0 0.4rem;
                    color: #0B1120;
                    font-size: 1rem;
                    font-weight: 600;
                }

                .qr-info p {
                    margin: 0 0 0.4rem;
                    color: #334155;
                    line-height: 1.4;
                    font-size: 0.9rem;
                }

                .share-url {
                    font-size: 0.8rem;
                    word-break: break-all;
                    background: white;
                    padding: 0.75rem;
                    border-radius: 8px;
                    border: 1px solid #E2E8F0;
                    color: #475569;
                    font-family: monospace;
                }

                .qr-visual {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }

                .qr-visual img {
                    width: 220px;
                    height: 220px;
                    background: white;
                    padding: 0.5rem;
                    border-radius: 12px;
                    box-shadow: 0 4px 12px rgba(11, 17, 32, 0.08);
                    border: 2px solid #E2E8F0;
                }

                .qr-placeholder {
                    width: 220px;
                    height: 220px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: white;
                    border-radius: 12px;
                    color: #94A3B8;
                    border: 2px dashed #E2E8F0;
                }

                .content {
                    display: flex;
                    flex-direction: column;
                    gap: 0;
                }

                .cta {
                    margin-top: 1.5rem;
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .note {
                    margin: 0.5rem 0 0;
                    color: #64748B;
                    font-size: 0.875rem;
                }

                .primary,
                .accent,
                .secondary {
                    border: none;
                    border-radius: 12px;
                    padding: 1rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    font-size: 1rem;
                    font-family: inherit;
                }

                .primary {
                    background: linear-gradient(135deg, #F97316 0%, #FDBA74 100%);
                    color: white;
                    box-shadow: 0 4px 12px rgba(249, 115, 22, 0.3);
                }

                .primary:hover:not(:disabled) {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 16px rgba(249, 115, 22, 0.4);
                }

                .primary:active:not(:disabled) {
                    transform: translateY(0);
                }

                .accent {
                    background: linear-gradient(135deg, #0EA5E9 0%, #38BDF8 100%);
                    color: white;
                    box-shadow: 0 4px 12px rgba(14, 165, 233, 0.3);
                }

                .accent:hover:not(:disabled) {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 16px rgba(14, 165, 233, 0.4);
                }

                .secondary {
                    background: transparent;
                    border: 2px solid #E2E8F0;
                    color: #334155;
                }

                .secondary:hover:not(:disabled) {
                    background: #F8FAFC;
                    border-color: #F97316;
                    transform: translateY(-2px);
                }

                .primary.large {
                    width: 100%;
                    text-align: center;
                }
                button:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                    transform: none;
                    box-shadow: none;
                }

                .empty {
                    text-align: center;
                    color: #334155;
                }

                .empty p {
                    margin-bottom: 1rem;
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

                    .qr {
                        flex-direction: column;
                    }

                    .actions {
                        grid-template-columns: 1fr;
                    }

                    .qr-visual img,
                    .qr-placeholder {
                        width: 180px;
                        height: 180px;
                    }
                }
            `}</style>
        </main>
    );
}
