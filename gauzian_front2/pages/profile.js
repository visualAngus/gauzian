import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function UserAccount() {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [imageLoadedState, setImageLoadedState] = useState(false);

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        const token = localStorage.getItem('token');
        // if (!token) {
        //   router.push('/login');
        //   return;
        // }

        try {
            // Simuler la récupération des données utilisateur
            // TODO: Remplacer par un vrai appel API
            const userData = {
                name: 'John Doe',
                email: 'john.doe@example.com',
                storageUsed: 2.5,
                storageLimit: 10
            };

            setUser(userData);
        } catch (error) {
            console.error('Error fetching user data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        router.push('/login');
    };

    if (loading) {
        return (
            <div className="drive-container">
                <header>
                    <h1><a href="/">GZPROFILE</a></h1>
                </header>
                <div className="loading-container">Chargement...</div>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    return (
        <div className="drive-container">
            <header>
                <h1><a href="/">GZPROFILE</a></h1>
                <div className="div_user_profil" onClick={() => router.push('/profile')} style={{ cursor: 'pointer' }}>
                    {!imageLoadedState && <div className="div_profil_custom"></div>}
                    <img
                        className={`user-image ${imageLoadedState ? 'loaded' : ''}`}
                        src="/images/user_profile.png"
                        alt="User Profile"
                        onLoad={() => setImageLoadedState(true)}
                    />
                </div>
            </header>

            <section>
                <div className="div_left_part">
                    <nav>
                        <ul>
                            <li>
                                <a href="/drive">Mon Drive</a>
                            </li>
                            <li>
                                <a href="/user" className="active">Mon Compte</a>
                            </li>
                            <li>
                                <a href="#" onClick={handleLogout}>Déconnexion</a>
                            </li>
                        </ul>
                    </nav>

                    <div className="div_storage_used">
                        <div className="storage_used_container">
                            <div
                                className={`storage_used_bar${(user.storageUsed / user.storageLimit) >= 0.95 ? ' full' : ''}`}
                                style={{ width: `${(user.storageUsed / user.storageLimit) * 100}%` }}
                            ></div>
                        </div>
                        <div className="storage_used_text">
                            <span>{user.storageUsed.toFixed(2)} GB</span> / <span>{user.storageLimit.toFixed(2)} GB</span>
                        </div>
                    </div>
                </div>

                <div className="div_right_part">
                    <div className="div_contenue">
                        <div className="profile-container">
                            <div className="div_user_profil">
                                {!imageLoadedState && <div className="div_profil_custom"></div>}
                                <img
                                    className={`user-image ${imageLoadedState ? 'loaded' : ''}`}
                                    src="/images/user_profile.png"
                                    alt="User Profile"
                                    onLoad={() => setImageLoadedState(true)}
                                />
                            </div>
                            
                            <div className="profile-info">
                                <div className="info-item">
                                    <label>NOM</label>
                                    <p>{user.name}</p>
                                </div>
                                <div className="info-item">
                                    <label>EMAIL</label>
                                    <p>{user.email}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
