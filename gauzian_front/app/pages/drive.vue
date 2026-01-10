<template>
	<div class="page">
		
	</div>
    <main>
        <!-- multiple files -->
         <input type="file" multiple @change="handleFileChange" />
    </main>
</template>

<script setup>
import { ref } from "vue";
import { useHead } from "#imports"; // Nécessaire si tu es sous Nuxt, sinon à retirer
import { watch } from "vue";
definePageMeta({
    headerTitle: 'GZDRIVE'
})

import {
    getKeyStatus,
    encryptWithStoredPublicKey,
    generateDataKey,
    encryptSimpleDataWithDataKey,
    encryptDataWithDataKey,
} from "~/utils/crypto";

const API_URL = "https://gauzian.pupin.fr/api";

const etat = ref("login");
const loading = ref(false);


const autologin = async () => {
    console.log("Attempting auto-login...");
    try {
        const res = await fetch(`${API_URL}/autologin`, {
            method: "GET",
            credentials: "include",
        });
        if (res.ok) {

            let is_ok = await getKeyStatus();
            if (!is_ok) {
                console.warn("Keys not found or invalid in IndexedDB during auto-login.");
                window.location.href = "/login";
            }
            if (is_ok) {
                console.log("Auto-login successful, keys are valid.");
                etat.value = "drive";
                get_all_info();
                
            }
        }else {
            console.log("No valid session found for auto-login.");
            window.location.href = "/login";
        }
    } catch (error) {
        console.error("Auto-login failed:", error);
        // If there's a crypto error (like invalid base64), clear any corrupted data and redirect to login
        if (error.message.includes('base64') || error.message.includes('crypto')) {
            console.warn("Crypto error during auto-login, clearing corrupted data and redirecting to login");
            // Optionally clear IndexedDB here if needed
        }
        window.location.href = "/login";
    }
};

autologin();

useHead({
	title: "GZDRIVE | Drive",
	link: [
		{ rel: "preconnect", href: "https://fonts.googleapis.com" },
		{ rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" },
		{
			rel: "stylesheet",
			href:
				"https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,100..900;1,100..900&display=swap",
		},
	],
});

// drive logic

const totalSpaceLeft = ref(3 * 1024 * 1024 * 1024); // 3 GB in bytes
const usedSpace = ref(2 * 1024 * 1024 * 1024); // 2 GB in bytes
const listToUpload = ref([]);
const listUploadInProgress = ref([]);
const listUploaded = ref([]);
const simultaneousUploads = 3;

const formatBytes = (bytes) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Byte';
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
};

const handleFileChange = async (event) => {
    const files = event.target.files;
    var someSize = 0;
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        someSize += file.size;
        listToUpload.value.push(file);
    }
    if (someSize > (totalSpaceLeft.value - usedSpace.value)) {
        alert("Not enough space left to upload these files.");
        return;
    }
};

const initializeFileInDB = async (file, folder_id) => {
    const dataKey = await generateDataKey();
    const encryptedFileKey = await encryptWithStoredPublicKey(dataKey);
    console.log(file);
    const metadata = {
        filename: file.name,
        size: file.size,
        mime_type: file.type,
        last_modified: file.lastModified,
    };

    const stringifiedMetadata = JSON.stringify(metadata);
    console.log("Stringified Metadata:", stringifiedMetadata);

    const encryptedMetadata = await encryptSimpleDataWithDataKey(
        stringifiedMetadata,
        dataKey
    );

    const res = await fetch(`${API_URL}/drive/initialize_file`, {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            encrypted_metadata : encryptedMetadata,
            encrypted_file_key: encryptedFileKey,
            size: file.size,
            mime_type: file.type,
            folder_id: folder_id,
        }),
    });
    if (!res.ok) {
        throw new Error("Failed to initialize file in DB");
    }
    const resData = await res.json();
    return [resData.file_id, dataKey];
};  


const uploadFile = async (file, file_id, dataKey) => {
    const chunkSize = 1 * 1024 * 1024; // 1 MB (réduit pour éviter stack overflow)
    const totalChunks = Math.ceil(file.size / chunkSize);
    
    // Limite le nombre d'envois simultanés pour ne pas tuer le navigateur
    // 3 à 5 est généralement un bon chiffre.
    const CONCURRENCY_LIMIT = 3; 

    // Cette fonction gère l'upload d'un index précis
    const uploadChunkByIndex = async (index) => {
        const start = index * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        
        const chunk = file.slice(start, end);

        const {cipherText,iv} = await encryptDataWithDataKey(
            chunk,
            dataKey
        );
        console.log(cipherText,iv);
        // envoi du chunk au backend
        const body = {
            file_id: file_id,
            index: index,
            chunk_data: cipherText,
            iv: iv,
        }
        const res = await fetch(`${API_URL}/drive/upload_chunk`, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            throw new Error(`Failed to upload chunk ${index}`);
        }
        console.log(`Uploaded chunk ${index + 1}/${totalChunks} for file ${file.name}`);
        
    };

    // Gestionnaire de file d'attente (Pool)
    const queue = [];
    for (let i = 0; i < totalChunks; i++) {
        queue.push(i);
    }

    const worker = async () => {
        while (queue.length > 0) {
            // On récupère le prochain index à traiter
            const index = queue.shift(); 
            try {
                await uploadChunkByIndex(index);
            } catch (err) {
                console.error(`Echec chunk ${index}`, err);
                // Optionnel : remettre dans la queue pour réessayer
                // queue.push(index); 
            }
        }
    };

    // On lance 'CONCURRENCY_LIMIT' workers en parallèle
    const workers = [];
    for (let i = 0; i < Math.min(CONCURRENCY_LIMIT, totalChunks); i++) {
        workers.push(worker());
    }

    // On attend que tous les workers aient fini
    await Promise.all(workers);

    console.log(`Finished uploading file: ${file.name}`);
};

// use effect on listToUpload to start upload


const get_all_info = async () => {
    console.log("Fetching all drive info...");

    const id_parent_folder = null; // à modifier plus tard pour la navigation dans les dossiers

    const res = await fetch(`${API_URL}/drive/get_all_drive_info/${id_parent_folder}`, {
        method: "GET",
        credentials: "include",
    });
    if (!res.ok) {
        throw new Error("Failed to get all drive info");
    }
    const resData = await res.json();
    const drive_info = resData.drive_info;
    const files_folders = resData.files_and_folders;
    const user_info = resData.user_info;
};




const startUploads = async () => {
    while (
        listUploadInProgress.value.length < simultaneousUploads &&
        listToUpload.value.length > 0
    ) {
        const file = listToUpload.value.shift();
        listUploadInProgress.value.push(file);

        const [file_id, dataKey] = await initializeFileInDB(file, null);

        uploadFile(file,file_id,dataKey).then(() => {
            listUploadInProgress.value = listUploadInProgress.value.filter(f => f !== file);
            listUploaded.value.push(file);
            startUploads();
        });
    }
};

watch(
    [listToUpload, listUploadInProgress],
    () => {
        startUploads();
    },
    { deep: true }
);



</script>

<style>
body {
	background-color: white;
}

* {
	margin: 0;
	padding: 0;
	box-sizing: border-box;
	user-select: none;
}

</style>