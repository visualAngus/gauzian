# Login Tests
# Single successful login test

POST {{base_url}}/login
Content-Type: application/json
{"email": "{{test_email_a}}", "password": "{{test_password}}"}
HTTP 200
[Captures]
token_a: jsonpath "$.token"
user_a_id: jsonpath "$.user_id"