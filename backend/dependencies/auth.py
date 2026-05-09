import logging
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
import jwt
from jwt import PyJWKClient
import os

logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=False)

_jwks_client: PyJWKClient | None = None

def _get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        supabase_url = os.getenv('SUPABASE_URL')
        if not supabase_url:
            raise RuntimeError("SUPABASE_URL environment variable is not set")
        _jwks_client = PyJWKClient(f"{supabase_url}/auth/v1/.well-known/jwks.json")
    return _jwks_client

def _verify_jwt(token: str):
    try:
        signing_key = _get_jwks_client().get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            audience="authenticated"
        )
        return payload
    except jwt.InvalidTokenError as e:
        logger.warning(f"JWT validation failed: {e}")
        raise HTTPException(status_code=401, detail="Unauthorized")
    except Exception as e:
        logger.error(f"JWKS/verification error: {e}")
        raise HTTPException(status_code=401, detail="Unauthorized")

async def verify_token(
    credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer())
):
    payload = _verify_jwt(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return payload


async def verify_token_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
):
    if not credentials:
        return None
    result = _verify_jwt(credentials.credentials)
    if result is None:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return result
