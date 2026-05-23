"""Routes for serving React SPA pages."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, RedirectResponse

from energetica.globals import engine
from energetica.database.user import User
from energetica.utils.auth import get_user

router = APIRouter(prefix="", tags=["Pages"])


@router.get("/")
def render_root() -> FileResponse:
    """Serve React SPA on the root route."""
    return FileResponse("energetica/static/app/index.html")


@router.get("/logout", name="auth.logout")
def logout(user: Annotated[User | None, Depends(get_user)]) -> RedirectResponse:
    if user is None:
        return RedirectResponse("/app/login")
    engine.log(f"{user.username} logged out")
    response = RedirectResponse("/app/login")
    response.delete_cookie("session", path="/")
    return response


@router.get("/app/{full_path:path}", name="views.react_app")
def render_react_app(full_path: str) -> FileResponse:
    """Serve React SPA for /app/* routes."""
    # Built assets live under /static/app/assets/ — never serve the HTML shell
    # for /app/assets/* or browsers will try to execute HTML as JS/CSS.
    if full_path.startswith("assets/"):
        raise HTTPException(status_code=404)
    return FileResponse("energetica/static/app/index.html")


@router.get("/sign-up", name="views.sign_up_redirect")
def redirect_sign_up() -> RedirectResponse:
    # Permanent redirect for stale links from before sign-up moved under /app.
    return RedirectResponse("/app/sign-up", status_code=301)


@router.get("/landing-page", name="views.landing-page")
def render_landing_page() -> FileResponse:
    return FileResponse("energetica/static/app/index.html")
