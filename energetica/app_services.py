import base64
from pathlib import Path
from typing import Dict, cast

from ecdsa import NIST256p, SigningKey, VerifyingKey
from fastapi import Depends, FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from energetica.auth import get_current_user
from energetica.database.player import Player
from energetica.globals import engine


def get_or_create_vapid_keys() -> tuple[str, str]:
    """Load or create VAPID key pair for push notifications."""
    public_key_filepath = "instance/vapid_public_key.txt"
    private_key_filepath = "instance/vapid_private_key.txt"
    if Path(public_key_filepath).exists() and Path(private_key_filepath).exists():
        public_key = Path(public_key_filepath).read_text(encoding="utf-8").strip()
        private_key = Path(private_key_filepath).read_text(encoding="utf-8").strip()
        return public_key, private_key
    # Generate a new ECDSA key pair
    private_key_obj = SigningKey.generate(curve=NIST256p)
    public_key_obj = cast(VerifyingKey, private_key_obj.get_verifying_key())

    # Encode the keys using URL- and filename-safe base64 without padding
    private_key = base64.urlsafe_b64encode(private_key_obj.to_string()).rstrip(b"=").decode("utf-8")
    public_key = base64.urlsafe_b64encode(b"\x04" + public_key_obj.to_string()).rstrip(b"=").decode("utf-8")

    # Write the keys to their respective files
    Path(public_key_filepath).write_text(public_key, encoding="utf-8")
    Path(private_key_filepath).write_text(private_key, encoding="utf-8")

    return public_key, private_key


engine.VAPID_PUBLIC_KEY, engine.VAPID_PRIVATE_KEY = get_or_create_vapid_keys()

# TODO: move schemas, relocate endpoints for REST compliance / standard location compliance


# Define a Pydantic model for validation
class Subscription(BaseModel):
    endpoint: str
    keys: Dict[str, str] = {}


def register_app_services(app: FastAPI) -> None:
    @app.get("/subscribe")
    async def get_vapid_key(request: Request) -> JSONResponse:
        """Return VAPID public key."""
        return JSONResponse(content={"public_key": VAPID_PUBLIC_KEY})

    @app.post("/subscribe")
    async def subscribe(
        subscription: Subscription,
        current_user: Player = Depends(get_current_user),
    ) -> JSONResponse:
        """Create a new subscription."""
        current_user.notification_subscriptions.append(subscription.model_dump())
        return JSONResponse(content={"response": "Subscription successful"})

    @app.post("/unsubscribe")
    async def unsubscribe(
        subscription: Subscription,
        current_user: Player = Depends(get_current_user),
    ) -> JSONResponse:
        """Remove a subscription."""
        try:
            current_user.notification_subscriptions.remove(subscription.model_dump())
        except ValueError:
            pass
        return JSONResponse(content={"response": "Unsubscription successful"})

    @app.get("/apple-app-site-association")
    async def apple_app_site_association() -> FileResponse:
        """
        Return the apple-app-site-association JSON data.
        Needed for supporting associated domains needed for shared webcredentials.
        """
        return FileResponse("energetica/static/apple-app-site-association", media_type="application/json")
