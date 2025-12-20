import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Header from '../components/header.js';


export default function ProfilePage() {
    const router = useRouter();
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview'); // overview, account, security, storage

    // Stats
    const [stats, setStats] = useState({});

    const refreshAccessToken = async () => {
        try {
            const res = await fetch('/api/auth/refresh', {
                method: 'POST',
                credentials: 'include',
            });
            return res.ok;
        } catch (err) {
            console.error('Refresh token request failed', err);
            return false;
        }
    };

    const fetchWithRefresh = async (url, options = {}, attempt = 0) => {
        const response = await fetch(url, {
            credentials: 'include',
            ...options,
        });

        if (response.status === 401 && attempt === 0) {
            const refreshed = await refreshAccessToken();
            if (refreshed) {
                return fetchWithRefresh(url, options, 1);
            }
        }

        return response;
    };

    useEffect(() => {
        const userPublicKey = localStorage.getItem('publicKey');
        const userPrivateKey = localStorage.getItem('privateKey');

        if (!userPublicKey || !storageKey) {
            router.push('/login');
            return;
        }
        fetchUserData(userPrivateKey);
    }, []);

    const fetchUserData = async (userPrivateKey) => {
        try {
            const response = await fetchWithRefresh('/api/auth/info', {});

            if (response.status === 401) {
                router.push('/login');
                return;
            }

            if (response.ok) {
                const data = await response.json();
                setUserData(data.user_info);
                let octet_limit = data.user_info.storageLimit || 1;
                octet_limit = octet_limit * 1024 * 1024 * 1024; // Convertir en octets
                setStats({
                    filesCount: data.user_info.nbFiles || 0,
                    foldersCount: data.user_info.nbFolders || 0,
                    storageUsed: data.user_info.storageUsed || 0,
                    storageTotal: octet_limit, // 1 Go par défaut
                    storageByFileType: data.user_info.storageByFileType || {}
                });
                console.log("Données utilisateur récupérées :", data.user_info);
            }
        } catch (error) {
            console.error('Erreur lors de la récupération du profil:', error);
            setUserData({
                firstName: 'Jean',
                lastName: 'Dupont',
                email: 'jean.dupont@example.com',
                createdAt: new Date().toISOString()
            });
        } finally {
            setLoading(false);
        }
    };

    const fetchStorageStats = async () => {
        try {
            const response = await fetchWithRefresh('/api/storage/stats', {});

            if (response.status === 401) {
                router.push('/login');
                return;
            }

            if (response.ok) {
                const data = await response.json();
                setStats(data);
            }
        } catch (error) {
            console.error('Erreur lors de la récupération des stats:', error);
            setStats({
                filesCount: 24,
                foldersCount: 8,
                storageUsed: 1073741824, // 1 GB
                storageTotal: 5368709120 // 5 GB
            });
        }
    };

    const handleLogout = () => {
        // Supprimer les tokens d'authentification
        fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include',
        }).finally(() => {
            localStorage.removeItem('publicKey');
            localStorage.removeItem('privateKey');
            router.push('/login');
        });
    };

    const formatBytes = (bytes) => {
        if (bytes === 0) return '0 Octets';
        const k = 1024;
        const sizes = ['Octets', 'Ko', 'Mo', 'Go', 'To'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    };

    const storagePercent = ((stats.storageUsed / stats.storageTotal) * 100).toFixed(1);

    if (loading) {
        return (
            <div className="loading-container">
                {/* <Gauzial isLoadingPage={true} /> */}
                <p>Chargement du profil...</p>
                <style jsx>{`
                    .loading-container {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        min-height: 100vh;
                        background: linear-gradient(135deg, #F8FAFC 0%, #E2E8F0 100%);
                    }
                    .loading-container p {
                        margin-top: 2rem;
                        font-size: 1.2rem;
                        color: #334155;
                    }
                `}</style>
            </div>
        );
    }

    return (
        <div className="profile-page">
            {/* Header avec navigation */}
            <Header TITLE="GZPROFILE" userName={`${userData?.firstName} ${userData?.lastName}`}></Header>

            <div className="content-wrapper">
                {/* Sidebar */}
                <aside className="sidebar">
                    <div className="profile-card">
                        <div className="avatar">
                            {userData?.firstName?.charAt(0)}{userData?.lastName?.charAt(0)}
                        </div>
                        <h2>{userData?.firstName} {userData?.lastName}</h2>
                        <p className="email">{userData?.email}</p>
                    </div>
                    <nav className="sidebar-nav">
                        <button
                            className={`sidebar-btn ${activeTab === 'overview' ? 'active' : ''}`}
                            onClick={() => setActiveTab('overview')}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="3" width="7" height="7" />
                                <rect x="14" y="3" width="7" height="7" />
                                <rect x="14" y="14" width="7" height="7" />
                                <rect x="3" y="14" width="7" height="7" />
                            </svg>
                            Vue d'ensemble
                        </button>
                        <button
                            className={`sidebar-btn ${activeTab === 'account' ? 'active' : ''}`}
                            onClick={() => setActiveTab('account')}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                            </svg>
                            Informations du compte
                        </button>
                        <button
                            className={`sidebar-btn ${activeTab === 'security' ? 'active' : ''}`}
                            onClick={() => setActiveTab('security')}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                            Sécurité
                        </button>
                        <button
                            className={`sidebar-btn ${activeTab === 'storage' ? 'active' : ''}`}
                            onClick={() => setActiveTab('storage')}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <ellipse cx="12" cy="5" rx="9" ry="3" />
                                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                            </svg>
                            Stockage
                        </button>
                    </nav>
                </aside>

                {/* Main Content */}
                <main className="main-content">
                    {activeTab === 'overview' && (
                        <div className="tab-content">
                            <h2 className="tab-title">Vue d'ensemble</h2>

                            {/* Quick Stats */}
                            <div className="stats-grid">
                                <div className="stat-card" onClick={() => setActiveTab('storage')}>
                                    <div className="stat-icon files">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                                            <polyline points="13 2 13 9 20 9" />
                                        </svg>
                                    </div>
                                    <div className="stat-info">
                                        <h3>{stats.filesCount}</h3>
                                        <p>Fichiers</p>
                                    </div>
                                </div>

                                <div className="stat-card" onClick={() => setActiveTab('storage')}>
                                    <div className="stat-icon folders">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                                        </svg>
                                    </div>
                                    <div className="stat-info">
                                        <h3>{stats.foldersCount}</h3>
                                        <p>Dossiers</p>
                                    </div>
                                </div>

                                <div className="stat-card" onClick={() => setActiveTab('storage')}>
                                    <div className="stat-icon storage">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                                        </svg>
                                    </div>
                                    <div className="stat-info">
                                        <h3>{formatBytes(stats.storageUsed)}</h3>
                                        <p>Espace utilisé</p>
                                    </div>
                                </div>
                            </div>

                            {/* Storage Progress */}
                            <div className="section-card">
                                <h3>Stockage</h3>
                                <div className="storage-bar">
                                    <div className="storage-fill" style={{ width: `${storagePercent}%` }}></div>
                                </div>
                                <p className="storage-text">
                                    {formatBytes(stats.storageUsed)} sur {formatBytes(stats.storageTotal)} utilisé ({storagePercent}%)
                                </p>
                            </div>

                            {/* Accès rapide aux outils */}
                            <div className="section-card">
                                <h3>Accès rapide aux outils</h3>
                                <div className="tools-grid">
                                    <button className="tool-card" onClick={() => router.push('/drive')} title="Accéder au Drive">
                                        <div className="tool-icon drive">
                                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                                                <polyline points="13 2 13 9 20 9" />
                                            </svg>
                                        </div>
                                        <h4>Drive</h4>
                                        <p>Gérez vos fichiers et dossiers</p>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'account' && (
                        <div className="tab-content">
                            <h2 className="tab-title">Informations du compte</h2>

                            <div className="section-card">
                                <h3>Informations personnelles</h3>
                                <div className="info-grid">
                                    <div className="info-item">
                                        <label>Prénom</label>
                                        <p>{userData?.firstName}</p>
                                    </div>
                                    <div className="info-item">
                                        <label>Nom</label>
                                        <p>{userData?.lastName}</p>
                                    </div>
                                    <div className="info-item">
                                        <label>Email</label>
                                        <p>{userData?.email}</p>
                                    </div>
                                    <div className="info-item">
                                        <label>Membre depuis</label>
                                        <p>{new Date(userData?.createdAt).toLocaleDateString('fr-FR', {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric'
                                        })}</p>
                                    </div>
                                </div>
                                <button className="btn-edit">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                    </svg>
                                    Modifier mes informations
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'security' && (
                        <div className="tab-content">
                            <h2 className="tab-title">Sécurité</h2>

                            <div className="section-card">
                                <h3>Mot de passe</h3>
                                <p className="section-description">
                                    Assurez-vous d'utiliser un mot de passe fort et unique.
                                </p>
                                <button className="btn-secondary">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                    </svg>
                                    Changer le mot de passe
                                </button>
                            </div>

                            <div className="section-card">
                                <h3>Chiffrement de bout en bout</h3>
                                <p className="section-description">
                                    Tous vos fichiers sont chiffrés localement avant d'être envoyés sur nos serveurs.
                                    Seul vous pouvez accéder à vos données.
                                </p>
                                <div className="security-badge">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                        <path d="M9 12l2 2 4-4" />
                                    </svg>
                                    <span>Protection active</span>
                                </div>
                            </div>

                            <div className="section-card">
                                <h3>Sessions actives</h3>
                                <p className="section-description">
                                    Gérez les appareils connectés à votre compte.
                                </p>
                                <div className="session-list">
                                    <div className="session-item">
                                        <div className="session-icon">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                                                <line x1="8" y1="21" x2="16" y2="21" />
                                                <line x1="12" y1="17" x2="12" y2="21" />
                                            </svg>
                                        </div>
                                        <div className="session-info">
                                            <p className="session-name">Session actuelle</p>
                                            <p className="session-details">Linux • Dernière activité: maintenant</p>
                                        </div>
                                        <span className="session-badge">Actif</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'storage' && (
                        <div className="tab-content">
                            <h2 className="tab-title">Stockage</h2>

                            <div className="section-card">
                                <h3>Utilisation du stockage</h3>
                                <div className="storage-visual">
                                    <div className="storage-circle">
                                        <svg viewBox="0 0 36 36">
                                            <path
                                                d="M18 2.0845
                                                a 15.9155 15.9155 0 0 1 0 31.831
                                                a 15.9155 15.9155 0 0 1 0 -31.831"
                                                fill="none"
                                                stroke="#E2E8F0"
                                                strokeWidth="3"
                                            />
                                            <path
                                                d="M18 2.0845
                                                a 15.9155 15.9155 0 0 1 0 31.831
                                                a 15.9155 15.9155 0 0 1 0 -31.831"
                                                fill="none"
                                                stroke="#F97316"
                                                strokeWidth="3"
                                                strokeDasharray={`${storagePercent}, 100`}
                                            />
                                        </svg>
                                        <div className="storage-percentage">
                                            <span className="percent">{storagePercent}%</span>
                                            <span className="label">utilisé</span>
                                        </div>
                                    </div>
                                    <div className="storage-details">
                                        <div className="storage-detail-item">
                                            <span className="label">Espace utilisé</span>
                                            <span className="value">{formatBytes(stats.storageUsed)}</span>
                                        </div>
                                        <div className="storage-detail-item">
                                            <span className="label">Espace disponible</span>
                                            <span className="value">{formatBytes(stats.storageTotal - stats.storageUsed)}</span>
                                        </div>
                                        <div className="storage-detail-item">
                                            <span className="label">Espace total</span>
                                            <span className="value">{formatBytes(stats.storageTotal)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="section-card">
                                <h3>Répartition par type</h3>
                                <div className="storage-breakdown">
                                    {Array.isArray(stats.storageByFileType) && stats.storageByFileType.length > 0 ? (
                                        (() => {
                                            const fileTypeIcons = {
                                                'Image': {
                                                    color: '#10B981',
                                                    bgColor: 'rgba(16, 185, 129, 0.1)',
                                                    svg: (
                                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                                            <circle cx="8.5" cy="8.5" r="1.5" />
                                                            <polyline points="21 15 16 10 5 21" />
                                                        </svg>
                                                    )
                                                },
                                                'Vidéo': {
                                                    color: '#8B5CF6',
                                                    bgColor: 'rgba(139, 92, 246, 0.1)',
                                                    svg: (
                                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <polygon points="23 7 16 12 23 17 23 7" />
                                                            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                                                        </svg>
                                                    )
                                                },
                                                'Document': {
                                                    color: '#3B82F6',
                                                    bgColor: 'rgba(59, 130, 246, 0.1)',
                                                    svg: (
                                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                                            <polyline points="14 2 14 8 20 8" />
                                                            <line x1="16" y1="13" x2="8" y2="13" />
                                                            <line x1="16" y1="17" x2="8" y2="17" />
                                                            <polyline points="10 9 9 9 8 9" />
                                                        </svg>
                                                    )
                                                },
                                                'Autre': {
                                                    color: '#F59E0B',
                                                    bgColor: 'rgba(245, 158, 11, 0.1)',
                                                    svg: (
                                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                                                            <polyline points="13 2 13 9 20 9" />
                                                        </svg>
                                                    )
                                                }
                                            };

                                            // Trier par taille décroissante
                                            const sorted = [...stats.storageByFileType].sort((a, b) => (b[2] || 0) - (a[2] || 0));

                                            return sorted.map((item, idx) => {
                                                const label = item[0] || 'Inconnu';
                                                const count = item[1] || 0;
                                                const size = item[2] || 0;
                                                const iconData = fileTypeIcons[label] || {
                                                    color: '#F59E0B',
                                                    bgColor: 'rgba(245, 158, 11, 0.1)',
                                                    svg: fileTypeIcons['Autre'].svg
                                                };

                                                return (
                                                    <div className="breakdown-item" key={idx}>
                                                        <div
                                                            className="breakdown-icon"
                                                            style={{
                                                                backgroundColor: iconData.bgColor,
                                                                color: iconData.color
                                                            }}
                                                        >
                                                            {iconData.svg}
                                                        </div>
                                                        <div className="breakdown-info">
                                                            <p className="breakdown-label">{label}</p>
                                                            <p className="breakdown-size">{size ? formatBytes(size) : '0 Mo'}</p>
                                                        </div>
                                                        <div className="breakdown-bar">
                                                            <div
                                                                className="breakdown-fill"
                                                                style={{
                                                                    width: `${(size / stats.storageUsed) * 100}%`,
                                                                    background: iconData.color
                                                                }}
                                                            ></div>
                                                        </div>
                                                    </div>
                                                );
                                            });
                                        })()
                                    ) : (
                                        <p style={{ color: '#64748B' }}>Aucune donnée disponible</p>
                                    )}
                                </div>
                            </div>

                            <div className="section-card">
                                <h3>Augmenter l'espace de stockage</h3>
                                <p className="section-description">
                                    Besoin de plus d'espace ? Passez à un forfait supérieur.
                                </p>
                                <button className="btn-primary">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                                        <polyline points="7.5 4.21 12 6.81 16.5 4.21" />
                                        <polyline points="7.5 19.79 7.5 14.6 3 12" />
                                        <polyline points="21 12 16.5 14.6 16.5 19.79" />
                                        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                                        <line x1="12" y1="22.08" x2="12" y2="12" />
                                    </svg>
                                    Voir les forfaits
                                </button>
                            </div>
                        </div>
                    )}
                </main>
            </div>

            <style jsx>{`
                .profile-page {
                    min-height: 100vh;
                    background: #F8FAFC;
                }

                /* Header */
                .header {
                    background: white;
                    border-bottom: 1px solid #E2E8F0;
                    position: sticky;
                    top: 0;
                    z-index: 100;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.02);
                }

                .header-content {
                    max-width: 1400px;
                    margin: 0 auto;
                    padding: 1rem 2rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .logo-section {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }

                .logo-section h1 {
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: #0B1120;
                    margin: 0;
                }

                .nav-menu {
                    display: flex;
                    gap: 0.5rem;
                }

                .nav-btn {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.75rem 1.25rem;
                    border: none;
                    background: transparent;
                    color: #64748B;
                    border-radius: 8px;
                    font-size: 0.95rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    font-family: inherit;
                }

                .nav-btn:hover {
                    background: #F1F5F9;
                    color: #334155;
                }

                .nav-btn.active {
                    background: linear-gradient(135deg, #F97316 0%, #FDBA74 100%);
                    color: white;
                }

                .nav-btn.logout {
                    color: #EF4444;
                }

                .nav-btn.logout:hover {
                    background: #FEF2F2;
                    color: #DC2626;
                }

                /* Content Layout */
                .content-wrapper {
                    max-width: 1400px;
                    margin: 0 auto;
                    padding: 2rem;
                    display: grid;
                    grid-template-columns: 280px 1fr;
                    gap: 2rem;
                    align-items: start;
                }

                /* Sidebar */
                .sidebar {
                    position: sticky;
                    top: 100px;
                }

                .profile-card {
                    background: white;
                    border-radius: 16px;
                    padding: 2rem;
                    text-align: center;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
                    margin-bottom: 1rem;
                }

                .avatar {
                    width: 80px;
                    height: 80px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #F97316 0%, #FDBA74 100%);
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 2rem;
                    font-weight: 700;
                    margin: 0 auto 1rem;
                }

                .profile-card h2 {
                    font-size: 1.25rem;
                    color: #0B1120;
                    margin: 0 0 0.5rem;
                }

                .profile-card .email {
                    font-size: 0.9rem;
                    color: #64748B;
                    margin: 0;
                }

                .sidebar-nav {
                    display: flex;
                    flex-direction: column;
                    gap: 0.25rem;
                }

                .sidebar-btn {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.875rem 1rem;
                    border: none;
                    background: white;
                    color: #64748B;
                    border-radius: 12px;
                    font-size: 0.95rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    text-align: left;
                    font-family: inherit;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.04);
                }

                .sidebar-btn:hover {
                    background: #F1F5F9;
                    color: #334155;
                    transform: translateX(4px);
                }

                .sidebar-btn.active {
                    background: linear-gradient(135deg, #F97316 0%, #FDBA74 100%);
                    color: white;
                    box-shadow: 0 4px 12px rgba(249, 115, 22, 0.3);
                }

                /* Main Content */
                .main-content {
                    background: white;
                    border-radius: 16px;
                    padding: 2rem;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
                    min-height: 600px;
                }

                .tab-content {
                    animation: fadeIn 0.3s ease;
                }

                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .tab-title {
                    font-size: 2rem;
                    font-weight: 700;
                    color: #0B1120;
                    margin: 0 0 2rem;
                }

                /* Stats Grid */
                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 1.5rem;
                    margin-bottom: 2rem;
                }

                .stat-card {
                    background: linear-gradient(135deg, #F8FAFC 0%, #EFF6FF 100%);
                    border-radius: 12px;
                    padding: 1.5rem;
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    transition: transform 0.2s ease;
                    cursor: pointer;
                }

                .stat-card:hover {
                    transform: translateY(-4px);
                }

                .stat-icon {
                    width: 48px;
                    height: 48px;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                }

                .stat-icon.files {
                    background: linear-gradient(135deg, #3B82F6 0%, #60A5FA 100%);
                }

                .stat-icon.folders {
                    background: linear-gradient(135deg, #F59E0B 0%, #FCD34D 100%);
                }

                .stat-icon.storage {
                    background: linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%);
                }

                .stat-info h3 {
                    font-size: 1.75rem;
                    font-weight: 700;
                    color: #0B1120;
                    margin: 0;
                }

                .stat-info p {
                    font-size: 0.875rem;
                    color: #64748B;
                    margin: 0;
                }

                /* Section Card */
                .section-card {
                    background: #F8FAFC;
                    border-radius: 12px;
                    padding: 1.5rem;
                    margin-bottom: 1.5rem;
                }

                .section-card h3 {
                    font-size: 1.25rem;
                    font-weight: 600;
                    color: #0B1120;
                    margin: 0 0 1rem;
                }

                .section-description {
                    color: #64748B;
                    font-size: 0.95rem;
                    margin: 0 0 1.5rem;
                    line-height: 1.6;
                }

                /* Storage Bar */
                .storage-bar {
                    height: 12px;
                    background: #E2E8F0;
                    border-radius: 6px;
                    overflow: hidden;
                    margin-bottom: 0.75rem;
                }

                .storage-fill {
                    height: 100%;
                    background: linear-gradient(90deg, #F97316 0%, #FDBA74 100%);
                    border-radius: 6px;
                    transition: width 0.3s ease;
                }

                .storage-text {
                    font-size: 0.875rem;
                    color: #64748B;
                    margin: 0;
                }

                /* Quick Actions */
                .quick-actions {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                    gap: 1rem;
                }

                .action-btn {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 1.5rem;
                    background: white;
                    border: 2px solid #E2E8F0;
                    border-radius: 12px;
                    color: #334155;
                    font-size: 0.95rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    font-family: inherit;
                }

                .action-btn:hover {
                    border-color: #F97316;
                    color: #F97316;
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(249, 115, 22, 0.15);
                }

                .action-btn svg {
                    color: #F97316;
                }

                /* Tools Grid */
                .tools-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
                    gap: 1.5rem;
                }

                .tool-card {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 1rem;
                    padding: 1.75rem 1.5rem;
                    background: white;
                    border: 2px solid #E2E8F0;
                    border-radius: 16px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    font-family: inherit;
                    text-align: center;
                    position: relative;
                    overflow: hidden;
                }

                .tool-card::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: linear-gradient(135deg, rgba(249, 115, 22, 0) 0%, rgba(249, 115, 22, 0.05) 100%);
                    opacity: 0;
                    transition: opacity 0.3s ease;
                    pointer-events: none;
                }

                .tool-card:hover {
                    border-color: #F97316;
                    transform: translateY(-4px);
                    box-shadow: 0 8px 24px rgba(249, 115, 22, 0.15);
                }

                .tool-card:hover::before {
                    opacity: 1;
                }

                .tool-icon {
                    width: 64px;
                    height: 64px;
                    border-radius: 14px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-weight: 700;
                    font-size: 2rem;
                    transition: all 0.3s ease;
                    z-index: 1;
                }

                .tool-card:hover .tool-icon {
                    transform: scale(1.1);
                }

                .tool-icon.drive {
                    background: linear-gradient(135deg, #F97316 0%, #FDBA74 100%);
                }

                .tool-card h4 {
                    font-size: 1.1rem;
                    font-weight: 700;
                    color: #0B1120;
                    margin: 0;
                    z-index: 1;
                    position: relative;
                }

                .tool-card p {
                    font-size: 0.825rem;
                    color: #64748B;
                    margin: 0;
                    line-height: 1.4;
                    z-index: 1;
                    position: relative;
                }

                /* Info Grid */
                .info-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 1.5rem;
                    margin-bottom: 1.5rem;
                }

                .info-item label {
                    display: block;
                    font-size: 0.875rem;
                    font-weight: 600;
                    color: #64748B;
                    margin-bottom: 0.5rem;
                }

                .info-item p {
                    font-size: 1rem;
                    color: #0B1120;
                    margin: 0;
                    padding: 0.75rem;
                    background: white;
                    border-radius: 8px;
                }

                /* Buttons */
                .btn-edit, .btn-secondary, .btn-primary {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.875rem 1.5rem;
                    border: none;
                    border-radius: 10px;
                    font-size: 0.95rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    font-family: inherit;
                }

                .btn-edit {
                    background: white;
                    color: #F97316;
                    border: 2px solid #F97316;
                }

                .btn-edit:hover {
                    background: #F97316;
                    color: white;
                }

                .btn-secondary {
                    background: #F1F5F9;
                    color: #334155;
                }

                .btn-secondary:hover {
                    background: #E2E8F0;
                }

                .btn-primary {
                    background: linear-gradient(135deg, #F97316 0%, #FDBA74 100%);
                    color: white;
                    box-shadow: 0 4px 12px rgba(249, 115, 22, 0.3);
                }

                .btn-primary:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 16px rgba(249, 115, 22, 0.4);
                }

                /* Security Badge */
                .security-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 1rem 1.5rem;
                    background: #ECFDF5;
                    border: 2px solid #10B981;
                    border-radius: 12px;
                    color: #065F46;
                    font-weight: 600;
                }

                .security-badge svg {
                    color: #10B981;
                }

                /* Session List */
                .session-list {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }

                .session-item {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    padding: 1rem;
                    background: white;
                    border-radius: 10px;
                    border: 1px solid #E2E8F0;
                }

                .session-icon {
                    width: 40px;
                    height: 40px;
                    background: #F1F5F9;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #64748B;
                }

                .session-info {
                    flex: 1;
                }

                .session-name {
                    font-weight: 600;
                    color: #0B1120;
                    margin: 0 0 0.25rem;
                }

                .session-details {
                    font-size: 0.875rem;
                    color: #64748B;
                    margin: 0;
                }

                .session-badge {
                    padding: 0.5rem 1rem;
                    background: #ECFDF5;
                    color: #065F46;
                    border-radius: 8px;
                    font-size: 0.875rem;
                    font-weight: 600;
                }

                /* Storage Visual */
                .storage-visual {
                    display: grid;
                    grid-template-columns: 200px 1fr;
                    gap: 3rem;
                    align-items: center;
                }

                .storage-circle {
                    position: relative;
                    width: 200px;
                    height: 200px;
                }

                .storage-circle svg {
                    transform: rotate(-90deg);
                    width: 100%;
                    height: 100%;
                }

                .storage-percentage {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    text-align: center;
                }

                .storage-percentage .percent {
                    display: block;
                    font-size: 2rem;
                    font-weight: 700;
                    color: #0B1120;
                }

                .storage-percentage .label {
                    display: block;
                    font-size: 0.875rem;
                    color: #64748B;
                }

                .storage-details {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }

                .storage-detail-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1rem;
                    background: white;
                    border-radius: 10px;
                }

                .storage-detail-item .label {
                    color: #64748B;
                    font-size: 0.95rem;
                }

                .storage-detail-item .value {
                    color: #0B1120;
                    font-weight: 600;
                    font-size: 1rem;
                }

                /* Storage Breakdown */
                .storage-breakdown {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }

                .breakdown-item {
                    display: grid;
                    grid-template-columns: auto 1fr auto;
                    align-items: center;
                    gap: 1rem;
                }

                .breakdown-icon {
                    width: 40px;
                    height: 40px;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .breakdown-icon.documents {
                    background: rgba(59, 130, 246, 0.1);
                    color: #3B82F6;
                }

                .breakdown-icon.images {
                    background: rgba(16, 185, 129, 0.1);
                    color: #10B981;
                }

                .breakdown-icon.videos {
                    background: rgba(139, 92, 246, 0.1);
                    color: #8B5CF6;
                }

                .breakdown-icon.other {
                    background: rgba(245, 158, 11, 0.1);
                    color: #F59E0B;
                }

                .breakdown-info {
                    display: flex;
                    flex-direction: column;
                    gap: 0.25rem;
                }

                .breakdown-label {
                    font-weight: 600;
                    color: #0B1120;
                    margin: 0;
                }

                .breakdown-size {
                    font-size: 0.875rem;
                    color: #64748B;
                    margin: 0;
                }

                .breakdown-bar {
                    width: 120px;
                    height: 8px;
                    background: #E2E8F0;
                    border-radius: 4px;
                    overflow: hidden;
                }

                .breakdown-fill {
                    height: 100%;
                    border-radius: 4px;
                    transition: width 0.3s ease;
                }

                /* Responsive */
                @media (max-width: 968px) {
                    .content-wrapper {
                        grid-template-columns: 1fr;
                        padding: 1rem;
                    }

                    .sidebar {
                        position: static;
                    }

                    .profile-card {
                        display: none;
                    }

                    .sidebar-nav {
                        flex-direction: row;
                        overflow-x: auto;
                        padding-bottom: 0.5rem;
                    }

                    .sidebar-btn {
                        white-space: nowrap;
                    }

                    .header-content {
                        flex-direction: column;
                        gap: 1rem;
                        padding: 1rem;
                    }

                    .nav-menu {
                        width: 100%;
                        justify-content: center;
                        flex-wrap: wrap;
                    }

                    .stats-grid {
                        grid-template-columns: 1fr;
                    }

                    .storage-visual {
                        grid-template-columns: 1fr;
                        text-align: center;
                    }

                    .storage-circle {
                        margin: 0 auto;
                    }

                    .info-grid {
                        grid-template-columns: 1fr;
                    }

                    .quick-actions {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
        </div>
    );
}
