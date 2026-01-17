import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';
import encoding from 'k6/encoding';

// Configuration STRESS TEST COMPLET - 25-30 minutes
export let options = {
    scenarios: {
        // Montée progressive puis charge soutenue - 30 min
        main_stress: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '2m', target: 20 },      // Warm-up
                { duration: '3m', target: 50 },      // Montée progressive
                { duration: '5m', target: 100 },     // Charge moyenne
                { duration: '5m', target: 150 },     // Charge élevée
                { duration: '5m', target: 200 },     // Charge maximale
                { duration: '5m', target: 150 },     // Descente progressive
                { duration: '3m', target: 80 },      // Retour calme
                { duration: '2m', target: 0 },       // Cool-down
            ],
            gracefulRampDown: '30s',
        },
        // Upload intensif en parallèle
        upload_hammer: {
            executor: 'constant-vus',
            vus: 60,
            duration: '20m',
            startTime: '3m',
        },
        // Download intensif
        download_hammer: {
            executor: 'constant-vus',
            vus: 40,
            duration: '15m',
            startTime: '5m',
        },
        // Spike test - pic violent à mi-parcours
        spike_test: {
            executor: 'ramping-vus',
            startVUs: 10,
            stages: [
                { duration: '30s', target: 10 },
                { duration: '10s', target: 250 },    // Pic violent
                { duration: '1m', target: 250 },     // Maintien
                { duration: '30s', target: 10 },
            ],
            startTime: '15m',
        },
    },
    thresholds: {
        http_req_duration: ['p(95)<3000', 'p(99)<8000'],
        http_req_failed: ['rate<0.25'],
        checks: ['rate>0.75'],
    },
};

const BASE_URL = 'https://gauzian.pupin.fr/api';

// Générer un utilisateur unique
function generateUniqueUser() {
    const timestamp = Date.now();
    const random = randomString(12);
    return {
        email: `stress_user_${timestamp}_${random}@test.gauzian.fr`,
        password: `SecurePass_${random}_123!`,
        username: `stress_${random}`,
    };
}

// Données crypto mockées
function getMockCryptoData() {
    return {
        encrypted_private_key: 'mock_encrypted_key_' + randomString(32),
        public_key: 'mock_public_key_' + randomString(32),
        private_key_salt: 'mock_salt_' + randomString(16),
        iv: 'mock_iv_' + randomString(16),
        encrypted_record_key: 'mock_record_key_' + randomString(32),
    };
}

// Headers avec token
function getAuthHeaders(token) {
    return {
        'Content-Type': 'application/json',
        'Cookie': `token=${token}`,
    };
}

// Générer des chunks Base64 de taille variable (optimisé pour gros chunks)
function generateBase64ChunkData(sizeKB = 1) {
    // Générer des données par blocs pour éviter les problèmes de mémoire
    const blockSize = 1024; // 1KB par bloc
    const numBlocks = sizeKB;
    let data = '';
    
    for (let i = 0; i < numBlocks; i++) {
        let block = '';
        for (let j = 0; j < blockSize; j++) {
            block += String.fromCharCode(Math.floor(Math.random() * 256));
        }
        data += block;
    }
    
    return encoding.b64encode(data);
}

// Register
function registerUser(user) {
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
        'register status OK': (r) => r.status === 200 || r.status === 201,
    });

    return res;
}

// Login
function loginUser(user) {
    const payload = JSON.stringify({
        email: user.email,
        password: user.password,
    });

    const res = http.post(`${BASE_URL}/login`, payload, {
        headers: { 'Content-Type': 'application/json' },
    });

    check(res, {
        'login status OK': (r) => r.status === 200,
    });

    let token = null;
    if (res.headers['Set-Cookie']) {
        const cookieMatch = res.headers['Set-Cookie'].match(/token=([^;]+)/);
        if (cookieMatch) {
            token = cookieMatch[1];
        }
    }

    return token;
}

// Autologin
function testAutoLogin(token) {
    const res = http.get(`${BASE_URL}/autologin`, {
        headers: getAuthHeaders(token),
    });
    check(res, { 'autologin OK': (r) => r.status === 200 });
    return res;
}

// Protected endpoint
function testProtected(token) {
    const res = http.get(`${BASE_URL}/protected`, {
        headers: getAuthHeaders(token),
    });
    check(res, { 'protected OK': (r) => r.status === 200 });
    return res;
}

// Info endpoint
function testInfo(token) {
    const res = http.get(`${BASE_URL}/info`, {
        headers: getAuthHeaders(token),
    });
    check(res, { 'info OK': (r) => r.status === 200 });
    return res;
}

// Créer un dossier
function createFolder(token, parentId = 'root') {
    const payload = JSON.stringify({
        encrypted_metadata: 'mock_encrypted_metadata_' + randomString(32),
        parent_folder_id: parentId,
        encrypted_folder_key: 'mock_encrypted_folder_key_' + randomString(16),
    });

    const res = http.post(`${BASE_URL}/drive/create_folder`, payload, {
        headers: getAuthHeaders(token),
    });

    check(res, {
        'create folder OK': (r) => r.status === 200 || r.status === 201,
    });

    let folderId = null;
    try {
        const body = JSON.parse(res.body);
        folderId = body.folder_id || body.id;
    } catch (e) {}

    return folderId;
}

// Get drive info
function getDriveInfo(token, parentId = 'root') {
    const res = http.get(`${BASE_URL}/drive/get_all_drive_info/${parentId}`, {
        headers: getAuthHeaders(token),
    });
    check(res, { 'get drive info OK': (r) => r.status === 200 });
    return res;
}

// Get folder contents
function getFolderContents(token, folderId) {
    const res = http.get(`${BASE_URL}/drive/folder_contents/${folderId}`, {
        headers: getAuthHeaders(token),
    });
    check(res, { 'get folder contents OK': (r) => r.status === 200 });
    return res;
}

// Rename folder
function renameFolder(token, folderId) {
    const payload = JSON.stringify({
        folder_id: folderId,
        new_encrypted_metadata: 'mock_renamed_metadata_' + randomString(32),
    });

    const res = http.post(`${BASE_URL}/drive/rename_folder`, payload, {
        headers: getAuthHeaders(token),
    });
    check(res, { 'rename folder OK': (r) => r.status === 200 });
    return res;
}

// Delete folder
function deleteFolder(token, folderId) {
    const payload = JSON.stringify({
        folder_id: folderId,
    });

    const res = http.post(`${BASE_URL}/drive/delete_folder`, payload, {
        headers: getAuthHeaders(token),
    });
    check(res, { 'delete folder OK': (r) => r.status === 200 });
    return res;
}

// Initialiser un fichier
function initializeFile(token, sizeBytes = 5242880, folderId = 'root') {
    const payload = JSON.stringify({
        size: sizeBytes,
        mime_type: 'application/octet-stream',
        encrypted_file_key: 'mock_encrypted_file_key_' + randomString(32),
        encrypted_metadata: 'mock_encrypted_metadata_' + randomString(32),
        folder_id: folderId,
    });

    const res = http.post(`${BASE_URL}/drive/initialize_file`, payload, {
        headers: getAuthHeaders(token),
    });

    check(res, {
        'initialize file OK': (r) => r.status === 200 || r.status === 201,
    });

    let fileId = null;
    try {
        const body = JSON.parse(res.body);
        fileId = body.file_id || body.id;
    } catch (e) {}

    return fileId;
}

// Upload un chunk simple (max 1MB = 1024KB)
function uploadChunk(token, fileId, index, chunkSizeKB = 256) {
    const payload = JSON.stringify({
        file_id: fileId,
        index: index,
        chunk_data: generateBase64ChunkData(chunkSizeKB),
        iv: 'mock_iv_' + randomString(32),
    });

    const res = http.post(`${BASE_URL}/drive/upload_chunk`, payload, {
        headers: getAuthHeaders(token),
    });

    check(res, {
        'upload chunk OK': (r) => r.status === 200,
    });

    return res;
}

// Upload plusieurs chunks en parallèle (batch) - max 1MB par chunk
function uploadChunksBatch(token, fileId, numChunks = 5, chunkSizeKB = 256) {
    const requests = [];

    for (let i = 0; i < numChunks; i++) {
        requests.push({
            method: 'POST',
            url: `${BASE_URL}/drive/upload_chunk`,
            body: JSON.stringify({
                file_id: fileId,
                index: i,
                chunk_data: generateBase64ChunkData(chunkSizeKB),
                iv: 'mock_iv_' + randomString(32),
            }),
            params: {
                headers: getAuthHeaders(token),
            },
        });
    }

    const responses = http.batch(requests);
    
    responses.forEach((res) => {
        check(res, {
            'batch upload chunk OK': (r) => r.status === 200,
        });
    });

    return responses;
}

// Finaliser l'upload
function finalizeUpload(token, fileId) {
    const payload = JSON.stringify({
        file_id: fileId,
        etat: 'fully_uploaded',
    });

    const res = http.post(`${BASE_URL}/drive/finalize_upload/${fileId}/fully_uploaded`, payload, {
        headers: getAuthHeaders(token),
    });

    check(res, {
        'finalize upload OK': (r) => r.status === 200,
    });

    return res;
}

// Get file info
function getFileInfo(token, fileId) {
    const res = http.get(`${BASE_URL}/drive/file/${fileId}`, {
        headers: getAuthHeaders(token),
    });
    check(res, { 'get file info OK': (r) => r.status === 200 });
    return res;
}

// Download file
function downloadFile(token, fileId) {
    const res = http.get(`${BASE_URL}/drive/download/${fileId}`, {
        headers: getAuthHeaders(token),
    });
    check(res, { 'download file OK': (r) => r.status === 200 });
    return res;
}

// Logout
function logoutUser(token) {
    const res = http.post(`${BASE_URL}/logout`, null, {
        headers: getAuthHeaders(token),
    });
    check(res, { 'logout OK': (r) => r.status === 200 });
    return res;
}

// SCÉNARIO PRINCIPAL - Mix de tout
export default function() {
    const user = generateUniqueUser();
    const scenario = Math.random();

    // Register + Login
    registerUser(user);
    sleep(0.1);
    const token = loginUser(user);
    
    if (!token) {
        return;
    }

    sleep(0.05);

    // Scénario 1: Test auth complet (15%)
    if (scenario < 0.15) {
        group('Auth Complete Flow', () => {
            testAutoLogin(token);
            sleep(0.05);
            testProtected(token);
            sleep(0.05);
            testInfo(token);
            sleep(0.05);
            logoutUser(token);
        });
    }
    
    // Scénario 2: Upload petit fichier avec chunks moyens (25%)
    else if (scenario < 0.40) {
        group('Small File Upload', () => {
            const fileId = initializeFile(token, 2097152); // 2MB
            sleep(0.05);
            
            if (fileId) {
                // Upload 4 chunks de 512KB chacun
                uploadChunksBatch(token, fileId, 4, 512);
                sleep(0.1);
                finalizeUpload(token, fileId);
                sleep(0.05);
                getFileInfo(token, fileId);
                sleep(0.05);
                downloadFile(token, fileId);
            }
        });
    }
    
    // Scénario 3: Upload fichier moyen avec gros chunks (20%)
    else if (scenario < 0.60) {
        group('Medium File Upload - Big Chunks', () => {
            const fileId = initializeFile(token, 10485760); // 10MB
            sleep(0.05);
            
            if (fileId) {
                // Upload 10 chunks de 1MB chacun (chunks max!)
                for (let i = 0; i < 10; i++) {
                    uploadChunk(token, fileId, i, 1024); // 1MB chunks (max)
                    sleep(0.1);
                }
                finalizeUpload(token, fileId);
                sleep(0.05);
                downloadFile(token, fileId);
            }
        });
    }
    
    // Scénario 4: Multi-fichiers parallèles (20%)
    else if (scenario < 0.80) {
        group('Multiple Files Parallel', () => {
            const fileIds = [];
            
            // Créer 3 fichiers
            for (let i = 0; i < 3; i++) {
                const fId = initializeFile(token, 1048576); // 1MB chacun
                if (fId) fileIds.push(fId);
                sleep(0.03);
            }
            
            // Upload chunks pour tous
            fileIds.forEach((fId, idx) => {
                uploadChunksBatch(token, fId, 2, 512); // 2 chunks de 512KB
                sleep(0.05);
            });
            
            // Finaliser tous
            fileIds.forEach((fId) => {
                finalizeUpload(token, fId);
                sleep(0.03);
            });
            
            // Download tous
            fileIds.forEach((fId) => {
                downloadFile(token, fId);
                sleep(0.03);
            });
        });
    }
    
    // Scénario 5: Test folders + files complet (20%)
    else {
        group('Folders + Files Complete', () => {
            // Créer structure de dossiers
            const folder1 = createFolder(token, 'root');
            sleep(0.05);
            
            if (folder1) {
                getDriveInfo(token, 'root');
                sleep(0.05);
                
                getFolderContents(token, folder1);
                sleep(0.05);
                
                // Créer un sous-dossier
                const folder2 = createFolder(token, folder1);
                sleep(0.05);
                
                // Upload un fichier dans folder1
                const fileId = initializeFile(token, 524288, folder1); // 512KB
                if (fileId) {
                    uploadChunk(token, fileId, 0, 512);
                    sleep(0.05);
                    finalizeUpload(token, fileId);
                    sleep(0.05);
                    getFileInfo(token, fileId);
                }
                
                // Renommer folder1
                renameFolder(token, folder1);
                sleep(0.05);
                
                // Supprimer folder2
                if (folder2) {
                    deleteFolder(token, folder2);
                    sleep(0.05);
                }
            }
            
            logoutUser(token);
        });
    }

    sleep(0.1);
}
