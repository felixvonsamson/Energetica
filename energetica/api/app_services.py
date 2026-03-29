"""Routers for app services."""
# TODO(mglst): move to energetica/routers/

from fastapi import FastAPI
from fastapi.responses import FileResponse


def register_app_services(app: FastAPI) -> None:
    @app.get("/apple-app-site-association")
    def apple_app_site_association() -> FileResponse:
        """
        Return the apple-app-site-association JSON data.
        Needed for supporting associated domains needed for shared webcredentials.
        """
        return FileResponse("energetica/static/apple-app-site-association", media_type="application/json")
