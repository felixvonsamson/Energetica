"""Routes for serving React SPA pages."""

from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse, RedirectResponse

from energetica.globals import engine
from energetica.database.user import User
from energetica.utils.auth import get_user

router = APIRouter(prefix="", tags=["Pages"])


@router.get("/")
def render_root() -> FileResponse:
    """Serve React SPA on the root route."""
    return FileResponse("energetica/static/react/index.html")


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
    return FileResponse("energetica/static/react/index.html")


@router.get("/admin-dashboard", name="views.admin_dashboard", response_model=None)
@router.get("/admin-dashboard/{full_path:path}", response_model=None)
def render_admin_dashboard(
    user: Annotated[User | None, Depends(get_user)],
) -> FileResponse | RedirectResponse:
    """Serve React SPA for admin dashboard routes."""
    if user is None:
        return RedirectResponse("/app/login")
    if user.role != "admin":
        return RedirectResponse("/")
    return FileResponse("energetica/static/react/index.html")


@router.get("/landing-page", name="views.landing-page")
def render_landing_page() -> FileResponse:
    return FileResponse("energetica/static/react/index.html")
