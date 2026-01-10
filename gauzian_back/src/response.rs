use axum::{
    http::{header::SET_COOKIE, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use axum_extra::extract::cookie::{Cookie, SameSite};
use serde::Serialize;

#[derive(Serialize)]
pub struct ErrorResponse {
    pub error: String,
}

pub struct ApiResponse<T> {
    data: T,
    token: Option<String>,
    status: StatusCode,
}

impl<T: Serialize> ApiResponse<T> {
    pub fn ok(data: T) -> Self {
        Self { 
            data, 
            token: None,
            status: StatusCode::OK,
        }
    }

    pub fn with_token(mut self, token: String) -> Self {
        self.token = Some(token);
        self
    }
}

impl ApiResponse<ErrorResponse> {
    pub fn conflict(message: impl Into<String>) -> Self {
        Self {
            data: ErrorResponse { error: message.into() },
            token: None,
            status: StatusCode::CONFLICT,
        }
    }

    pub fn not_found(message: impl Into<String>) -> Self {
        Self {
            data: ErrorResponse { error: message.into() },
            token: None,
            status: StatusCode::NOT_FOUND,
        }
    }

    pub fn internal_error(message: impl Into<String>) -> Self {
        Self {
            data: ErrorResponse { error: message.into() },
            token: None,
            status: StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    pub fn unauthorized(message: impl Into<String>) -> Self {
        Self {
            data: ErrorResponse { error: message.into() },
            token: None,
            status: StatusCode::UNAUTHORIZED,
        }
    }
    pub fn bad_request(message: impl Into<String>) -> Self {
        Self {
            data: ErrorResponse { error: message.into() },
            token: None,
            status: StatusCode::BAD_REQUEST,
        }
    }
}

impl<T: Serialize> IntoResponse for ApiResponse<T> {
    fn into_response(self) -> Response {
        let mut response = (self.status, Json(self.data)).into_response();

        if let Some(token) = self.token {
            let cookie = Cookie::build(("auth_token", token))
                .path("/")
                .http_only(true)
                .secure(false) // ⚠️ METTRE true EN PROD (HTTPS)
                .same_site(SameSite::Lax)
                .max_age(cookie::time::Duration::days(10))
                .build();

            response
                .headers_mut()
                .insert(SET_COOKIE, cookie.to_string().parse().unwrap());
        }

        response
    }
}
