import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Configuration des scénarios de test
export let options = {
    scenarios: {
        // Test TRÈS STRESSANT - ~35 req/s avec charge progressive
        heavy_stress: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '30s', target: 50 },    // 30 req/s
                { duration: '2m', target: 100 },    // 60 req/s
                { duration: '2m', target: 150 },    // 90 req/s - PIC MAXIMUM
                { duration: '1m', target: 50 },     // Retour à 30 req/s
                { duration: '30s', target: 0 },
            ],
            gracefulRampDown: '30s',
        },
        // Test SPIKE EXTRÊME - pic très violent
        extreme_spike: {
            executor: 'ramping-vus',
            startVUs: 10,
            stages: [
                { duration: '20s', target: 10 },
                { duration: '5s', target: 200 },    // Pic violent
                { duration: '30s', target: 200 },   // Maintien du pic
                { duration: '10s', target: 0 },
            ],
            gracefulRampDown: '10s',
            startTime: '7m',
        },
        // Test de charge soutenue - login/logout intensif
        login_hammer: {
            executor: 'constant-vus',
            vus: 120,                               // 120 utilisateurs simultanés
            duration: '4m',
            startTime: '1m',
        },
    },
    thresholds: {
        http_req_duration: ['p(95)<1000', 'p(99)<2000'],  // Seuils plus permissifs pour le stress
        http_req_failed: ['rate<0.2'],                      // Tolérer jusqu'à 20% d'erreurs
        checks: ['rate>0.7'],                               // Au moins 70% de succès
    },
};

const BASE_URL = 'https://gauzian.pupin.fr/api';

// Fonction pour générer un utilisateur unique à chaque appel
function generateUniqueUser() {
    const timestamp = Date.now();
    const random = randomString(12);
    return {
        email: `user_${timestamp}_${random}@test.gauzian.fr`,
        password: `SecurePass_${random}_123!`,
        username: `user_${random}`,
    };
}

// Données crypto mockées pour les tests
function getMockCryptoData() {
    return {
        encrypted_private_key: 'mock_encrypted_key_' + randomString(32),
        public_key: 'mock_public_key_' + randomString(32),
        private_key_salt: 'mock_salt_' + randomString(16),
        iv: 'mock_iv_' + randomString(16),
        encrypted_record_key: 'mock_record_key_' + randomString(32),
    };
}

// Fonction helper pour les headers avec token
function getAuthHeaders(token) {
    return {
        'Content-Type': 'application/json',
        'Cookie': `token=${token}`,
    };
}

// Test de register
function testRegister(user) {
    const cryptoData = getMockCryptoData();
    const payload = JSON.stringify({
        username: user.username,
        password: user.password,
        email: user.email,
        ...cryptoData,
    });

    const res = http.post(`${BASE_URL}/register`, payload, {
        headers: { 'Content-Type': 'application/json' },
    });

    check(res, {
        'register status is 200 or 201': (r) => r.status === 200 || r.status === 201,
        'register has user_id': (r) => {
            try {
                const body = JSON.parse(r.body);
                return body.user_id !== undefined;
            } catch (e) {
                return false;
            }
        },
    });

    return res;
}

// Test de login
function testLogin(user) {
    const payload = JSON.stringify({
        email: user.email,
        password: user.password,
    });

    const res = http.post(`${BASE_URL}/login`, payload, {
        headers: { 'Content-Type': 'application/json' },
    });

    check(res, {
        'login status is 200': (r) => r.status === 200,
        'login has token': (r) => {
            const cookies = r.headers['Set-Cookie'];
            return cookies && cookies.includes('token=');
        },
        'login response has keys': (r) => {
            try {
                const body = JSON.parse(r.body);
                return body.encrypted_private_key && body.public_key;
            } catch (e) {
                return false;
            }
        },
    });

    // Extraire le token du cookie
    let token = null;
    if (res.headers['Set-Cookie']) {
        const cookieMatch = res.headers['Set-Cookie'].match(/token=([^;]+)/);
        if (cookieMatch) {
            token = cookieMatch[1];
        }
    }

    return { response: res, token: token };
}

// Test de login invalide
function testInvalidLogin() {
    const payload = JSON.stringify({
        email: 'invalid@example.com',
        password: 'wrongpassword',
    });

    const res = http.post(`${BASE_URL}/login`, payload, {
        headers: { 'Content-Type': 'application/json' },
    });

    check(res, {
        'invalid login status is 401': (r) => r.status === 401,
    });
}

// Test autologin
function testAutoLogin(token) {
    const res = http.get(`${BASE_URL}/autologin`, {
        headers: getAuthHeaders(token),
    });

    check(res, {
        'autologin status is 200': (r) => r.status === 200,
    });

    return res;
}

// Test protected endpoint
function testProtected(token) {
    const res = http.get(`${BASE_URL}/protected`, {
        headers: getAuthHeaders(token),
    });

    check(res, {
        'protected status is 200': (r) => r.status === 200,
    });

    return res;
}

// Test info endpoint
function testInfo(token) {
    const res = http.get(`${BASE_URL}/info`, {
        headers: getAuthHeaders(token),
    });

    check(res, {
        'info status is 200': (r) => r.status === 200,
    });

    return res;
}

// Test create folder
function testCreateFolder(token, parentId = 'root') {
    const payload = JSON.stringify({
        encrypted_metadata: 'mock_encrypted_metadata_' + randomString(32),
        parent_folder_id: parentId || 'root',  // Toujours envoyer une string
        encrypted_folder_key: 'mock_encrypted_folder_key_' + randomString(16),
    });

    const res = http.post(`${BASE_URL}/drive/create_folder`, payload, {
        headers: getAuthHeaders(token),
    });

    check(res, {
        'create folder status is 200 or 201': (r) => {
            if (r.status !== 200 && r.status !== 201) {
                console.log(`Create folder failed: ${r.status} - ${r.body}`);
            }
            return r.status === 200 || r.status === 201;
        },
    });

    let folderId = null;
    try {
        const body = JSON.parse(res.body);
        folderId = body.folder_id || body.id;
    } catch (e) {}

    return { response: res, folderId: folderId };
}

// Test get drive info
function testGetDriveInfo(token, parentId = 'root') {
    const res = http.get(`${BASE_URL}/drive/get_all_drive_info/${parentId}`, {
        headers: getAuthHeaders(token),
    });

    check(res, {
        'get drive info status is 200': (r) => r.status === 200,
    });

    return res;
}

// Test get folder contents
function testGetFolderContents(token, folderId) {
    const res = http.get(`${BASE_URL}/drive/folder_contents/${folderId}`, {
        headers: getAuthHeaders(token),
    });

    check(res, {
        'get folder contents status is 200': (r) => r.status === 200,
    });

    return res;
}

// Test rename folder
function testRenameFolder(token, folderId) {
    const payload = JSON.stringify({
        folder_id: folderId,
        new_encrypted_metadata: 'mock_new_encrypted_metadata_' + randomString(32),
    });

    const res = http.post(`${BASE_URL}/drive/rename_folder`, payload, {
        headers: getAuthHeaders(token),
    });

    check(res, {
        'rename folder status is 200': (r) => r.status === 200,
    });

    return res;
}

// Test delete folder
function testDeleteFolder(token, folderId) {
    const payload = JSON.stringify({
        folder_id: folderId,
    });

    const res = http.post(`${BASE_URL}/drive/delete_folder`, payload, {
        headers: getAuthHeaders(token),
    });

    check(res, {
        'delete folder status is 200': (r) => r.status === 200,
    });

    return res;
}

// Test logout
function testLogout(token) {
    const res = http.post(`${BASE_URL}/logout`, null, {
        headers: getAuthHeaders(token),
    });

    check(res, {
        'logout status is 200': (r) => r.status === 200,
    });

    return res;
}

// Scénario principal - STRESS MAXIMAL
export default function() {
    // Générer un nouvel utilisateur unique à chaque itération
    const user = generateUniqueUser();
    const action = Math.random();

    // Scénario 1: Spam de login (rapide et agressif)
    if (action < 0.4) {
        testRegister(user);  // Créer un nouvel utilisateur
        sleep(0.1);
        testLogin(user);     // Login avec ce user
        sleep(0.05);
        testInvalidLogin();
        sleep(0.05);
    }
    
    // Scénario 2: Register + Login + Protégé (cycle complet rapide)
    else if (action < 0.7) {
        testRegister(user);
        sleep(0.1);
        const { token } = testLogin(user);
        sleep(0.05);
        if (token) {
            testProtected(token);
            sleep(0.05);
            testAutoLogin(token);
            sleep(0.05);
            testLogout(token);
        }
    }
    
    // Scénario 3: Opérations Drive rapides
    else {
        testRegister(user);
        sleep(0.1);
        const { token } = testLogin(user);
        if (token) {
            sleep(0.05);
            testGetDriveInfo(token);
            sleep(0.05);
            const { folderId } = testCreateFolder(token);
            sleep(0.05);
            if (folderId) {
                testGetFolderContents(token, folderId);
                sleep(0.02);
                testRenameFolder(token, folderId);
                sleep(0.02);
                testDeleteFolder(token, folderId);
            }
            sleep(0.05);
            testLogout(token);
        }
    }

    sleep(0.05);  // Délai minimal entre les cycles
}