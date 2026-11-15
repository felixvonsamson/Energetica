"""The instance backend's entry point: build the app for whichever kind of Run this instance is (#994).

``main.py`` calls :func:`create_instance_app`. It reads the Run mode from ``instance.json`` and builds
either the persistent world's app or Workshop's. Each app is imported only when chosen, because
importing ``energetica.freeplay`` builds the persistent world's game engine, which a Workshop Run
must not have.

An instance with no ``instance.json`` (local development) runs the persistent world. A file that
exists but cannot be read stops the backend from starting, rather than guessing the mode.
"""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI

from energetica.identity.instance_config import WorkshopRun, load_instance_config


def create_instance_app(**kwargs: Any) -> FastAPI:
    """Build this instance's app. ``kwargs`` are ``main.py``'s command-line options.

    The persistent world takes them all. Workshop takes only ``rm_instance``; the rest configure
    the persistent world's engine and tick loop, which Workshop does not have.
    """
    config = load_instance_config()
    if config is not None and isinstance(config.run, WorkshopRun):
        from energetica.workshop.app import create_workshop_app

        return create_workshop_app(config, rm_instance=kwargs.get("rm_instance", False))

    from energetica.freeplay.app import create_app

    return create_app(**kwargs)
