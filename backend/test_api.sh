#!/bin/bash

TOKEN='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjOTA0OTQ1Yy1lNTJmLTQyNWEtYjVlMy1mZWM2MDA2MDc5MDEiLCJleHAiOjE3Njc4ODA3OTgsInR5cGUiOiJhY2Nlc3MifQ.4XQX3JDeR8vsEJVYe2AA1kk7jJlbX3lggtw8eKp7E7E'

echo "Testing authentication with token..."
echo "Token: ${TOKEN:0:50}..."

curl -s -X GET http://localhost:8000/auth/me \
  -H "Authorization: Bearer ${TOKEN}" | jq .
