"""Root-level dynamic routes kept on FastAPI after the Apache static cutover.

All SPA/page serving (`/`, `/app/*`, `/landing-page`) and the `/static` mount
moved to Apache in RFC Phase 5 (see
docs/architecture/static-serving-and-deployment.md). Only `/logout` remains here:
it mutates server state (clears the session cookie) and so must stay on uvicorn.
"""

from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import RedirectResponse

from energetica.globals import engine
from energetica.database.user import User
from energetica.utils.auth import get_user

router = APIRouter(prefix="", tags=["Pages"])


@router.get("/logout", name="auth.logout")
def logout(user: Annotated[User | None, Depends(get_user)]) -> RedirectResponse:
    if user is None:
        return RedirectResponse("/app/login")
    engine.log(f"{user.username} logged out")
    response = RedirectResponse("/app/login")
    response.delete_cookie("session", path="/")
    return response
