"""routes for browser notifications."""

from typing import Annotated

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel

from energetica.database.player import Player
from energetica.globals import engine
from energetica.schemas.browser_notifications import Subscription, VapidPublicKey
from energetica.schemas.notifications import PushNotificationTestPayload
from energetica.utils.auth import get_settled_player


class TestPushBody(BaseModel):
    endpoint: str | None = None


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


@router.post(":test", status_code=status.HTTP_204_NO_CONTENT)
def test_push_notification(
    player: Annotated[Player, Depends(get_settled_player)],
    body: TestPushBody = TestPushBody(),
) -> None:
    """Send a test push notification. If endpoint is provided, sends only to that subscription; otherwise broadcasts to all."""
    payload = PushNotificationTestPayload()
    if body.endpoint is not None:
        subscriptions = [s for s in player.push_subscriptions if s.endpoint == body.endpoint]
        for subscription in subscriptions:
            player.notify_subscription(subscription, payload)
    else:
        player.push_only(payload)
