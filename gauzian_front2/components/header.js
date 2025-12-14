import React, { useState } from 'react';

const Header = () => {
    const [imageLoadedState, setImageLoadedState] = useState(false);

    return (
        <div className="drive-container">
            {/* J'ai retiré html/head/body pour integrer dans un composant */}
            <header>
                <h1>
                    <a href="/">GZDRIVE</a>
                </h1>
                <div
                    className="div_user_profil"
                    onClick={() => {
                        window.location.href = '/profile';
                    }}
                >
                    {!imageLoadedState && <div className="div_profil_custom"></div>}
                    <img
                        className={`user-image ${imageLoadedState ? 'loaded' : ''}`}
                        src="/images/user_profile.png" // Assurez-vous que l'image est dans le dossier 'public'
                        alt="User Profile"
                        onLoad={() => setImageLoadedState(true)}
                    />
                </div>
            </header>
        </div>
    );
};

export default Header;