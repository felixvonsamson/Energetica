"""Utility functions for browser notifications."""

import base64
from pathlib import Path

from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

from energetica.game_engine import GameEngine


def load_or_create_vapid_keys(engine: GameEngine) -> None:
    """Load or create VAPID key pair for push notifications."""
    public_key_filepath = "instance/vapid_public_key.txt"
    private_key_filepath = "instance/vapid_private_key.txt"

    if Path(public_key_filepath).exists() and Path(private_key_filepath).exists():
        # Load existing keys
        public_key = Path(public_key_filepath).read_text(encoding="utf-8").strip()
        private_key = Path(private_key_filepath).read_text(encoding="utf-8").strip()

    else:
        # Generate a new ECDSA key pair on P-256, the only curve VAPID allows.
        private_key_obj = ec.generate_private_key(ec.SECP256R1())

        # VAPID wants the bare 32-byte private scalar, and the public key as an uncompressed
        # SEC1 point (the 0x04 marker byte followed by X and Y). X962/UncompressedPoint is
        # exactly that encoding, marker byte included.
        raw_private = private_key_obj.private_numbers().private_value.to_bytes(32, "big")
        raw_public = private_key_obj.public_key().public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)

        # Encode the keys using URL- and filename-safe base64 without padding
        private_key = base64.urlsafe_b64encode(raw_private).rstrip(b"=").decode("utf-8")
        public_key = base64.urlsafe_b64encode(raw_public).rstrip(b"=").decode("utf-8")

        # Write the keys to their respective files
        Path(public_key_filepath).write_text(public_key, encoding="utf-8")
        Path(private_key_filepath).write_text(private_key, encoding="utf-8")

    engine.VAPID_PUBLIC_KEY, engine.VAPID_PRIVATE_KEY = public_key, private_key
