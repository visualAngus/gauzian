// Module auth - Gestion de l'authentification et des utilisateurs

pub mod handlers;
pub mod repo;
pub mod routes;
pub mod services;

// Re-exports pour faciliter l'usage depuis d'autres modules
pub use routes::auth_routes;
pub use services::Claims;
