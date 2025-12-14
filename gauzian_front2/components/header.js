import React, { useState, useEffect } from 'react';
// 1. IMPORT CORRECT
import styles from './header.module.css'; 

const Header = ({ TITLE, userName = "User" }) => {
    const [imageError, setImageError] = useState(false);
    const [title] = useState(TITLE || "GAUZIAN");
    const [userId, setUserId] = useState(null);
    const [userFullName, setUserFullName] = useState(userName);

    useEffect(() => {
        // Récupérer les infos utilisateur depuis localStorage
        const storedUser = localStorage.getItem('userData');
        if (storedUser) {
            try {
                const userData = JSON.parse(storedUser);
                setUserId(userData.id || userData.user_id);
                if (userData.firstName || userData.lastName) {
                    setUserFullName(`${userData.firstName || ''} ${userData.lastName || ''}`.trim());
                }
            } catch (e) {
                console.error('Erreur parsing userData:', e);
            }
        }
    }, []);

    const getInitials = (name) => {
        return name
            .split(' ')
            .map(word => word[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    return (
        // 2. UTILISATION DE L'OBJET 'styles'
        <header className={styles.header}>
            <div className={styles.headerContent}>
                
                {/* Logo */}
                <h1 className={styles.logo}>
                    <a href="/">{title}</a>
                </h1>

                {/* Profil */}
                <div
                    className={styles.userProfileContainer}
                    onClick={() => window.location.href = '/profile'}
                    title="Aller au profil"
                >
                    <div className={styles.userInfo}>
                        <span className={styles.userName}>{userFullName}</span>
                        {/* <span className={styles.userRole}>Admin</span> */}
                    </div>

                    <div className={styles.avatarWrapper}>
                        {!imageError && userId ? (
                            <img
                                className={styles.userAvatar}
                                src={`/api/users/${userId}/profile-picture`}
                                alt="Profil"
                                onError={() => setImageError(true)}
                            />
                        ) : (
                            <div className={styles.userAvatarPlaceholder}>
                                {getInitials(userFullName)}
                            </div>
                        )}
                        <div className={styles.statusIndicator}></div>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;