"""routes for browser notifications."""

from fastapi import APIRouter, Depends, status

from energetica.database.player import Player
from energetica.globals import engine
from energetica.schemas.browser_notifications import Subscription, VapidPublicKey
from energetica.utils.auth import get_settled_player

router = APIRouter(prefix="/push-subscriptions", tags=["Browser Notifications"])


@router.get("/vapid-public-key")
def get_vapid_key() -> VapidPublicKey:
    """Return VAPID public key."""
    return VapidPublicKey(public_key=engine.VAPID_PUBLIC_KEY)


@router.post(":subscribe", status_code=status.HTTP_204_NO_CONTENT)
def subscribe(
    subscription: Subscription,
    current_user: Player = Depends(get_settled_player),
) -> None:
    """Create a new subscription."""
    current_user.push_subscriptions.append(subscription)


@router.post(":unsubscribe", status_code=status.HTTP_204_NO_CONTENT)
def unsubscribe(
    subscription: Subscription,
    current_user: Player = Depends(get_settled_player),
) -> None:
    """Remove a subscription."""
    try:
        current_user.push_subscriptions.remove(subscription)
    except ValueError:
        pass
