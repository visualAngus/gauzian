// components/Gauzial.js
import { useState, useEffect, useRef } from 'react';
import styles from './gauzial.module.css';

const Gauzial = ({ 
    className = "", 
    lookAway = false, 
    isUnhappy = false, 
    isRequestGood = true, 
    isLoadingPage = false 
}) => {
    const [look, setLook] = useState({ x: 0, y: 0 });
    const [pupil, setPupil] = useState({ x: 0, y: 0 });
    const [isBlinking, setIsBlinking] = useState(false);
    
    // On garde en mémoire la dernière position pour quand on arrête de charger
    const lastMousePosition = useRef({ x: 0, y: 0 });

    useEffect(() => {
        if (typeof window !== "undefined") {
            lastMousePosition.current = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        }
    }, []);
    const bodyRef = useRef(null);

    useEffect(() => {
        // Fonction utilitaire pour calculer la position
        const calculatePosition = (clientX, clientY) => {
            if (!bodyRef.current) return;

            const { left, top, width, height } = bodyRef.current.getBoundingClientRect();
            const centerX = left + width / 2;
            const centerY = top + height / 2;

            const x = (clientX - centerX) / (window.innerWidth / 2);
            const y = (clientY - centerY) / (window.innerHeight / 2);

            setLook({ x: -y * 15, y: x * 15 });
            setPupil({ x: x * 8, y: y * 8 });
        };

        // Si on est en chargement, on ne fait RIEN (le CSS gère tout)
        if (isLoadingPage) {
            return; 
        }

        // Logique "Look Away" (regarder ailleurs)
        if (lookAway) {
            setLook({ x: 0, y: -18 });
            setPupil({ x: -12, y: -8 });
            return;
        }

        // Si on revient d'un chargement ou d'un lookAway, on rétablit la position
        calculatePosition(lastMousePosition.current.x, lastMousePosition.current.y);

        const handleMouseMove = (e) => {
            if (!bodyRef.current || lookAway || isLoadingPage) return;
            
            // On sauvegarde la position pour plus tard
            lastMousePosition.current = { x: e.clientX, y: e.clientY };
            calculatePosition(e.clientX, e.clientY);
        };

        const handleMouseDown = () => {
            if (!lookAway && !isLoadingPage) setIsBlinking(true);
        };
        const handleMouseUp = () => {
            if (!lookAway && !isLoadingPage) setIsBlinking(false);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [lookAway, isLoadingPage]); // On relance l'effet si isLoadingPage change

    return (
        <div className={`${styles.floater} ${className} ${isLoadingPage ? styles.loading : ''}`}>
            
            <div
                ref={bodyRef}
                className={styles.body}
                style={
                    // IMPORTANTE CORRECTION :
                    // Si on charge, on enlève le style inline pour laisser l'animation CSS (spinZ) prendre le dessus
                    isLoadingPage ? {} : {
                        transform: `perspective(800px) rotateX(${look.x}deg) rotateY(${look.y}deg)`
                    }
                }
            >
                <div className={`${styles.face} ${!isRequestGood ? styles.angry : ''}`}>
                    <div className={styles.eyesRow}>

                        {/* Oeil Gauche */}
                        <div className={`${styles.eye} ${isBlinking ? styles.closed : ''}`}>
                            <div
                                className={styles.pupil}
                                style={
                                    // Si on charge, on enlève le style inline pour laisser l'animation centrifuge CSS
                                    isLoadingPage ? {} : {
                                        transform: `translate(${pupil.x}px, ${pupil.y}px)`,
                                        transition: lookAway ? 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'transform 0.1s'
                                    }
                                }
                            >
                                <div className={styles.glint}></div>
                            </div>
                        </div>

                        {/* Oeil Droit */}
                        <div className={`${styles.eye} ${isBlinking ? styles.closed : ''}`}>
                            <div
                                className={styles.pupil}
                                style={
                                    isLoadingPage ? {} : {
                                        transform: `translate(${pupil.x}px, ${pupil.y}px)`,
                                        transition: lookAway ? 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'transform 0.1s'
                                    }
                                }
                            >
                                <div className={styles.glint}></div>
                            </div>
                        </div>

                    </div>
                    {/* Bouche */}
                    <div className={`${styles.mouth} ${isUnhappy ? styles.sad : ''}`}></div>
                </div>
            </div>
        </div>
    );
};

export default Gauzial;