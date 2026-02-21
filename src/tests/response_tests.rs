use axum::{
    body::{to_bytes, Body},
    http::{header::SET_COOKIE, StatusCode},
    response::IntoResponse,
};
use serde_json::{json, Value};
use std::sync::{LazyLock, Mutex};

use crate::response::{ApiResponse, ErrorResponse};

static ENV_LOCK: LazyLock<Mutex<()>> = LazyLock::new(|| Mutex::new(()));

async fn response_body_json(response: axum::response::Response<Body>) -> Value {
    let bytes = to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("body should be readable");
    serde_json::from_slice(&bytes).expect("body should be valid json")
}

#[tokio::test]
async fn test_api_response_ok_returns_200_and_json_data() {
    let response = ApiResponse::ok(json!({ "message": "ok" })).into_response();

    assert_eq!(response.status(), StatusCode::OK);
    let body = response_body_json(response).await;
    assert_eq!(body, json!({ "message": "ok" }));
}

#[tokio::test]
async fn test_api_response_conflict_returns_409_and_error_body() {
    let response = ApiResponse::<ErrorResponse>::conflict("already exists").into_response();

    assert_eq!(response.status(), StatusCode::CONFLICT);
    let body = response_body_json(response).await;
    assert_eq!(body, json!({ "error": "already exists" }));
}

#[tokio::test]
async fn test_api_response_with_token_sets_cookie_header() {
    let response = ApiResponse::ok(json!({ "logged": true }))
        .with_token("jwt-token-value".to_string())
        .into_response();

    let cookie_header = response
        .headers()
        .get(SET_COOKIE)
        .expect("Set-Cookie header should be present")
        .to_str()
        .expect("Set-Cookie header should be valid UTF-8");

    assert!(cookie_header.contains("auth_token=jwt-token-value"));
    assert!(cookie_header.contains("Path=/"));
    assert!(cookie_header.contains("HttpOnly"));
    assert!(cookie_header.contains("SameSite=Strict"));
}

#[tokio::test]
async fn test_api_response_without_token_has_no_cookie_header() {
    let response = ApiResponse::ok(json!({ "logged": false })).into_response();

    assert!(response.headers().get(SET_COOKIE).is_none());
}

#[tokio::test]
async fn test_api_response_cookie_secure_flag_false_when_env_is_false() {
    let _lock = ENV_LOCK.lock().expect("env lock should be acquired");
    unsafe { std::env::set_var("COOKIE_SECURE", "false") };

    let response = ApiResponse::ok(json!({ "logged": true }))
        .with_token("jwt-token-value".to_string())
        .into_response();

    let cookie_header = response
        .headers()
        .get(SET_COOKIE)
        .expect("Set-Cookie header should be present")
        .to_str()
        .expect("Set-Cookie header should be valid UTF-8");

    assert!(!cookie_header.contains("Secure"), "Secure must be disabled when COOKIE_SECURE=false");

    unsafe { std::env::remove_var("COOKIE_SECURE") };
}

#[tokio::test]
async fn test_api_response_cookie_secure_flag_true_by_default_and_when_true() {
    let _lock = ENV_LOCK.lock().expect("env lock should be acquired");

    unsafe { std::env::remove_var("COOKIE_SECURE") };
    let response_default = ApiResponse::ok(json!({ "logged": true }))
        .with_token("jwt-token-value".to_string())
        .into_response();

    let cookie_default = response_default
        .headers()
        .get(SET_COOKIE)
        .expect("Set-Cookie header should be present")
        .to_str()
        .expect("Set-Cookie header should be valid UTF-8");
    assert!(cookie_default.contains("Secure"), "Secure must be enabled by default");

    unsafe { std::env::set_var("COOKIE_SECURE", "true") };
    let response_true = ApiResponse::ok(json!({ "logged": true }))
        .with_token("jwt-token-value".to_string())
        .into_response();

    let cookie_true = response_true
        .headers()
        .get(SET_COOKIE)
        .expect("Set-Cookie header should be present")
        .to_str()
        .expect("Set-Cookie header should be valid UTF-8");
    assert!(cookie_true.contains("Secure"), "Secure must be enabled when COOKIE_SECURE=true");

    unsafe { std::env::remove_var("COOKIE_SECURE") };
}
