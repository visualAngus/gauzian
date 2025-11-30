const bouton = document.getElementsByClassName('test')[0];
bouton.addEventListener('click', function() {
    fetch('https://gauzian.pupin.fr/auth/autologin', {
        method: 'POST',
        credentials: 'include', // <--- envoie/retourne les cookies cross-origin
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ /* vos données ici */ })
    })
    .then(response => response.json()) // Ceci ne plantera plus
    .then(data => console.log(data))   // Affiche { status: "success", ... }
    .catch(err => { /* gestion d'erreur */ });
});

const loginButton = document.getElementsByClassName('login')[0];
loginButton.addEventListener('click', function() {
    fetch('https://gauzian.pupin.fr/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            first_name: 'Gael',
            last_name: 'Pupin',
            email: 'gael@example.local',
            password: 'secret123'
        })
    })
    .then(response => response.json()) // Ceci ne plantera plus
    .then(data => console.log(data))   // Affiche { status: "success", ... }
    .catch(err => {
        console.error('Login error:', err);
    });
});
