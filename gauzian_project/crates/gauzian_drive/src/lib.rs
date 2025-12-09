use axum::{
    extract::{Json, Query, State}, // Utiliser Query pour l'entrée, Json pour la sortie
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
};
use gauzian_auth::verify_session_token;
use gauzian_core::{
    AppState, DownloadRequest, FinishStreamingUploadRequest, FolderCreationRequest, FolderRecord,
    FolderRenameRequest, FolderRequest, FullPathRequest, OpenStreamingUploadRequest, UploadRequest,
    UploadStreamingRequest,
};
use serde_json::json;
use sqlx::PgPool;

pub async fn upload_handler(
    State(state): State<AppState>,
    headers: HeaderMap,                 // <--- D'ABORD les headers
    Json(payload): Json<UploadRequest>, // <--- ENSUITE le Body (Json) à la toute fin
) -> impl IntoResponse {
    if payload.encrypted_blob.is_empty()
        || payload.encrypted_metadata.is_empty()
        || payload.encrypted_file_key.is_empty()
        || payload.media_type.is_empty()
        || payload.file_size == 0
    {
        return StatusCode::BAD_REQUEST.into_response();
    }

    // ... le reste de ta logique cookie reste identique ...
    let session_cookie = headers
        .get(axum::http::header::COOKIE)
        .and_then(|h| h.to_str().ok())
        .and_then(|cookies| {
            for cookie in cookies.split(';') {
                let cookie = cookie.trim();
                if cookie.starts_with("session_id=") {
                    return Some(cookie.trim_start_matches("session_id=").to_string());
                }
            }
            None
        });

    let session_token = match session_cookie {
        Some(token) => token,
        None => {
            let body = Json(json!({
                "status": "error",
                "message": "Pas de cookie de session trouvé"
            }));
            return (StatusCode::UNAUTHORIZED, body).into_response();
        }
    };
    // requet sql pour vérifier la session
    let user_id = match verify_session_token(&session_token, State(state.clone())).await {
        Ok(user_id) => user_id,
        Err(_) => {
            let body = Json(json!({
                "status": "error",
                "message": "Session invalide ou expirée"
            }));
            return (StatusCode::UNAUTHORIZED, body).into_response();
        }
    };

    // requet sql pour rajouter le fichier dans la bdd associée à user_id

    let vault_file_insert_result = sqlx::query!(
        r#"
        INSERT INTO vault_files (owner_id, encrypted_blob, encrypted_metadata,media_type,file_size,is_shared, created_at, updated_at,is_compressed,folder_id)
        VALUES ($1, $2, $3, $4, $5, false, NOW(), NOW(), false, $6)
        RETURNING id
        "#,
        user_id,
        payload.encrypted_blob.as_bytes(),
        payload.encrypted_metadata.as_bytes(),
        payload.media_type,
        payload.file_size as i64,
        payload.parent_folder_id,
    );

    match vault_file_insert_result.fetch_one(&state.db_pool).await {
        Ok(record) => {
            let file_access_insert_result = sqlx::query!(
                r#"
                INSERT INTO file_access (file_id, user_id, encrypted_file_key,permission_level,joined_at)
                VALUES ($1, $2, $3, 'owner', NOW())
                "#,
                record.id,
                user_id,
                payload.encrypted_file_key.as_bytes(),
            ).execute(&state.db_pool).await;
            match file_access_insert_result {
                Ok(_) => {
                    let body = Json(json!({
                        "status": "success",
                        "file_id": record.id,
                    }));
                    return (StatusCode::OK, body).into_response();
                }
                Err(e) => {
                    eprintln!("Erreur insertion accès fichier dans la BDD: {:?}", e);
                    let body = Json(json!({
                        "status": "error",
                        "message": "Erreur serveur lors de l'insertion de l'accès au fichier"
                    }));
                    return (StatusCode::INTERNAL_SERVER_ERROR, body).into_response();
                }
            }
        }
        Err(e) => {
            eprintln!("Erreur insertion fichier dans la BDD: {:?}", e);
            let body = Json(json!({
                "status": "error",
                "message": "Erreur serveur lors de l'insertion du fichier"
            }));
            return (StatusCode::INTERNAL_SERVER_ERROR, body).into_response();
        }
    }
}

// Pareil ici : si tu transformes ça en POST plus tard, garde Json à la fin
pub async fn download_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(payload): Query<DownloadRequest>,
) -> impl IntoResponse {
    // verifier le token
    let session_cookie = headers
        .get(axum::http::header::COOKIE)
        .and_then(|h| h.to_str().ok())
        .and_then(|cookies| {
            for cookie in cookies.split(';') {
                let cookie = cookie.trim();
                if cookie.starts_with("session_id=") {
                    return Some(cookie.trim_start_matches("session_id=").to_string());
                }
            }
            None
        });

    let session_token = match session_cookie {
        Some(token) => token,
        None => {
            let body = Json(json!({
                "status": "error",
                "message": "Pas de cookie de session trouvé"
            }));
            return (StatusCode::UNAUTHORIZED, body).into_response();
        }
    };
    // requet sql pour vérifier la session
    let user_id = match verify_session_token(&session_token, State(state.clone())).await {
        Ok(user_id) => user_id,
        Err(_) => {
            let body = Json(json!({
                "status": "error",
                "message": "Session invalide ou expirée"
            }));
            return (StatusCode::UNAUTHORIZED, body).into_response();
        }
    };

    // requet sql pour récupérer le fichier dans la bdd associée à user_id et payload.file_id
    let vault_file_query_result = sqlx::query!(
        r#"
        SELECT vf.encrypted_blob, vf.encrypted_metadata, fa.encrypted_file_key, vf.media_type, vf.file_size,vf.is_compressed
        FROM vault_files vf
        JOIN file_access fa ON vf.id = fa.file_id
        WHERE vf.id = $1 AND fa.user_id = $2 AND fa.permission_level IN ('owner', 'read', 'write')
        "#,
        payload.file_id,
        user_id,
    ).fetch_one(&state.db_pool).await;

    match vault_file_query_result {
        Ok(record) => {
            let body = Json(json!({
                "status": "success",
                "encrypted_blob": record.encrypted_blob
                    .and_then(|data| String::from_utf8(data).ok())
                    .unwrap_or_default(),
                "encrypted_metadata": String::from_utf8(record.encrypted_metadata).unwrap_or_default(),
                "encrypted_file_key": String::from_utf8(record.encrypted_file_key).unwrap_or_default(),
                "is_compressed": record.is_compressed,
                "media_type": record.media_type,
                "file_size": record.file_size,
            }));
            return (StatusCode::OK, body).into_response();
        }
        Err(e) => {
            eprintln!("Erreur récupération fichier dans la BDD: {:?}", e);
            let body = Json(json!({
                "status": "error",
                "message": "Fichier non trouvé ou accès refusé"
            }));
            return (StatusCode::NOT_FOUND, body).into_response();
        }
    };
}

pub async fn folder_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(payload): Query<FolderRequest>,
) -> impl IntoResponse {
    // verifier le token
    let session_cookie = headers
        .get(axum::http::header::COOKIE)
        .and_then(|h| h.to_str().ok())
        .and_then(|cookies| {
            for cookie in cookies.split(';') {
                let cookie = cookie.trim();
                if cookie.starts_with("session_id=") {
                    return Some(cookie.trim_start_matches("session_id=").to_string());
                }
            }
            None
        });

    let session_token = match session_cookie {
        Some(token) => token,
        None => {
            let body = Json(json!({
                "status": "error",
                "message": "Pas de cookie de session trouvé"
            }));
            return (StatusCode::UNAUTHORIZED, body).into_response();
        }
    };
    // requet sql pour vérifier la session
    let user_id = match verify_session_token(&session_token, State(state.clone())).await {
        Ok(user_id) => user_id,
        Err(_) => {
            let body = Json(json!({
                "status": "error",
                "message": "Session invalide ou expirée"
            }));
            return (StatusCode::UNAUTHORIZED, body).into_response();
        }
    };

    let parent_folder_id = payload.parent_folder_id;
    let folder_query_result = if let Some(parent_id) = parent_folder_id {
        // Cas 1 : Dossier enfant
        sqlx::query_as!(
            FolderRecord,
            r#"
            SELECT 
                f.is_root,
                f.id, 
                f.encrypted_metadata, 
                f.updated_at, 
                fa.encrypted_folder_key
            FROM folders f
            INNER JOIN folder_access fa ON f.id = fa.folder_id
            WHERE f.parent_id = $1 AND fa.user_id = $2
            ORDER BY f.updated_at DESC
            "#,
            parent_id,
            user_id,
        )
        .fetch_all(&state.db_pool)
        .await
    } else {
        // Cas 2 : Racine (parent_id IS NULL)
        sqlx::query_as!(
            FolderRecord,
            r#"
            SELECT 
                f.is_root,
                f.id, 
                f.encrypted_metadata, 
                f.updated_at, 
                fa.encrypted_folder_key
            FROM folders f
            INNER JOIN folder_access fa ON f.id = fa.folder_id
            WHERE f.is_root AND fa.user_id = $1
            ORDER BY f.updated_at DESC
            "#,
            user_id,
        )
        .fetch_all(&state.db_pool)
        .await
    };

    match folder_query_result {
        Ok(records) => {
            let folders: Vec<_> = records.into_iter().map(|record| {
                json!({
                    "folder_id": record.id,
                    "encrypted_metadata": String::from_utf8(record.encrypted_metadata).unwrap_or_default(),
                    "updated_at": record.updated_at,
                    "encrypted_folder_key": String::from_utf8(record.encrypted_folder_key).unwrap_or_default(),
                    "is_root": record.is_root,
                })
            }).collect();

            let body = Json(json!({
                "status": "success",
                "folders": folders,
            }));
            return (StatusCode::OK, body).into_response();
        }
        Err(e) => {
            eprintln!("Erreur récupération dossier dans la BDD: {:?}", e);
            let body = Json(json!({
                "status": "error",
                "message": "Dossier non trouvé ou accès refusé"
            }));
            return (StatusCode::NOT_FOUND, body).into_response();
        }
    };
}

pub async fn files_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(payload): Query<FolderRequest>,
) -> impl IntoResponse {
    // verifier le token
    let session_cookie = headers
        .get(axum::http::header::COOKIE)
        .and_then(|h| h.to_str().ok())
        .and_then(|cookies| {
            for cookie in cookies.split(';') {
                let cookie = cookie.trim();
                if cookie.starts_with("session_id=") {
                    return Some(cookie.trim_start_matches("session_id=").to_string());
                }
            }
            None
        });

    let session_token = match session_cookie {
        Some(token) => token,
        None => {
            let body = Json(json!({
                "status": "error",
                "message": "Pas de cookie de session trouvé"
            }));
            return (StatusCode::UNAUTHORIZED, body).into_response();
        }
    };
    // requet sql pour vérifier la session
    let user_id = match verify_session_token(&session_token, State(state.clone())).await {
        Ok(user_id) => user_id,
        Err(_) => {
            let body = Json(json!({
                "status": "error",
                "message": "Session invalide ou expirée"
            }));
            return (StatusCode::UNAUTHORIZED, body).into_response();
        }
    };

    let parent_folder_id = payload.parent_folder_id;

    let select_file_result = sqlx::query!(
        r#"
        SELECT vf.id, vf.encrypted_metadata, vf.updated_at, fa.encrypted_file_key
        FROM file_access fa
        JOIN vault_files vf ON fa.file_id = vf.id
        WHERE vf.folder_id = $1 AND fa.user_id = $2
        "#,
        parent_folder_id,
        user_id,
    )
    .fetch_all(&state.db_pool)
    .await;

    match select_file_result {
        Ok(records) => {
            let files: Vec<_> = records.into_iter().map(|record| {
                json!({
                    "file_id": record.id,
                    "encrypted_metadata": String::from_utf8(record.encrypted_metadata).unwrap_or_default(),
                    "updated_at": record.updated_at,
                    "encrypted_file_key": String::from_utf8(record.encrypted_file_key).unwrap_or_default(),
                })
            }).collect();

            let body = Json(json!({
                "status": "success",
                "files": files,
            }));
            return (StatusCode::OK, body).into_response();
        }
        Err(e) => {
            eprintln!("Erreur récupération fichier dans la BDD: {:?}", e);
            let body = Json(json!({
                "status": "error",
                "message": "Fichier non trouvé ou accès refusé"
            }));
            return (StatusCode::NOT_FOUND, body).into_response();
        }
    };
}

pub async fn create_folder_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<FolderCreationRequest>,
) -> impl IntoResponse {
    // verifier le token
    let session_cookie = headers
        .get(axum::http::header::COOKIE)
        .and_then(|h| h.to_str().ok())
        .and_then(|cookies| {
            for cookie in cookies.split(';') {
                let cookie = cookie.trim();
                if cookie.starts_with("session_id=") {
                    return Some(cookie.trim_start_matches("session_id=").to_string());
                }
            }
            None
        });

    let session_token = match session_cookie {
        Some(token) => token,
        None => {
            let body = Json(json!({
                "status": "error",
                "message": "Pas de cookie de session trouvé"
            }));
            return (StatusCode::UNAUTHORIZED, body).into_response();
        }
    };
    // requet sql pour vérifier la session
    let user_id = match verify_session_token(&session_token, State(state.clone())).await {
        Ok(user_id) => user_id,
        Err(_) => {
            let body = Json(json!({
                "status": "error",
                "message": "Session invalide ou expirée"
            }));
            return (StatusCode::UNAUTHORIZED, body).into_response();
        }
    };

    let parent_folder_id = payload.parent_folder_id;

    let insert_folder_result = sqlx::query!(
        r#"
        INSERT INTO folders (owner_id, parent_id, encrypted_metadata, is_root, created_at, updated_at)
        VALUES ($1, $2, $3, false, NOW(), NOW())
        RETURNING id
        "#,
        user_id,
        parent_folder_id,
        payload.encrypted_metadata.as_bytes(),
    ).fetch_one(&state.db_pool).await;

    match insert_folder_result {
        Ok(record) => {
            let folder_access_insert_result = sqlx::query!(
                r#"
                INSERT INTO folder_access (folder_id, user_id, encrypted_folder_key, permission_level)
                VALUES ($1, $2, $3, 'owner')
                "#,
                record.id,
                user_id,
                payload.encrypted_folder_key.as_bytes(),
            ).execute(&state.db_pool).await;
            match folder_access_insert_result {
                Ok(_) => {
                    let body = Json(json!({
                        "status": "success",
                        "folder_id": record.id,
                    }));
                    return (StatusCode::OK, body).into_response();
                }
                Err(e) => {
                    eprintln!("Erreur insertion accès dossier dans la BDD: {:?}", e);
                    let body = Json(json!({
                        "status": "error",
                        "message": "Erreur serveur lors de l'insertion de l'accès au dossier"
                    }));
                    return (StatusCode::INTERNAL_SERVER_ERROR, body).into_response();
                }
            }
        }
        Err(e) => {
            eprintln!("Erreur création dossier dans la BDD: {:?}", e);
            let body = Json(json!({
                "status": "error",
                "message": "Erreur serveur lors de la création du dossier"
            }));
            return (StatusCode::INTERNAL_SERVER_ERROR, body).into_response();
        }
    };
}

pub async fn full_path_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(payload): Query<FullPathRequest>,
) -> impl IntoResponse {
    // verifier le token
    let session_cookie = headers
        .get(axum::http::header::COOKIE)
        .and_then(|h| h.to_str().ok())
        .and_then(|cookies| {
            for cookie in cookies.split(';') {
                let cookie = cookie.trim();
                if cookie.starts_with("session_id=") {
                    return Some(cookie.trim_start_matches("session_id=").to_string());
                }
            }
            None
        });

    let session_token = match session_cookie {
        Some(token) => token,
        None => {
            let body = Json(json!({
                "status": "error",
                "message": "Pas de cookie de session trouvé"
            }));
            return (StatusCode::UNAUTHORIZED, body).into_response();
        }
    };
    // requet sql pour vérifier la session
    let user_id = match verify_session_token(&session_token, State(state.clone())).await {
        Ok(user_id) => user_id,
        Err(_) => {
            let body = Json(json!({
                "status": "error",
                "message": "Session invalide ou expirée"
            }));
            return (StatusCode::UNAUTHORIZED, body).into_response();
        }
    };

    let select_full_path_result = sqlx::query!(
        r#"
        WITH RECURSIVE folder_path AS (
            SELECT id, parent_id, encrypted_metadata, fa.encrypted_folder_key 
            FROM folders
            inner join folder_access fa on fa.folder_id = folders.id 
            WHERE id = $1 AND fa.user_id = $2
            UNION ALL
            SELECT f.id, f.parent_id, f.encrypted_metadata, fa.encrypted_folder_key 
            FROM folders f
            inner join folder_access fa on fa.folder_id = f.id 
            INNER JOIN folder_path fp ON f.id = fp.parent_id
        )
        SELECT id, parent_id, encrypted_metadata, encrypted_folder_key 
        FROM folder_path
        ORDER BY parent_id NULLS FIRST
        "#,
        payload.folder_id,
        user_id,
    )
    .fetch_all(&state.db_pool)
    .await;

    match select_full_path_result {
        Ok(records) => {
            let full_path: Vec<_> = records
                .into_iter()
                .map(|record| {
                    json!({
                        "folder_id": record.id,
                        "encrypted_metadata": record.encrypted_metadata
                            .and_then(|data| String::from_utf8(data).ok())
                            .unwrap_or_default(),
                        "encrypted_folder_key": record.encrypted_folder_key
                            .and_then(|data| String::from_utf8(data).ok())
                            .unwrap_or_default(),
                        "is_root": record.parent_id.is_none(),
                    })
                })
                .collect();

            let body = Json(json!({
                "status": "success",
                "full_path": full_path,
            }));
            return (StatusCode::OK, body).into_response();
        }
        Err(e) => {
            eprintln!("Erreur récupération chemin complet dans la BDD: {:?}", e);
            let body = Json(json!({
                "status": "error",
                "message": "Chemin non trouvé ou accès refusé"
            }));
            return (StatusCode::NOT_FOUND, body).into_response();
        }
    };
}

pub async fn rename_folder_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<FolderRenameRequest>,
) -> impl IntoResponse {
    // verifier le token
    let session_cookie = headers
        .get(axum::http::header::COOKIE)
        .and_then(|h| h.to_str().ok())
        .and_then(|cookies| {
            for cookie in cookies.split(';') {
                let cookie = cookie.trim();
                if cookie.starts_with("session_id=") {
                    return Some(cookie.trim_start_matches("session_id=").to_string());
                }
            }
            None
        });

    let session_token = match session_cookie {
        Some(token) => token,
        None => {
            let body = Json(json!({
                "status": "error",
                "message": "Pas de cookie de session trouvé"
            }));
            return (StatusCode::UNAUTHORIZED, body).into_response();
        }
    };
    // requet sql pour vérifier la session
    let user_id = match verify_session_token(&session_token, State(state.clone())).await {
        Ok(user_id) => user_id,
        Err(_) => {
            let body = Json(json!({
                "status": "error",
                "message": "Session invalide ou expirée"
            }));
            return (StatusCode::UNAUTHORIZED, body).into_response();
        }
    };

    let update_folder_result = sqlx::query!(
        r#"
        UPDATE folders
        SET encrypted_metadata = $1, updated_at = NOW()
        WHERE id = $2 AND owner_id = $3
        "#,
        payload.new_encrypted_metadata.as_bytes(),
        payload.folder_id,
        user_id,
    )
    .execute(&state.db_pool)
    .await;
    match update_folder_result {
        Ok(_) => {
            let body = Json(json!({
                "status": "success",
                "message": "Dossier renommé avec succès",
            }));
            return (StatusCode::OK, body).into_response();
        }
        Err(e) => {
            eprintln!("Erreur renommage dossier dans la BDD: {:?}", e);
            let body = Json(json!({
                "status": "error",
                "message": "Erreur serveur lors du renommage du dossier"
            }));
            return (StatusCode::INTERNAL_SERVER_ERROR, body).into_response();
        }
    };
}

pub async fn open_streaming_upload_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<OpenStreamingUploadRequest>,
) -> impl IntoResponse {
    // Cette requête est bien une POST (Json à la fin)
    // Vérifier le token
    let session_cookie = headers
        .get(axum::http::header::COOKIE)
        .and_then(|h| h.to_str().ok())
        .and_then(|cookies| {
            for cookie in cookies.split(';') {
                let cookie = cookie.trim();
                if cookie.starts_with("session_id=") {
                    return Some(cookie.trim_start_matches("session_id=").to_string());
                }
            }
            None
        });

    let session_token = match session_cookie {
        Some(token) => token,
        None => {
            let body = Json(json!({
                "status": "error",
                "message": "Pas de cookie de session trouvé"
            }));
            return (StatusCode::UNAUTHORIZED, body).into_response();
        }
    };
    // Requête SQL pour vérifier la session
    let user_id = match verify_session_token(&session_token, State(state.clone())).await {
        Ok(user_id) => user_id,
        Err(_) => {
            let body = Json(json!({
                "status": "error",
                "message": "Session invalide ou expirée"
            }));
            return (StatusCode::UNAUTHORIZED, body).into_response();
        }
    };

    // Création de l'entrée temporaire pour l'upload streaming
    let temp_upload_insert_result = sqlx::query!(
        r#"
        INSERT INTO streaming_file (owner_id, encrypted_metadata, media_type, file_size, created_at, folder_id)
        VALUES ($1, $2, $3, $4, NOW(), $5)
        RETURNING id
        "#,
        user_id,
        payload.encrypted_metadata.as_bytes(),
        payload.media_type,
        payload.file_size as i64,
        payload.parent_folder_id
    )
    .fetch_one(&state.db_pool)
    .await;

    match temp_upload_insert_result {
        Ok(record) => {
            let body = Json(json!({
                "status": "success",
                "temp_upload_id": record.id,
            }));
            return (StatusCode::OK, body).into_response();
        }
        Err(e) => {
            eprintln!("Erreur création upload streaming dans la BDD: {:?}", e);
            let body = Json(json!({
                "status": "error",
                "message": "Erreur serveur lors de la création de l'upload streaming"
            }));
            return (StatusCode::INTERNAL_SERVER_ERROR, body).into_response();
        }
    };
}
pub async fn upload_streaming_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<UploadStreamingRequest>,
) -> impl IntoResponse {
    let session_cookie = headers
        .get(axum::http::header::COOKIE)
        .and_then(|h| h.to_str().ok())
        .and_then(|cookies| {
            for cookie in cookies.split(';') {
                let cookie = cookie.trim();
                if cookie.starts_with("session_id=") {
                    return Some(cookie.trim_start_matches("session_id=").to_string());
                }
            }
            None
        });

    let session_token = match session_cookie {
        Some(token) => token,
        None => {
            let body = Json(json!({
                "status": "error",
                "message": "Pas de cookie de session trouvé"
            }));
            return (StatusCode::UNAUTHORIZED, body).into_response();
        }
    };
    // requet sql pour vérifier la session
    let user_id = match verify_session_token(&session_token, State(state.clone())).await {
        Ok(user_id) => user_id,
        Err(_) => {
            let body = Json(json!({
                "status": "error",
                "message": "Session invalide ou expirée"
            }));
            return (StatusCode::UNAUTHORIZED, body).into_response();
        }
    };

    let insert_chunk_result = sqlx::query!(
        r#"
        INSERT INTO streaming_file_chunks (temp_upload_id, chunk_index, encrypted_chunk, uploaded_at)
        VALUES ($1, $2, $3, NOW())
        "#,
        payload.temp_upload_id,
        payload.chunk_index as i64,
        payload.encrypted_chunk.as_bytes(),
    )
    .execute(&state.db_pool)
    .await;

    match insert_chunk_result {
        Ok(_) => {
            let body = Json(json!({
                "status": "success",
                "message": "Chunk uploadé avec succès",
            }));
            return (StatusCode::OK, body).into_response();
        }
        Err(e) => {
            eprintln!("Erreur insertion chunk dans la BDD: {:?}", e);
            let body = Json(json!({
                "status": "error",
                "message": "Erreur serveur lors de l'insertion du chunk"
            }));
            return (StatusCode::INTERNAL_SERVER_ERROR, body).into_response();
        }
    }
}

pub async fn finish_streaming_upload(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<FinishStreamingUploadRequest>,
) -> impl IntoResponse {
    let session_cookie = headers
        .get(axum::http::header::COOKIE)
        .and_then(|h| h.to_str().ok())
        .and_then(|cookies| {
            for cookie in cookies.split(';') {
                let cookie = cookie.trim();
                if cookie.starts_with("session_id=") {
                    return Some(cookie.trim_start_matches("session_id=").to_string());
                }
            }
            None
        });

    let session_token = match session_cookie {
        Some(token) => token,
        None => {
            let body = Json(json!({
                "status": "error",
                "message": "Pas de cookie de session trouvé"
            }));
            return (StatusCode::UNAUTHORIZED, body).into_response();
        }
    };
    // requet sql pour vérifier la session
    let user_id = match verify_session_token(&session_token, State(state.clone())).await {
        Ok(user_id) => user_id,
        Err(_) => {
            let body = Json(json!({
                "status": "error",
                "message": "Session invalide ou expirée"
            }));
            return (StatusCode::UNAUTHORIZED, body).into_response();
        }
    };

    let vault_file_insert_result = sqlx::query!(
        r#"
        INSERT INTO vault_files (owner_id, encrypted_metadata,media_type,file_size,is_shared, created_at, updated_at,is_compressed,folder_id,streaming_upload_id,is_chunked)
        VALUES ($1, $2, $3, $4, false, NOW(), NOW(), false, $5, $6, $7)
        RETURNING id
        "#,
        user_id,
        payload.encrypted_metadata.as_bytes(),
        payload.media_type,
        payload.file_size as i64,
        payload.parent_folder_id,
        payload.temp_upload_id,
        true,
    )
    .fetch_one(&state.db_pool)
    .await;

    match vault_file_insert_result {
        Ok(_) => {

            let create_access_result = sqlx::query!(
                r#"
                INSERT INTO file_access (file_id, user_id, encrypted_file_key,permission_level,joined_at)
                VALUES ($1, $2, $3, 'owner', NOW())
                "#,
                vault_file_insert_result.unwrap().id,
                user_id,
                payload.encrypted_file_key.as_bytes(),
            )
            .execute(&state.db_pool)
            .await;

            match create_access_result{
                Ok(_) => {},
                Err(e) => {
                    eprintln!("Erreur insertion accès fichier dans la BDD: {:?}", e);
                    let body = Json(json!({
                        "status": "error",
                        "message": "Erreur serveur lors de l'insertion de l'accès au fichier"
                    }));
                    return (StatusCode::INTERNAL_SERVER_ERROR, body).into_response();
                }
            }
            return (StatusCode::OK, body).into_response();
        }
        Err(e) => {
            eprintln!("Erreur finalisation upload streaming dans la BDD: {:?}", e);
            let body = Json(json!({
                "status": "error",
                "message": "Erreur serveur lors de la finalisation de l'upload streaming"
            }));
            return (StatusCode::INTERNAL_SERVER_ERROR, body).into_response();
        }
    }
}
