import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';
import { randomBytes } from 'k6/crypto';

export let options = {
    scenarios: {
        // Upload de fichiers INTENSIF avec chunks parallèles
        upload_stress: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '30s', target: 30 },    // Montée progressive
                { duration: '2m', target: 60 },     // Charge moyenne
                { duration: '2m', target: 100 },    // Charge élevée
                { duration: '1m', target: 30 },     // Retour
                { duration: '30s', target: 0 },
            ],
            gracefulRampDown: '30s',
        },
        // Download simultané avec upload
        download_stress: {
            executor: 'constant-vus',
            vus: 40,
            duration: '3m',
            startTime: '1m',
        },
    },
    thresholds: {
        http_req_duration: ['p(95)<2000', 'p(99)<5000'],
        http_req_failed: ['rate<0.15'],
        checks: ['rate>0.8'],
    },
};

const BASE_URL = 'https://gauzian.pupin.fr/api';

// Générer un utilisateur unique
function generateUniqueUser() {
    const timestamp = Date.now();
    const random = randomString(12);
    return {
        email: `upload_user_${timestamp}_${random}@test.gauzian.fr`,
        password: `SecurePass_${random}_123!`,
        username: `uploader_${random}`,
    };
}

// Headers avec token
function getAuthHeaders(token) {
    return {
        'Content-Type': 'application/json',
        'Cookie': `token=${token}`,
    };
}

function getAuthHeadersBinary(token) {
    return {
        'Content-Type': 'application/octet-stream',
        'Cookie': `token=${token}`,
    };
}

// Register et login
function registerAndLogin(user) {
    const cryptoData = {
        encrypted_private_key: 'mock_encrypted_key_' + randomString(32),
        public_key: 'mock_public_key_' + randomString(32),
        private_key_salt: 'mock_salt_' + randomString(16),
        iv: 'mock_iv_' + randomString(16),
        encrypted_record_key: 'mock_record_key_' + randomString(32),
    };

    const registerPayload = JSON.stringify({
        username: user.username,
        password: user.password,
        email: user.email,
        ...cryptoData,
    });

    http.post(`${BASE_URL}/register`, registerPayload, {
        headers: { 'Content-Type': 'application/json' },
    });

    sleep(0.1);

    const loginPayload = JSON.stringify({
        email: user.email,
        password: user.password,
    });

    const loginRes = http.post(`${BASE_URL}/login`, loginPayload, {
        headers: { 'Content-Type': 'application/json' },
    });

    let token = null;
    if (loginRes.headers['Set-Cookie']) {
        const cookieMatch = loginRes.headers['Set-Cookie'].match(/token=([^;]+)/);
        if (cookieMatch) {
            token = cookieMatch[1];
        }
    }

    return token;
}

// Initialiser un fichier pour upload
function initializeFile(token, filename = null) {
    const payload = JSON.stringify({
        size: 10485760, // 10MB
        mime_type: 'application/octet-stream',
        encrypted_file_key: 'mock_encrypted_file_key_' + randomString(32),
        encrypted_metadata: 'mock_encrypted_metadata_' + randomString(32),
        folder_id: 'root',
    });

    const res = http.post(`${BASE_URL}/drive/initialize_file`, payload, {
        headers: getAuthHeaders(token),
    });

    check(res, {
        'initialize file status is 200 or 201': (r) => r.status === 200 || r.status === 201,
    });

    let fileId = null;
    try {
        const body = JSON.parse(res.body);
        fileId = body.file_id || body.id;
    } catch (e) {}

    return { fileId, response: res };
}

// Générer des données binaires aléatoires
function generateChunkBytes(sizeBytes = 1024) {
    return randomBytes(sizeBytes);
}
// Upload un chunk
function uploadMultipleChunksParallel(token, fileId, numChunks = 5) {
    const requests = [];

    for (let i = 0; i < numChunks; i++) {
        requests.push({
            method: 'POST',
            url: `${BASE_URL}/drive/upload_chunk_binary?file_id=${fileId}&index=${i}&iv=mock_iv_${randomString(32)}`,
            body: generateChunkBytes(512),
            params: {
                headers: getAuthHeadersBinary(token),
            },
        });
    }

    const responses = http.batch(requests);

    responses.forEach((res) => {
        check(res, {
            'batch upload chunk status is 200': (r) => r.status === 200,
        });
    });

    return responses;
}

// Finaliser l'upload
function finalizeUpload(token, fileId) {
    const payload = JSON.stringify({
        file_id: fileId,
        etat: 'completed',  // 'completed' ou 'aborted' (backend validation)
    });

    const res = http.post(`${BASE_URL}/drive/finalize_upload/${fileId}/completed`, payload, {
        headers: getAuthHeaders(token),
    });

    check(res, {
        'finalize upload status is 200': (r) => r.status === 200,
    });

    return res;
}

// Obtenir info du fichier
function getFileInfo(token, fileId) {
    const res = http.get(`${BASE_URL}/drive/file/${fileId}`, {
        headers: getAuthHeaders(token),
    });

    check(res, {
        'get file info status is 200': (r) => r.status === 200,
    });

    return res;
}

// Télécharger le fichier
function downloadFile(token, fileId) {
    const res = http.get(`${BASE_URL}/drive/download/${fileId}`, {
        headers: getAuthHeaders(token),
    });

    check(res, {
        'download file status is 200': (r) => r.status === 200,
    });

    return res;
}

// Créer un dossier
function createFolder(token, folderName = null) {
    const payload = JSON.stringify({
        encrypted_metadata: 'mock_encrypted_metadata_' + randomString(32),
        parent_folder_id: 'root',
        encrypted_folder_key: 'mock_encrypted_folder_key_' + randomString(16),
    });

    const res = http.post(`${BASE_URL}/drive/create_folder`, payload, {
        headers: getAuthHeaders(token),
    });

    check(res, {
        'create folder status is 200 or 201': (r) => r.status === 200 || r.status === 201,
    });

    let folderId = null;
    try {
        const body = JSON.parse(res.body);
        folderId = body.folder_id || body.id;
    } catch (e) {}

    return { folderId, response: res };
}

// Scénario principal
export default function() {
    const user = generateUniqueUser();

    // Register + Login
    const token = registerAndLogin(user);
    if (!token) {
        return;
    }

    sleep(0.1);

    const scenario = Math.random();

    // Scénario 1: Upload complet avec chunks parallèles
    if (scenario < 0.5) {
        group('Upload File Scenario', () => {
            // 1. Initialiser le fichier
            const { fileId } = initializeFile(token);
            sleep(0.1);

            if (fileId) {
                // 2. Upload 10 chunks EN PARALLÈLE (très stressant!)
                uploadMultipleChunksParallel(token, fileId, 10);
                sleep(0.2);

                // 3. Finaliser l'upload
                finalizeUpload(token, fileId);
                sleep(0.1);

                // 4. Obtenir l'info du fichier
                getFileInfo(token, fileId);
                sleep(0.1);

                // 5. Télécharger le fichier
                downloadFile(token, fileId);
            }
        });
    }
    // Scénario 2: Upload + Download simultanés
    else if (scenario < 0.8) {
        group('Mixed Upload/Download Scenario', () => {
            // Upload 1
            const { fileId: fileId1 } = initializeFile(token, 'file1.bin');
            sleep(0.05);

            // Upload 2
            const { fileId: fileId2 } = initializeFile(token, 'file2.bin');
            sleep(0.05);

            if (fileId1) {
                uploadMultipleChunksParallel(token, fileId1, 5);
            }
            if (fileId2) {
                uploadMultipleChunksParallel(token, fileId2, 5);
            }

            sleep(0.1);

            // Finalize les deux en parallèle
            if (fileId1) {
                finalizeUpload(token, fileId1);
            }
            if (fileId2) {
                finalizeUpload(token, fileId2);
            }

            sleep(0.1);

            // Download les deux
            if (fileId1) {
                downloadFile(token, fileId1);
            }
            if (fileId2) {
                downloadFile(token, fileId2);
            }
        });
    }
    // Scénario 3: Création de dossiers + uploads multiples
    else {
        group('Folder + Multiple Uploads', () => {
            const { folderId } = createFolder(token);
            sleep(0.1);

            // Créer 3 fichiers et les uploader
            const fileIds = [];
            for (let i = 0; i < 3; i++) {
                const { fileId } = initializeFile(token, `file_${i}.bin`);
                if (fileId) {
                    fileIds.push(fileId);
                }
                sleep(0.05);
            }

            // Upload chunks pour tous les fichiers
            fileIds.forEach((fId) => {
                uploadMultipleChunksParallel(token, fId, 3);
                sleep(0.05);
            });

            // Finaliser tous
            fileIds.forEach((fId) => {
                finalizeUpload(token, fId);
                sleep(0.05);
            });
        });
    }

    sleep(0.1);
}
