# Login Tests
# Single successful login test

POST https://gauzian.pupin.fr/api/login
Content-Type: application/json
{"email": "ci-a@gauzian.app", "password": "eEgAuUMRr8UAb0wpzpBA"}
HTTP 200
[Captures]
token_a: jsonpath "$.token"
user_a_id: jsonpath "$.user_id"