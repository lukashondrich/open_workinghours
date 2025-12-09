#!/bin/bash

TOKEN='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjOTA0OTQ1Yy1lNTJmLTQyNWEtYjVlMy1mZWM2MDA2MDc5MDEiLCJleHAiOjE3Njc4ODA3OTgsInR5cGUiOiJhY2Nlc3MifQ.4XQX3JDeR8vsEJVYe2AA1kk7jJlbX3lggtw8eKp7E7E'

echo "=== Testing Work Events Endpoints ==="
echo

echo "1. POST /work-events (Create work event)"
EVENT_RESPONSE=$(curl -s -X POST http://localhost:8000/work-events \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{"date":"2025-12-08","planned_hours":8.0,"actual_hours":9.5,"source":"geofence"}')
echo "$EVENT_RESPONSE" | jq .
EVENT_ID=$(echo "$EVENT_RESPONSE" | jq -r '.event_id')
echo "Created event ID: $EVENT_ID"
echo

echo "2. GET /work-events (List all work events)"
curl -s -X GET http://localhost:8000/work-events \
  -H "Authorization: Bearer ${TOKEN}" | jq .
echo

echo "3. PATCH /work-events/{event_id} (Update work event)"
curl -s -X PATCH "http://localhost:8000/work-events/${EVENT_ID}" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{"actual_hours":10.0,"source":"mixed"}' | jq .
echo

echo "4. GET /work-events with filters"
curl -s -X GET "http://localhost:8000/work-events?start_date=2025-12-01&end_date=2025-12-31" \
  -H "Authorization: Bearer ${TOKEN}" | jq .
echo

echo "5. DELETE /work-events/{event_id}"
curl -s -X DELETE "http://localhost:8000/work-events/${EVENT_ID}" \
  -H "Authorization: Bearer ${TOKEN}" -w "\nHTTP Status: %{http_code}\n"
echo

echo "6. Verify deletion (should return empty list)"
curl -s -X GET http://localhost:8000/work-events \
  -H "Authorization: Bearer ${TOKEN}" | jq .
