// Services - Logique métier du drive
// Fonctions utilitaires et helpers

use uuid::Uuid;

// ========== Services ==========

/// Convertir une string en UUID ou None pour les valeurs "null", "root", etc.
pub fn format_string_to_uuid_or_root(s: &str) -> Option<Uuid> {
    let trimmed = s.trim();
    if trimmed.is_empty() || trimmed.eq_ignore_ascii_case("null") || trimmed.eq_ignore_ascii_case("root") {
        None
    } else {
        match Uuid::parse_str(trimmed) {
            Ok(id) if id.is_nil() => None,
            Ok(id) => Some(id),
            Err(_) => None,
        }
    }
}

/// Convertir une string en UUID ou retourner une erreur pour les valeurs invalides
pub fn parse_uuid_or_error(s: &str) -> Result<Option<Uuid>, String> {
    let trimmed = s.trim();
    if trimmed.is_empty() || trimmed.eq_ignore_ascii_case("null") || trimmed.eq_ignore_ascii_case("root") {
        Ok(None)
    } else {
        match Uuid::parse_str(trimmed) {
            Ok(id) if id.is_nil() => Ok(None),
            Ok(id) => Ok(Some(id)),
            Err(_) => Err("Invalid UUID format".to_string()),
        }
    }
}