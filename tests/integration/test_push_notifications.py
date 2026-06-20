"""Regression tests for issue #763: web push delivery must not block the caller.

`notify_subscription` used to call the blocking `webpush()` round-trip inline, so sending a chat
message (or any notification) held the request/tick until every push to every subscriber completed
serially — multiple seconds in busy chats, unbounded if a push service hung. Delivery is now
dispatched to a background thread pool with a per-request timeout.
"""

import threading
import time

import pytest

from energetica import create_app
from energetica.database import player as player_module
from energetica.database.map.hex_tile import HexTile
from energetica.database.player import Player
from energetica.database.user import User
from energetica.schemas.browser_notifications import Subscription, SubscriptionKeys
from energetica.schemas.notifications import ChatMessagePayload
from energetica.utils.auth import generate_password_hash
from energetica.utils.map_helpers import confirm_location


def _make_player() -> Player:
    create_app(rm_instance=True, skip_adding_handlers=True, env="dev")
    user = User(username="username", pwhash=generate_password_hash("password"), role="player", account_id=1)
    return confirm_location(user, HexTile.getitem(1))


def _subscription() -> Subscription:
    return Subscription(
        endpoint="https://push.example.com/sub/abc",
        keys=SubscriptionKeys(p256dh="p256dh-key", auth="auth-key"),
    )


def test_notify_subscription_does_not_block_caller(monkeypatch: pytest.MonkeyPatch) -> None:
    """The caller returns immediately even when the underlying webpush round-trip is slow."""
    player = _make_player()
    player.push_subscriptions.append(_subscription())

    started = threading.Event()
    finished = threading.Event()
    captured: dict[str, object] = {}

    def slow_webpush(**kwargs: object) -> None:
        started.set()
        captured.update(kwargs)
        time.sleep(2)
        finished.set()

    monkeypatch.setattr(player_module, "webpush", slow_webpush)

    t0 = time.perf_counter()
    player.push_only(ChatMessagePayload(sender_username="alice", message="hi", chat_id=1))
    elapsed = time.perf_counter() - t0

    # The call returns essentially immediately, long before the 2s webpush completes.
    assert elapsed < 0.5, f"push_only blocked the caller for {elapsed:.2f}s"
    # The delivery really was dispatched (runs in the background pool)...
    assert started.wait(timeout=1), "webpush was never dispatched to the background pool"
    assert not finished.is_set(), "webpush finished synchronously — it was not backgrounded"
    # ...and eventually completes with a bounded timeout applied (issue #763 fix #2).
    assert finished.wait(timeout=3), "background webpush never completed"
    assert captured["timeout"] == player_module._PUSH_TIMEOUT_SECONDS


def test_expired_subscription_is_removed(monkeypatch: pytest.MonkeyPatch) -> None:
    """A 410 Gone from the push service prunes the dead subscription (preserved behaviour)."""
    from pywebpush import WebPushException

    player = _make_player()

    # Signal exactly when the background worker calls remove(), so the assertion is deterministic
    # rather than polling: waiting on the webpush call itself would race the subsequent removal.
    removed = threading.Event()

    class _SignalingList(list):  # type: ignore[type-arg]
        def remove(self, value: object) -> None:
            super().remove(value)
            removed.set()

    player.push_subscriptions = _SignalingList([_subscription()])

    class _Resp:
        status_code = 410

    def gone_webpush(**_kwargs: object) -> None:
        raise WebPushException("gone", response=_Resp())

    monkeypatch.setattr(player_module, "webpush", gone_webpush)

    player.push_only(ChatMessagePayload(sender_username="alice", message="hi", chat_id=1))

    assert removed.wait(timeout=3), "expired (410) subscription was not pruned"
    assert player.push_subscriptions == []
