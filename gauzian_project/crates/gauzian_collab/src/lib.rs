use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Extension, Path, State,
    },
    http::StatusCode,
    response::IntoResponse,
    routing::get,
    Router,
};
use axum_extra::extract::cookie::CookieJar; // <--- Import Important
use dashmap::DashMap;
use futures::{sink::SinkExt, stream::StreamExt};
use std::sync::Arc;
use tokio::sync::broadcast;
use tracing::{error, info, warn};

use gauzian_core::AppState;

// --- Structures ---

#[derive(Debug)]
struct RoomState {
    tx: broadcast::Sender<Message>,
    history: Vec<Message>,
}

#[derive(Clone)]
pub struct CollabStore {
    rooms: Arc<DashMap<String, RoomState>>,
}

impl CollabStore {
    pub fn new() -> Self {
        Self {
            rooms: Arc::new(DashMap::new()),
        }
    }
}

pub fn router() -> Router<AppState> {
    Router::new().route("/ws/:room_id", get(ws_handler))
}

// --- Handler ---

async fn ws_handler(
    ws: WebSocketUpgrade,
    Path(room_id): Path<String>,
    State(_app_state): State<AppState>, // Pour vérifier l'accès DB plus tard
    Extension(collab_store): Extension<CollabStore>,
    jar: CookieJar, // <--- Axum récupère les cookies ici
) -> impl IntoResponse {
    // 1. Récupération du Token depuis le Cookie
    // Remplace "access_token" par le nom réel de ton cookie (ex: "auth-token", "jwt", etc.)
    let token_cookie = jar.get("access_token");

    let token = match token_cookie {
        Some(cookie) => cookie.value(),
        None => {
            warn!(
                "🛑 Tentative de connexion WS sans cookie auth pour doc: {}",
                room_id
            );
            // On rejette la connexion HTTP avec une erreur 401
            return StatusCode::UNAUTHORIZED.into_response();
        }
    };

    // 2. TODO: Validation du Token
    // Ici, tu dois appeler ta fonction de validation JWT existante dans gauzian_auth/core.
    // Exemple fictif :
    // match gauzian_auth::verify_jwt(token) {
    //     Ok(user_id) => info!("Utilisateur {} connecté au doc {}", user_id, room_id),
    //     Err(_) => return StatusCode::UNAUTHORIZED.into_response(),
    // }

    // Pour l'instant, on log juste qu'on a trouvé un token
    info!(
        "🔗 Connexion WS acceptée pour doc {} (Token présent)",
        room_id
    );

    // 3. Upgrade vers WebSocket
    ws.on_upgrade(move |socket| handle_socket(socket, room_id, collab_store))
}

async fn handle_socket(socket: WebSocket, room_id: String, store: CollabStore) {
    // ... (Le reste du code est identique à avant) ...
    let (mut sender, mut receiver) = socket.split();

    let tx = {
        let mut room = store.rooms.entry(room_id.clone()).or_insert_with(|| {
            info!("✨ Création de la room {}", room_id);
            let (tx, _rx) = broadcast::channel(100);
            RoomState {
                tx,
                history: Vec::new(),
            }
        });

        for msg in &room.history {
            if let Err(e) = sender.send(msg.clone()).await {
                error!("Erreur envoi historique: {}", e);
                return;
            }
        }
        room.tx.clone()
    };

    let mut rx = tx.subscribe();

    let mut send_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            if sender.send(msg).await.is_err() {
                break;
            }
        }
    });

    while let Some(Ok(msg)) = receiver.next().await {
        if matches!(msg, Message::Binary(_) | Message::Text(_)) {
            if let Some(mut room) = store.rooms.get_mut(&room_id) {
                room.history.push(msg.clone());
            }
            let _ = tx.send(msg);
        } else if matches!(msg, Message::Close(_)) {
            break;
        }
    }

    send_task.abort();
    info!("❌ Déconnexion WS doc : {}", room_id);
}
