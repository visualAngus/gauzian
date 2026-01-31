use lazy_static::lazy_static;
use prometheus::{
    CounterVec, Encoder, HistogramVec, IntGauge, TextEncoder,
    core::{AtomicU64, GenericCounterVec},
    opts, register_counter_vec, register_histogram_vec, register_int_gauge,
};
use std::time::Instant;

lazy_static! {
    pub static ref REQUEST_COUNTER: CounterVec = register_counter_vec!(
        opts!("requests_total", "Total number of requests received"),
        &["endpoint", "method", "status"]
    )
    .unwrap();
    pub static ref RESPONSE_TIME_HISTOGRAM: HistogramVec = register_histogram_vec!(
        "response_time_seconds",
        "Response time in seconds",
        &["endpoint", "method"]
    )
    .unwrap();
    pub static ref ACTIVE_CONNECTIONS: IntGauge =
        register_int_gauge!("active_connections", "Number of active connections").unwrap();
}

pub fn metrics_text() -> String {
    // Force l'initialisation des métriques en les incrémentant
    ACTIVE_CONNECTIONS.set(1);
    REQUEST_COUNTER
        .with_label_values(&["test", "GET", "200"])
        .inc();

    let encoder = TextEncoder::new();
    let metric_families = prometheus::gather();
    let mut buffer = Vec::new();
    encoder.encode(&metric_families, &mut buffer).unwrap();
    String::from_utf8(buffer).unwrap()
}
