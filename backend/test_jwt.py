#!/usr/bin/env python
"""Debug JWT token verification"""
import os
from jose import jwt, JWTError

# Read secret key from environment
SECRET_KEY = "8aTSffhH_x877rpZVnCbc7opzSFrjmkAvbD8H3R9H53szoaPDXHRVPzJZZ8fGcU_"
TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiMTcwMWQ4Zi1jZDk5LTQ1MWItOTJjZC1iYjdmZDVhZjNkMmUiLCJleHAiOjE3Njc4ODA0NDcsInR5cGUiOiJhY2Nlc3MifQ.GLASD56Q--dCw1J_U1aAlrF3vSoKgxgnSrqVwIyt4NM"

print("Testing JWT verification...")
print(f"Secret key: {SECRET_KEY[:20]}...")
print(f"Token: {TOKEN[:50]}...")

try:
    payload = jwt.decode(TOKEN, SECRET_KEY, algorithms=["HS256"])
    print("\n✅ JWT verification successful!")
    print(f"Payload: {payload}")
except JWTError as e:
    print(f"\n❌ JWT verification failed: {e}")
    print("Trying without verification...")
    payload_unverified = jwt.decode(TOKEN, options={"verify_signature": False})
    print(f"Unverified payload: {payload_unverified}")
