// components/Gauzial.js
import { useState, useEffect, useRef } from 'react';
import styles from './gauzial.module.css';

const Gauzial = ({ className = "", lookAway = false, isUnhappy = false, isRequestGood = true }) => {
    const [look, setLook] = useState({ x: 0, y: 0 });
    const [pupil, setPupil] = useState({ x: 0, y: 0 });

    // Nouvel état pour le clignement
    const [isBlinking, setIsBlinking] = useState(false);
    const [lastMousePosition, setLastMousePosition] = useState({ x: null, y: null });

    const bodyRef = useRef(null);

    useEffect(() => {
        if (lookAway) {
            setLook({ x: 0, y: -18 }); // Tourne la tête vers la gauche
            setPupil({ x: -12, y: -8 }); // Pupilles vers la gauche
        } else {
            // avec les dernières positions de la souris
            if (lastMousePosition.x !== null && lastMousePosition.y !== null && bodyRef.current) {
                const { left, top, width, height } = bodyRef.current.getBoundingClientRect();
                const centerX = left + width / 2;
                const centerY = top + height / 2;

                const x = (lastMousePosition.x - centerX) / (window.innerWidth / 2);
                const y = (lastMousePosition.y - centerY) / (window.innerHeight / 2);

                // Rotation
                const rotateX = -y * 15;
                const rotateY = x * 15;
                setLook({ x: rotateX, y: rotateY });

                // Pupilles
                const pupilX = x * 8;
                const pupilY = y * 8;
                setPupil({ x: pupilX, y: pupilY });
            }else {
                setLook({ x: 0, y: 0 });
                setPupil({ x: 0, y: 0 });
            }
        }
        // Gestion du mouvement de la souris
        const handleMouseMove = (e) => {
            if (!bodyRef.current) return;
            console.log(e.clientX, e.clientY);
            setLastMousePosition({ x: e.clientX, y: e.clientY });
            if (lookAway) {
                return; // Ne pas écouter la souris
            }

            const { left, top, width, height } = bodyRef.current.getBoundingClientRect();
            const centerX = left + width / 2;
            const centerY = top + height / 2;

            const x = (e.clientX - centerX) / (window.innerWidth / 2);
            const y = (e.clientY - centerY) / (window.innerHeight / 2);

            // Rotation
            const rotateX = -y * 15;
            const rotateY = x * 15;
            setLook({ x: rotateX, y: rotateY });

            // Pupilles
            const pupilX = x * 8;
            const pupilY = y * 8;
            setPupil({ x: pupilX, y: pupilY });
        };

        // Gestion du clic (Clignement)
        const handleMouseDown = () => {
            if (!lookAway) setIsBlinking(true);
        };
        const handleMouseUp = () => {
            if (!lookAway) setIsBlinking(false);
        };

        // On attache les événements à window pour que ça marche partout
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [lookAway]);

    return (
        <div className={`${styles.floater} ${className}`}>
            <div className="test"></div>
            <div
                ref={bodyRef}
                className={styles.body}
                style={{
                    transform: `perspective(800px) rotateX(${look.x}deg) rotateY(${look.y}deg)`
                }}
            >
                <div className={`${styles.face} ${!isRequestGood ? styles.angry : ''}`}>
                    <div className={styles.eyesRow}>

                        {/* Oeil Gauche : On ajoute la classe conditionnelle 'closed' */}
                        <div className={`${styles.eye} ${isBlinking ? styles.closed : ''}`}>
                            <div
                                className={styles.pupil}
                                style={{
                                    transform: `translate(${pupil.x}px, ${pupil.y}px)`,
                                    transition: lookAway ? 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'transform 0.1s'
                                }}
                            >
                                <div className={styles.glint}></div>
                            </div>
                        </div>

                        {/* Oeil Droit */}
                        <div className={`${styles.eye} ${isBlinking ? styles.closed : ''}`}>
                            <div
                                className={styles.pupil}
                                style={{
                                    transform: `translate(${pupil.x}px, ${pupil.y}px)`,
                                    transition: lookAway ? 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'transform 0.1s'
                                }}
                            >
                                <div className={styles.glint}></div>
                            </div>
                        </div>

                    </div>
                    <div className={`${styles.mouth} ${isUnhappy ? styles.sad : ''}`}></div>
                </div>
            </div>
        </div>
    );
};

export default Gauzial;