use axum::{
    body::Body,
    http::{Method, Request, StatusCode},
    middleware,
    routing::get,
    Router,
};
use tower::ServiceExt;
use uuid::Uuid;

use crate::metrics::{
    metrics_text, track_auth_attempt, track_file_upload, track_metrics, HTTP_CONNECTIONS_ACTIVE,
    HTTP_REQUESTS_TOTAL,
};

fn unique_segment(prefix: &str) -> String {
    let suffix = Uuid::new_v4().to_string().replace('-', "");
    format!("{prefix}_{suffix}")
}

#[tokio::test]
async fn test_metrics_middleware_tracks_200_requests_with_normalized_uuid_path() {
    let segment = unique_segment("mxok");
    let app = Router::new()
        .route(&format!("/{segment}/{{id}}"), get(|| async { "ok" }))
        .layer(middleware::from_fn(track_metrics));

    let normalized_path = format!("/{segment}/:{segment}");
    let before = HTTP_REQUESTS_TOTAL
        .with_label_values(&["GET", &normalized_path, "200"])
        .get();

    let response = app
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri(format!("/{segment}/123e4567-e89b-12d3-a456-426614174000"))
                .body(Body::empty())
                .expect("request should be built"),
        )
        .await
        .expect("request should succeed");

    assert_eq!(response.status(), StatusCode::OK);

    let after = HTTP_REQUESTS_TOTAL
        .with_label_values(&["GET", &normalized_path, "200"])
        .get();

    assert_eq!(after, before + 1.0);
}

#[tokio::test]
async fn test_metrics_middleware_tracks_405_status() {
    let segment = unique_segment("mx405");
    let app = Router::new()
        .route(&format!("/{segment}"), get(|| async { "ok" }))
        .layer(middleware::from_fn(track_metrics));

    let before = HTTP_REQUESTS_TOTAL
        .with_label_values(&["POST", &format!("/{segment}"), "405"])
        .get();

    let response = app
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri(format!("/{segment}"))
                .body(Body::empty())
                .expect("request should be built"),
        )
        .await
        .expect("request should succeed");

    assert_eq!(response.status(), StatusCode::METHOD_NOT_ALLOWED);

    let after = HTTP_REQUESTS_TOTAL
        .with_label_values(&["POST", &format!("/{segment}"), "405"])
        .get();

    assert_eq!(after, before + 1.0);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_metrics_middleware_concurrent_requests_leave_zero_active_connections() {
    let segment = unique_segment("mxconc");
    let app = Router::new()
        .route(&format!("/{segment}"), get(|| async {
            tokio::time::sleep(std::time::Duration::from_millis(25)).await;
            "ok"
        }))
        .layer(middleware::from_fn(track_metrics));

    let mut tasks = Vec::new();
    for _ in 0..40 {
        let svc = app.clone();
        let uri = format!("/{segment}");
        tasks.push(tokio::spawn(async move {
            svc.oneshot(
                Request::builder()
                    .method(Method::GET)
                    .uri(uri)
                    .body(Body::empty())
                    .expect("request should be built"),
            )
            .await
            .expect("request should succeed")
            .status()
        }));
    }

    for task in tasks {
        let status = task.await.expect("task should finish");
        assert_eq!(status, StatusCode::OK);
    }

    assert_eq!(HTTP_CONNECTIONS_ACTIVE.get(), 0);
}

#[test]
fn test_metrics_text_contains_domain_metrics_after_tracking() {
    track_auth_attempt("login", true);
    track_file_upload(true, 1024);

    let text = metrics_text();

    assert!(text.contains("auth_attempts_total"));
    assert!(text.contains("file_upload_bytes_total"));
}
