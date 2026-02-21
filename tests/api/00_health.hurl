# Health Check Test
# Tests that the API is running and ready to accept requests

GET {{base_url}}/health/ready
HTTP 200
[Asserts]
body == "OK"
status == 200
