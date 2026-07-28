import json
import time
from typing import Dict

from fastapi import HTTPException
from pydantic import BaseModel
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, LargeBinary, String, Table, Text
from sqlalchemy.sql import func, select, update
from webauthn import (
    generate_authentication_options,
    generate_registration_options,
    options_to_json,
    verify_authentication_response,
    verify_registration_response,
)
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    PublicKeyCredentialDescriptor,
    ResidentKeyRequirement,
    UserVerificationRequirement,
)

RP_ID = "erp.royalthaitouch.com"
RP_NAME = "Royal Thai Touch ERP"
EXPECTED_ORIGIN = "https://erp.royalthaitouch.com"
CHALLENGES: Dict[str, dict] = {}
CHALLENGE_TTL = 300


class RegistrationVerifyBody(BaseModel):
    username: str
    secret: str
    credential: dict


class AuthenticationVerifyBody(BaseModel):
    username: str
    credential: dict


def install_passkey_routes(app, Base, engine, AppUser, get_db):
    passkeys = Table(
        "passkey_credentials",
        Base.metadata,
        Column("id", Integer, primary_key=True),
        Column("user_id", Integer, ForeignKey("app_users.id", ondelete="CASCADE"), nullable=False),
        Column("credential_id", LargeBinary, unique=True, nullable=False),
        Column("public_key", LargeBinary, nullable=False),
        Column("sign_count", Integer, nullable=False, default=0),
        Column("device_name", String(160), nullable=True),
        Column("backed_up", Boolean, nullable=False, default=False),
        Column("created_at", DateTime, server_default=func.now()),
        Column("last_used_at", DateTime, nullable=True),
    )
    Base.metadata.create_all(bind=engine)

    def save_challenge(key: str, challenge: bytes, kind: str):
        CHALLENGES[key] = {"challenge": challenge, "kind": kind, "expires": time.time() + CHALLENGE_TTL}

    def take_challenge(key: str, kind: str) -> bytes:
        item = CHALLENGES.pop(key, None)
        if not item or item["kind"] != kind or item["expires"] < time.time():
            raise HTTPException(status_code=400, detail="Biometric request expired. Please try again.")
        return item["challenge"]

    @app.post("/passkeys/register/options")
    def passkey_register_options(body: dict, db=next):
        username = str(body.get("username") or "").strip()
        secret = str(body.get("secret") or "")
        from app.main import SessionLocal
        session = SessionLocal()
        try:
            user = session.query(AppUser).filter(AppUser.username == username, AppUser.active == True).first()
            if not user or user.secret != secret:
                raise HTTPException(status_code=401, detail="Invalid account credentials")
            existing = session.execute(select(passkeys.c.credential_id).where(passkeys.c.user_id == user.id)).all()
            options = generate_registration_options(
                rp_id=RP_ID,
                rp_name=RP_NAME,
                user_id=str(user.id).encode("utf-8"),
                user_name=user.username,
                user_display_name=user.username,
                exclude_credentials=[PublicKeyCredentialDescriptor(id=row[0]) for row in existing],
                authenticator_selection=AuthenticatorSelectionCriteria(
                    resident_key=ResidentKeyRequirement.PREFERRED,
                    user_verification=UserVerificationRequirement.REQUIRED,
                ),
            )
            save_challenge(f"reg:{username}", options.challenge, "register")
            return json.loads(options_to_json(options))
        finally:
            session.close()

    @app.post("/passkeys/register/verify")
    def passkey_register_verify(body: RegistrationVerifyBody):
        from app.main import SessionLocal
        session = SessionLocal()
        try:
            user = session.query(AppUser).filter(AppUser.username == body.username, AppUser.active == True).first()
            if not user or user.secret != body.secret:
                raise HTTPException(status_code=401, detail="Invalid account credentials")
            challenge = take_challenge(f"reg:{body.username}", "register")
            verification = verify_registration_response(
                credential=body.credential,
                expected_challenge=challenge,
                expected_rp_id=RP_ID,
                expected_origin=EXPECTED_ORIGIN,
                require_user_verification=True,
            )
            session.execute(passkeys.insert().values(
                user_id=user.id,
                credential_id=verification.credential_id,
                public_key=verification.credential_public_key,
                sign_count=verification.sign_count,
                device_name="Phone biometric / Passkey",
                backed_up=bool(getattr(verification, "credential_backed_up", False)),
            ))
            session.commit()
            return {"status": "registered"}
        except HTTPException:
            raise
        except Exception as exc:
            session.rollback()
            raise HTTPException(status_code=400, detail=f"Could not register biometric login: {exc}")
        finally:
            session.close()

    @app.get("/passkeys/auth/options")
    def passkey_auth_options(username: str):
        from app.main import SessionLocal
        session = SessionLocal()
        try:
            user = session.query(AppUser).filter(AppUser.username == username, AppUser.active == True).first()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            rows = session.execute(select(passkeys.c.credential_id).where(passkeys.c.user_id == user.id)).all()
            if not rows:
                raise HTTPException(status_code=404, detail="Face ID or fingerprint is not enabled for this user")
            options = generate_authentication_options(
                rp_id=RP_ID,
                allow_credentials=[PublicKeyCredentialDescriptor(id=row[0]) for row in rows],
                user_verification=UserVerificationRequirement.REQUIRED,
            )
            save_challenge(f"auth:{username}", options.challenge, "authenticate")
            return json.loads(options_to_json(options))
        finally:
            session.close()

    @app.post("/passkeys/auth/verify")
    def passkey_auth_verify(body: AuthenticationVerifyBody):
        from app.main import SessionLocal
        session = SessionLocal()
        try:
            user = session.query(AppUser).filter(AppUser.username == body.username, AppUser.active == True).first()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            raw_id = body.credential.get("rawId") or body.credential.get("id")
            import base64
            pad = "=" * (-len(raw_id) % 4)
            credential_id = base64.urlsafe_b64decode(raw_id + pad)
            row = session.execute(select(passkeys).where(passkeys.c.credential_id == credential_id, passkeys.c.user_id == user.id)).mappings().first()
            if not row:
                raise HTTPException(status_code=404, detail="Passkey not found")
            challenge = take_challenge(f"auth:{body.username}", "authenticate")
            verification = verify_authentication_response(
                credential=body.credential,
                expected_challenge=challenge,
                expected_rp_id=RP_ID,
                expected_origin=EXPECTED_ORIGIN,
                credential_public_key=row["public_key"],
                credential_current_sign_count=row["sign_count"],
                require_user_verification=True,
            )
            session.execute(update(passkeys).where(passkeys.c.id == row["id"]).values(
                sign_count=verification.new_sign_count,
                last_used_at=func.now(),
            ))
            session.commit()
            return {"status": "authenticated", "user": {
                "id": user.id,
                "username": user.username,
                "role": user.role,
                "permissions": user.permissions or [],
                "allowed_branches": user.allowed_branches or [],
                "active": bool(user.active),
            }}
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Biometric login failed: {exc}")
        finally:
            session.close()
