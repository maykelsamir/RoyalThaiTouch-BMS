from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings

password_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return password_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return password_context.verify(password, password_hash)


def _create_token(*, subject: str, token_type: str, token_version: int, expires_delta: timedelta) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,
        "type": token_type,
        "ver": token_version,
        "iat": now,
        "exp": now + expires_delta,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def create_access_token(subject: str, token_version: int) -> str:
    settings = get_settings()
    return _create_token(
        subject=subject,
        token_type="access",
        token_version=token_version,
        expires_delta=timedelta(minutes=settings.access_token_minutes),
    )


def create_refresh_token(subject: str, token_version: int) -> str:
    settings = get_settings()
    return _create_token(
        subject=subject,
        token_type="refresh",
        token_version=token_version,
        expires_delta=timedelta(days=settings.refresh_token_days),
    )


def decode_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
    except JWTError as exc:
        raise ValueError("Invalid or expired token") from exc
