document.addEventListener('DOMContentLoaded', function() {
    const app = document.getElementById('app');
    app.innerHTML = '<h1>Bienvenue sur Gauzian Front !</h1>';

    const bouton = document.getElementsByClassName('test')[0];
    bouton.addEventListener('click', function() {
        fetch('http://192.168.1.165:3000/auth/autologin', {
            method: 'OPTIONS',
            headers: {
                'Origin': 'http://localhost:5173',
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'content-type'
            }
        })
        .then(response => {
            if (response.ok) {
                alert('Requête OPTIONS envoyée avec succès !');
            } else {
                alert('Erreur lors de l\'envoi de la requête OPTIONS.');
            }
        })
        .catch(error => {
            console.error('Erreur:', error);
            alert('Une erreur s\'est produite.');
        });
    });

});


