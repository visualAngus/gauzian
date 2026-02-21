// Déclaration des modules

pub mod metrics;   // Métriques Prometheus
pub mod response;  // Types de réponse HTTP
pub mod routes;    // Composition des routes
pub mod state;     // AppState partagé
pub mod storage;   // Client S3/MinIO

pub mod auth;      // Authentification, gestion des utilisateurs
pub mod drive;     // Gestion des fichiers, dossiers, permissions, upload/download
pub mod agenda;    // Gestion des événements d'agenda

#[cfg(test)]
mod tests;