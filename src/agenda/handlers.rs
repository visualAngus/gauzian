
use axum::{extract::State, http::StatusCode, Json, extract::Query};
use serde::{Deserialize, Serialize};
// uuid
use uuid::Uuid;
use crate::{auth::Claims, response::ApiResponse, state::AppState};
use sqlx::FromRow;



#[derive(Serialize)]
pub struct EventResponse {
    events: Vec<Event>,
}

#[derive(Serialize, Deserialize, Debug, FromRow)]
pub struct Event {
    pub id: Uuid,
    pub title: String,
    pub description: Option<String>,
    #[serde(rename = "dayId")]
    pub day_id: i64,
    #[serde(rename = "startDayId")]
    pub start_day_id: String,  // Crypté → TEXT
    #[serde(rename = "endDayId")]
    pub end_day_id: String,    // Crypté → TEXT
    #[serde(rename = "startHour")]
    pub start_hour: String,     // Crypté → TEXT
    #[serde(rename = "endHour")]
    pub end_hour: String,       // Crypté → TEXT
    #[serde(rename = "isAllDay")]
    pub is_all_day: bool,
    #[serde(rename = "isMultiDay")]
    pub is_multi_day: bool,
    pub category: Option<String>,
    pub color: Option<String>,
    #[serde(rename = "encryptedDataKey")]
    pub encrypted_data_key: String,  // Clé de chiffrement (converti depuis BYTEA)
    pub created_at: String,
    pub updated_at: String,
}
#[derive(Deserialize)]
pub struct EventsQuery {
    #[serde(rename = "startDayId")]
    pub start_day_id: String,
    #[serde(rename = "endDayId")]
    pub end_day_id: String,
}

pub async fn get_events_handler(
    State(state): State<AppState>,
    claims: Claims,
    Query(params): Query<EventsQuery>,
) -> Result<Json<ApiResponse<EventResponse>>, (StatusCode, String)> {
    let pool = &state.db_pool;
    let user_id = claims.id;
    let events = super::repo::get_events_date_to_date(
            pool,
            user_id,
            &params.start_day_id,
            &params.end_day_id,
        )
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Internal server error".to_string(),
        )
    })?;
    
    Ok(Json(ApiResponse::ok(EventResponse { events })))
}
#[derive(Deserialize)]
pub struct CreateEventPayload {
    pub title: String,
    pub description: Option<String>,
    #[serde(rename = "dayId")]
    pub day_id: i64,
    #[serde(rename = "startHour")]
    pub start_hour: String,     // Crypté → TEXT
    #[serde(rename = "endHour")]
    pub end_hour: String,       // Crypté → TEXT
    #[serde(rename = "startDayId")]
    pub start_day_id: String,   // Crypté → TEXT
    #[serde(rename = "endDayId")]
    pub end_day_id: String,     // Crypté → TEXT
    #[serde(rename = "isAllDay")]
    pub is_all_day: bool,
    #[serde(rename = "isMultiDay")]
    pub is_multi_day: bool,
    pub category: Option<String>,
    pub color: Option<String>,
    #[serde(rename = "encryptedDataKey")]
    pub encrypted_data_key: String,
}

pub async fn create_event_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(payload): Json<CreateEventPayload>,
) -> Result<Json<ApiResponse<EventResponse>>, (StatusCode, String)> {



    let new_event = super::repo::create_event(
        &state.db_pool,
        claims.id,
        &payload,
    )
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Internal server error".to_string(),
        )
    })?;


    let _event_access = super::repo::add_event_participant(
        &state.db_pool,
        new_event.id,
        claims.id,
        &payload.encrypted_data_key,
    )
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Internal server error".to_string(),
        )
    })?;

    Ok(Json(ApiResponse::ok(EventResponse { events: vec![new_event] })))
}