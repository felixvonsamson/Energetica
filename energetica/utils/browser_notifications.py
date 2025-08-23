"""Utility functions for browser notifications."""

from ecdsa import NIST256p, SigningKey, VerifyingKey


import base64
from pathlib import Path
from typing import cast

from energetica.globals import engine


def load_or_create_vapid_keys() -> None:
    """Load or create VAPID key pair for push notifications."""
    public_key_filepath = "instance/vapid_public_key.txt"
    private_key_filepath = "instance/vapid_private_key.txt"

    if Path(public_key_filepath).exists() and Path(private_key_filepath).exists():
        # Load existing keys
        public_key = Path(public_key_filepath).read_text(encoding="utf-8").strip()
        private_key = Path(private_key_filepath).read_text(encoding="utf-8").strip()

    else:
        # Generate a new ECDSA key pair
        private_key_obj = SigningKey.generate(curve=NIST256p)
        public_key_obj = cast(VerifyingKey, private_key_obj.get_verifying_key())

        # Encode the keys using URL- and filename-safe base64 without padding
        private_key = base64.urlsafe_b64encode(private_key_obj.to_string()).rstrip(b"=").decode("utf-8")
        public_key = base64.urlsafe_b64encode(b"\x04" + public_key_obj.to_string()).rstrip(b"=").decode("utf-8")

        # Write the keys to their respective files
        Path(public_key_filepath).write_text(public_key, encoding="utf-8")
        Path(private_key_filepath).write_text(private_key, encoding="utf-8")

    engine.VAPID_PUBLIC_KEY, engine.VAPID_PRIVATE_KEY = public_key, private_key
