// Tests unitaires pour drive/services.rs
// Teste: format_string_to_uuid_or_root, parse_uuid_or_error

use uuid::Uuid;

use crate::drive::services;

// ========== Tests UUID parsing ==========

// ========== Tests format_string_to_uuid_or_root ==========

#[test]
fn test_format_string_to_uuid_or_root_empty_string() {
    let result = services::format_string_to_uuid_or_root("");
    assert!(result.is_none());
}

#[test]
fn test_format_string_to_uuid_or_root_null() {
    let result = services::format_string_to_uuid_or_root("null");
    assert!(result.is_none());
}

#[test]
fn test_format_string_to_uuid_or_root_null_case_insensitive() {
    assert!(services::format_string_to_uuid_or_root("NULL").is_none());
    assert!(services::format_string_to_uuid_or_root("Null").is_none());
    assert!(services::format_string_to_uuid_or_root("nUlL").is_none());
}

#[test]
fn test_format_string_to_uuid_or_root_root() {
    let result = services::format_string_to_uuid_or_root("root");
    assert!(result.is_none());
}

#[test]
fn test_format_string_to_uuid_or_root_root_case_insensitive() {
    assert!(services::format_string_to_uuid_or_root("ROOT").is_none());
    assert!(services::format_string_to_uuid_or_root("Root").is_none());
}

#[test]
fn test_format_string_to_uuid_or_root_whitespace_only() {
    let result = services::format_string_to_uuid_or_root("   ");
    assert!(result.is_none());
}

#[test]
fn test_format_string_to_uuid_or_root_valid_uuid() {
    let expected = Uuid::new_v4();
    let result = services::format_string_to_uuid_or_root(&expected.to_string());

    assert_eq!(result, Some(expected));
}

#[test]
fn test_format_string_to_uuid_or_root_with_whitespace() {
    let expected = Uuid::new_v4();
    let result = services::format_string_to_uuid_or_root(&format!("   {}   ", expected));

    assert_eq!(result, Some(expected));
}

#[test]
fn test_format_string_to_uuid_or_root_invalid_format() {
    assert!(services::format_string_to_uuid_or_root("not-a-uuid").is_none());
    assert!(services::format_string_to_uuid_or_root("12345").is_none());
    assert!(services::format_string_to_uuid_or_root("gggggggg-gggg-gggg-gggg-gggggggggggg").is_none());
}

// ========== Tests parse_uuid_or_error ==========

#[test]
fn test_parse_uuid_or_error_empty_string() {
    let result = services::parse_uuid_or_error("");
    assert_eq!(result, Ok(None));
}

#[test]
fn test_parse_uuid_or_error_null() {
    let result = services::parse_uuid_or_error("null");
    assert_eq!(result, Ok(None));
}

#[test]
fn test_parse_uuid_or_error_root() {
    let result = services::parse_uuid_or_error("root");
    assert_eq!(result, Ok(None));
}

#[test]
fn test_parse_uuid_or_error_valid_uuid() {
    let expected = Uuid::new_v4();
    let result = services::parse_uuid_or_error(&expected.to_string());

    assert_eq!(result, Ok(Some(expected)));
}

#[test]
fn test_parse_uuid_or_error_invalid_format() {
    let result = services::parse_uuid_or_error("not-a-uuid");

    assert!(result.is_err());
    let error_msg = result.err().unwrap();
    assert_eq!(error_msg, "Invalid UUID format");
}

#[test]
fn test_parse_uuid_or_error_nil_uuid_returns_none() {
    let nil_uuid = Uuid::nil().to_string();
    let result = services::parse_uuid_or_error(&nil_uuid);

    assert_eq!(result, Ok(None));
}

#[test]
fn test_parse_uuid_or_error_whitespace_handling() {
    let expected = Uuid::new_v4();
    let result = services::parse_uuid_or_error(&format!("   {}   ", expected));

    assert_eq!(result, Ok(Some(expected)));
}

// ========== Tests edge cases ==========

#[test]
fn test_nil_uuid_format_string_to_uuid_or_root() {
    let nil_uuid = Uuid::nil().to_string();
    let result = services::format_string_to_uuid_or_root(&nil_uuid);

    assert!(result.is_none(), "Nil UUID should be treated as invalid");
}

#[test]
fn test_nil_uuid_parse_uuid_or_error() {
    let nil_uuid = Uuid::nil().to_string();
    let result = services::parse_uuid_or_error(&nil_uuid);

    assert_eq!(result, Ok(None), "Nil UUID should return Ok(None)");
}
