#!/usr/bin/env python
"""Debug JWT verification using the same code as the backend"""
import sys
sys.path.insert(0, '/Users/user01/open_workinghours/backend')

from app.security import verify_user_access_token, create_user_access_token
from app.config import get_settings

# Get settings
settings = get_settings()
print(f"Secret key loaded: {settings.security.secret_key[:20]}...")

# Create a test token
user_id = "test-user-123"
token, expires_at = create_user_access_token(user_id=user_id)
print(f"\nCreated token: {token[:50]}...")
print(f"Expires at: {expires_at}")

# Verify the token
verified_user_id = verify_user_access_token(token)
print(f"\nVerified user_id: {verified_user_id}")

if verified_user_id == user_id:
    print("✅ Token verification SUCCESSFUL!")
else:
    print(f"❌ Token verification FAILED! Expected {user_id}, got {verified_user_id}")

# Now test with the actual token from the API
actual_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjOTA0OTQ1Yy1lNTJmLTQyNWEtYjVlMy1mZWM2MDA2MDc5MDEiLCJleHAiOjE3Njc4ODA3OTgsInR5cGUiOiJhY2Nlc3MifQ.4XQX3JDeR8vsEJVYe2AA1kk7jJlbX3lggtw8eKp7E7E"
print(f"\n\nTesting actual API token:")
print(f"Token: {actual_token[:50]}...")
verified_user_id_actual = verify_user_access_token(actual_token)
print(f"Verified user_id: {verified_user_id_actual}")

if verified_user_id_actual:
    print("✅ Actual token verification SUCCESSFUL!")
else:
    print("❌ Actual token verification FAILED!")
