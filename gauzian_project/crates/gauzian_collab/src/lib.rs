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

#[axum::debug_handler]
async fn ws_handler(
    ws: WebSocketUpgrade,
    Path(room_id): Path<String>,
    State(state): State<AppState>,
    Extension(collab_store): Extension<CollabStore>,
) -> impl IntoResponse {
    // 1. Vérification de l'authentification via le state
    // (L'authentification middleware doit être appliqué à la route)
    
    info!(
        "🔗 Connexion WS acceptée pour doc {} (Token présent)",
        room_id
    );

    // 2. Upgrade vers WebSocket
    ws.on_upgrade(move |socket| handle_socket(socket, room_id, collab_store, state))
}

async fn handle_socket(socket: WebSocket, room_id: String, store: CollabStore, _state: AppState) {
    // _state peut être utilisé plus tard pour DB queries
    info!("🔗 Socket connected for room: {}", room_id);
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
        info!("📨 Received message from {} (type: {:?})", room_id, msg);
        if matches!(msg, Message::Binary(_) | Message::Text(_)) {
            match &msg {
                Message::Binary(bin) => {
                    info!("📩 WS update doc {} ({} bytes, binary)", room_id, bin.len());
                }
                Message::Text(txt) => {
                    info!("📩 WS update doc {} (text, {} chars)", room_id, txt.len());
                }
                _ => {}
            }

            if let Some(mut room) = store.rooms.get_mut(&room_id) {
                room.history.push(msg.clone());
            }
            let _ = tx.send(msg);
        } else if matches!(msg, Message::Close(_)) {
            info!("📤 Close message received for {}", room_id);
            break;
        } else {
            info!("❓ Other message type for {}: {:?}", room_id, msg);
        }
    }

    send_task.abort();
    info!("❌ Déconnexion WS doc : {}", room_id);
}
