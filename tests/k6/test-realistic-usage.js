import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';
import { randomBytes } from 'k6/crypto';

/**
 * Test K6 - Usage Réaliste Multi-Utilisateurs
 *
 * Simule des utilisateurs normaux qui utilisent l'application de manière naturelle:
 * - Upload de fichiers (2-5 par utilisateur)
 * - Navigation dans les dossiers
 * - Téléchargement de fichiers
 * - Création de dossiers
 * - Temps de réflexion entre les actions
 *
 * Durée: 10 minutes pour simuler des sessions longues
 * Utilisateurs: Monte progressivement de 5 à 30 utilisateurs simultanés
 */

export let options = {
    scenarios: {
        realistic_usage: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '1m', target: 5 },    // Début tranquille: 5 utilisateurs
                { duration: '3m', target: 15 },   // Montée progressive
                { duration: '4m', target: 30 },   // Pic d'activité: 30 utilisateurs
                { duration: '2m', target: 10 },   // Descente
                { duration: '30s', target: 0 },   // Fin
            ],
            gracefulRampDown: '30s',
        },
    },
    thresholds: {
        http_req_duration: ['p(95)<3000'],        // 95% des requêtes < 3s
        http_req_failed: ['rate<0.05'],           // Moins de 5% d'erreurs
        checks: ['rate>0.90'],                    // 90% des checks réussis
        'http_req_duration{scenario:upload}': ['p(95)<5000'], // Upload peut être plus lent
    },
};

const BASE_URL = 'https://gauzian.pupin.fr/api';

// ==================== Helpers ====================

function generateUser() {
    const id = randomString(8);
    return {
        email: `user_${id}@gauzian.test`,
        password: `Pass${id}!123`,
        username: `user_${id}`,
    };
}

function getCryptoData() {
    return {
        encrypted_private_key: 'mock_key_' + randomString(32),
        public_key: 'mock_pub_' + randomString(32),
        private_key_salt: 'mock_salt_' + randomString(16),
        iv: 'mock_iv_' + randomString(16),
        encrypted_record_key: 'mock_record_' + randomString(32),
    };
}

function getHeaders(token) {
    return {
        'Content-Type': 'application/json',
        'Cookie': `token=${token}`,
    };
}

function getBinaryHeaders(token) {
    return {
        'Content-Type': 'application/octet-stream',
        'Cookie': `token=${token}`,
    };
}

// ==================== Actions Utilisateur ====================

/**
 * Action: S'inscrire et se connecter
 */
function registerAndLogin(user) {
    const registerPayload = JSON.stringify({
        ...user,
        ...getCryptoData(),
    });

    const registerRes = http.post(`${BASE_URL}/register`, registerPayload, {
        headers: { 'Content-Type': 'application/json' },
        tags: { name: 'register' },
    });

    check(registerRes, {
        'register successful': (r) => r.status === 200 || r.status === 201,
    });

    sleep(0.5); // Temps de réflexion

    const loginPayload = JSON.stringify({
        email: user.email,
        password: user.password,
    });

    const loginRes = http.post(`${BASE_URL}/login`, loginPayload, {
        headers: { 'Content-Type': 'application/json' },
        tags: { name: 'login' },
    });

    check(loginRes, {
        'login successful': (r) => r.status === 200,
    });

    let token = null;
    if (loginRes.headers['Set-Cookie']) {
        const match = loginRes.headers['Set-Cookie'].match(/token=([^;]+)/);
        if (match) token = match[1];
    }

    return token;
}

/**
 * Action: Créer un dossier
 */
function createFolder(token, folderName) {
    const payload = JSON.stringify({
        encrypted_metadata: `folder_${folderName}_${randomString(16)}`,
        parent_folder_id: 'root',
        encrypted_folder_key: 'mock_folder_key_' + randomString(16),
    });

    const res = http.post(`${BASE_URL}/drive/create_folder`, payload, {
        headers: getHeaders(token),
        tags: { name: 'create_folder' },
    });

    check(res, {
        'folder created': (r) => r.status === 200 || r.status === 201,
    });

    let folderId = null;
    try {
        const body = JSON.parse(res.body);
        folderId = body.folder_id || body.id;
    } catch (e) {}

    return folderId;
}

/**
 * Action: Uploader un fichier complet (réaliste: 2-5 chunks)
 */
function uploadFile(token, fileName, numChunks = 3) {
    // 1. Initialiser le fichier
    const initPayload = JSON.stringify({
        size: numChunks * 1024 * 1024, // 1MB par chunk
        mime_type: 'application/octet-stream',
        encrypted_file_key: 'mock_key_' + randomString(32),
        encrypted_metadata: `file_${fileName}_${randomString(16)}`,
        folder_id: 'root',
    });

    const initRes = http.post(`${BASE_URL}/drive/initialize_file`, initPayload, {
        headers: getHeaders(token),
        tags: { name: 'init_file', scenario: 'upload' },
    });

    check(initRes, {
        'file initialized': (r) => r.status === 200 || r.status === 201,
    });

    let fileId = null;
    try {
        const body = JSON.parse(initRes.body);
        fileId = body.file_id || body.id;
    } catch (e) {}

    if (!fileId) return null;

    sleep(0.2); // Temps de préparation

    // 2. Upload des chunks (séquentiel, plus réaliste qu'en parallèle)
    for (let i = 0; i < numChunks; i++) {
        const chunkData = randomBytes(1024 * 1024); // 1MB

        const uploadRes = http.post(
            `${BASE_URL}/drive/upload_chunk_binary?file_id=${fileId}&index=${i}&iv=mock_iv_${randomString(16)}`,
            chunkData,
            {
                headers: getBinaryHeaders(token),
                tags: { name: 'upload_chunk', scenario: 'upload' },
            }
        );

        check(uploadRes, {
            'chunk uploaded': (r) => r.status === 200,
        });

        sleep(0.1); // Petit délai entre chunks (réseau)
    }

    // 3. Finaliser l'upload
    const finalizePayload = JSON.stringify({
        file_id: fileId,
        etat: 'completed',
    });

    const finalizeRes = http.post(
        `${BASE_URL}/drive/finalize_upload/${fileId}/completed`,
        finalizePayload,
        {
            headers: getHeaders(token),
            tags: { name: 'finalize_upload', scenario: 'upload' },
        }
    );

    check(finalizeRes, {
        'upload finalized': (r) => r.status === 200,
    });

    return fileId;
}

/**
 * Action: Lister les fichiers du drive
 */
function listFiles(token) {
    const res = http.get(`${BASE_URL}/drive/get_file_folder/root`, {
        headers: getHeaders(token),
        tags: { name: 'list_files' },
    });

    check(res, {
        'files listed': (r) => r.status === 200,
    });

    return res;
}

/**
 * Action: Télécharger un fichier
 */
function downloadFile(token, fileId) {
    const res = http.get(`${BASE_URL}/drive/download/${fileId}`, {
        headers: getHeaders(token),
        tags: { name: 'download_file', scenario: 'download' },
    });

    check(res, {
        'file downloaded': (r) => r.status === 200,
    });

    return res;
}

/**
 * Action: Obtenir les infos d'un fichier
 */
function getFileInfo(token, fileId) {
    const res = http.get(`${BASE_URL}/drive/file/${fileId}`, {
        headers: getHeaders(token),
        tags: { name: 'get_file_info' },
    });

    check(res, {
        'file info retrieved': (r) => r.status === 200,
    });

    return res;
}

// ==================== Scénario Principal ====================

export default function () {
    const user = generateUser();

    // ===== 1. INSCRIPTION ET CONNEXION =====
    group('Authentication', () => {
        const token = registerAndLogin(user);
        if (!token) {
            console.log('❌ Login failed, stopping scenario');
            return;
        }

        sleep(1); // L'utilisateur regarde la page d'accueil

        // ===== 2. EXPLORATION INITIALE =====
        group('Initial Exploration', () => {
            listFiles(token);
            sleep(2); // L'utilisateur parcourt la liste
        });

        // ===== 3. CRÉATION DE STRUCTURE =====
        group('Create Folder Structure', () => {
            const folderId = createFolder(token, 'Documents');
            sleep(1);

            if (Math.random() > 0.5) {
                createFolder(token, 'Photos');
                sleep(1);
            }
        });

        // ===== 4. UPLOAD DE FICHIERS (comportement principal) =====
        group('Upload Files', () => {
            const numFiles = Math.floor(Math.random() * 3) + 2; // 2 à 4 fichiers
            const uploadedFiles = [];

            for (let i = 0; i < numFiles; i++) {
                const numChunks = Math.floor(Math.random() * 3) + 2; // 2 à 4 chunks
                const fileId = uploadFile(token, `document_${i}`, numChunks);

                if (fileId) {
                    uploadedFiles.push(fileId);
                    console.log(`✅ File ${i + 1}/${numFiles} uploaded (${numChunks} chunks)`);
                }

                sleep(Math.random() * 3 + 2); // Pause entre uploads (2-5s)
            }

            // ===== 5. VÉRIFICATION DES UPLOADS =====
            group('Verify Uploads', () => {
                sleep(1);
                listFiles(token); // Rafraîchir la liste
                sleep(1);

                // Vérifier quelques fichiers uploadés
                uploadedFiles.slice(0, 2).forEach((fileId) => {
                    getFileInfo(token, fileId);
                    sleep(0.5);
                });
            });

            // ===== 6. TÉLÉCHARGEMENT (1 fichier sur 3 en moyenne) =====
            if (uploadedFiles.length > 0 && Math.random() > 0.66) {
                group('Download File', () => {
                    const fileToDownload = uploadedFiles[Math.floor(Math.random() * uploadedFiles.length)];
                    console.log(`📥 Downloading file: ${fileToDownload}`);
                    downloadFile(token, fileToDownload);
                    sleep(2); // Temps de traitement du fichier téléchargé
                });
            }
        });

        // ===== 7. NAVIGATION FINALE =====
        group('Final Navigation', () => {
            listFiles(token);
            sleep(1);
        });

        // Note: Pas de logout explicite (plus réaliste - les utilisateurs ferment souvent juste l'onglet)
    });

    // Pause entre itérations (pour éviter de créer trop d'utilisateurs trop vite)
    sleep(Math.random() * 2 + 1);
}

/**
 * Fonction de teardown (optionnelle)
 */
export function teardown(data) {
    console.log('\n📊 Test terminé');
    console.log('Consultez les métriques Prometheus pour l\'analyse détaillée');
}
