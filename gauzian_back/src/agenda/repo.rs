use base64::Engine;
use sqlx::FromRow;
use sqlx::PgPool;
use uuid::Uuid; // Nécessaire pour .encode()

use super::handlers::CreateEventPayload;
use super::handlers::Event;

/// Convertit un tableau de bytes en String (UTF-8) ou en Base64 si nécessaire
fn bytes_to_text_or_b64(bytes: &[u8]) -> String {
    match std::str::from_utf8(bytes) {
        Ok(s) if !s.trim().is_empty() => s.to_string(),
        _ => base64::engine::general_purpose::STANDARD.encode(bytes),
    }
}

/// Struct intermédiaire pour mapper les BYTEA depuis la DB
#[derive(FromRow)]
struct EventRow {
    id: uuid::Uuid,
    title: String,
    description: Option<String>,
    day_id: i64,
    start_day_id: String,
    end_day_id: String,
    start_hour: String,
    end_hour: String,
    is_all_day: bool,
    is_multi_day: bool,
    category: Option<String>,
    color: Option<String>,
    encrypted_data_key: Vec<u8>, // BYTEA depuis DB
    created_at: String,
    updated_at: String,
}

impl From<EventRow> for Event {
    fn from(row: EventRow) -> Self {
        Event {
            id: row.id,
            title: row.title,
            description: row.description,
            day_id: row.day_id,
            start_day_id: row.start_day_id,
            end_day_id: row.end_day_id,
            start_hour: row.start_hour,
            end_hour: row.end_hour,
            is_all_day: row.is_all_day,
            is_multi_day: row.is_multi_day,
            category: row.category,
            color: row.color,
            encrypted_data_key: bytes_to_text_or_b64(&row.encrypted_data_key),
            created_at: row.created_at,
            updated_at: row.updated_at,
        }
    }
}

pub async fn get_events_date_to_date(
    pool: &PgPool,
    user_id: Uuid,
    start_date: &str,
    end_date: &str,
) -> Result<Vec<Event>, sqlx::Error> {
    let start_day_id: i64 = start_date.parse().map_err(|_| {
        sqlx::Error::Decode(Box::new(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "Invalid start_day_id",
        )))
    })?;
    let end_day_id: i64 = end_date.parse().map_err(|_| {
        sqlx::Error::Decode(Box::new(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "Invalid end_day_id",
        )))
    })?;

    let rows = sqlx::query_as::<_, EventRow>(
        r#"
            SELECT
                agenda_events.id,
                agenda_events.title,
                agenda_events.description,
                CAST(agenda_events.day_id AS BIGINT) as day_id,
                agenda_events.start_day_id,
                agenda_events.end_day_id,
                agenda_events.start_hour,
                agenda_events.end_hour,
                agenda_events.is_all_day,
                agenda_events.is_multi_day,
                COALESCE(agenda_events.category, agenda_categories.name, 'other') as category,
                agenda_events.color,
                agenda_events.encrypted_data_key,
                TO_CHAR(agenda_events.created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at,
                TO_CHAR(agenda_events.updated_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as updated_at
            FROM agenda_events
            LEFT JOIN agenda_event_participants
            ON agenda_events.id = agenda_event_participants.event_id
            LEFT JOIN agenda_categories
            ON agenda_events.category_id = agenda_categories.id
            WHERE agenda_event_participants.participant_id = $1
            AND agenda_events.day_id BETWEEN $2 AND $3
            ORDER BY agenda_events.day_id, agenda_events.start_hour
            "#,
    )
    .bind(user_id)
    .bind(start_day_id)
    .bind(end_day_id)
    .fetch_all(pool)
    .await?;

    // Convertir EventRow → Event (BYTEA → String)
    let events: Vec<Event> = rows.into_iter().map(|row| row.into()).collect();

    Ok(events)
}

pub async fn create_event(
    pool: &PgPool,
    user_id: Uuid,
    event: &CreateEventPayload,
) -> Result<Event, sqlx::Error> {
    let event_id = Uuid::new_v4();
    let row = sqlx::query_as::<_, EventRow>(
        r#"
        INSERT INTO agenda_events (id, title, description, day_id, start_day_id, end_day_id, start_hour, end_hour,
                                   is_all_day, is_multi_day, category_id, category, color, encrypted_data_key,
                                   created_at, updated_at, owner_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                (SELECT id from agenda_categories WHERE name = $11 AND owner_id = $14 LIMIT 1),
                $11, $12, $13, NOW(), NOW(), $14)
        RETURNING
            id,
            title,
            description,
            day_id,
            start_day_id,
            end_day_id,
            start_hour,
            end_hour,
            is_all_day,
            is_multi_day,
            COALESCE(category, (SELECT name FROM agenda_categories WHERE id = category_id)) as category,
            color,
            encrypted_data_key,
            TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at,
            TO_CHAR(updated_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as updated_at
        "#,
    )
    .bind(event_id)
    .bind(&event.title)
    .bind(&event.description)
    .bind(event.day_id)
    .bind(&event.start_day_id)
    .bind(&event.end_day_id)
    .bind(&event.start_hour)
    .bind(&event.end_hour)
    .bind(event.is_all_day)
    .bind(event.is_multi_day)
    .bind(&event.category)
    .bind(&event.color)
    .bind(event.encrypted_data_key.as_bytes())  // String → BYTEA
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    // Convertir EventRow → Event (BYTEA → String)
    Ok(row.into())
}

pub async fn add_event_participant(
    pool: &PgPool,
    event_id: Uuid,
    user_id: Uuid,
    encrypted_event_key: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        INSERT INTO agenda_event_participants (id, event_id, participant_id, encrypted_event_key)
        VALUES ($1, $2, $3, $4)
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(event_id)
    .bind(user_id)
    .bind(encrypted_event_key.as_bytes()) // String → BYTEA
    .execute(pool)
    .await?;
    Ok(())
}
