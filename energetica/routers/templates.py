"""Routes for serving Jinja and React pages."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from starlette.datastructures import URL
from starlette.requests import Request
from starlette.templating import Jinja2Templates

from energetica import __release_date__, __version__, engine
from energetica.database.messages import Chat
from energetica.database.player import Player
from energetica.database.resource_on_sale import ResourceOnSale
from energetica.database.user import User
from energetica.utils.auth import get_user

router = APIRouter(prefix="", tags=["Pages"])


def flask_style_url_for(request: Request, name: str, **params: Any) -> URL:
    # Extract and remove _anchor from params (it's not part of route resolution)
    anchor = params.pop("_anchor", None)

    # Handle Flask's 'filename' param (optional compatibility)
    if "filename" in params:
        params["path"] = params.pop("filename")

    # Get the base URL
    path = request.app.url_path_for(name, **params)

    # Append the anchor manually, if present
    if anchor:
        return URL(f"{path}#{anchor}")

    return URL(path)


def app_context(request: Request) -> dict[str, Any]:
    user = get_user(request)
    player = user.player if user else None
    return {
        "engine": engine,
        "user": player,  # Jinja templates expect 'user', which differs from the player/user distinction
        "url_for": lambda name, **params: flask_style_url_for(request, name, **params),
        "app_version": __version__,
        "app_release_date": __release_date__,
    }


templates = Jinja2Templates(directory="energetica/templates", context_processors=[app_context])


@router.get("/")
def default_redirect(
    request: Request,
    user: Annotated[User | None, Depends(get_user)],
) -> RedirectResponse:
    if user:
        return RedirectResponse("/home")
    return RedirectResponse("/landing")


@router.get("/landing", response_class=HTMLResponse, name="landing.landing_page")
def landing(request: Request):  # noqa: ANN201
    return templates.TemplateResponse(request=request, name="landing.jinja")


@router.get("/login", response_class=HTMLResponse, name="auth.login")
def render_login(request: Request):  # noqa: ANN201
    return templates.TemplateResponse(request=request, name="login.jinja")


@router.get("/sign-up", response_class=HTMLResponse, name="auth.sign_up")
def render_signup(request: Request):  # noqa: ANN201
    return templates.TemplateResponse(request=request, name="sign_up.jinja")


@router.get("/logout", response_class=HTMLResponse, name="auth.logout")
def logout(user: Annotated[User | None, Depends(get_user)]):  # noqa: ANN201
    if user is None:
        return RedirectResponse("/login")
    engine.log(f"{user.username} logged out")
    response = RedirectResponse("/login")
    response.delete_cookie("session", path="/")
    return response


@router.get("/location_choice", response_class=HTMLResponse)
def render_location_choice(  # noqa: ANN201
    request: Request,
    user: Annotated[User | None, Depends(get_user)],
):
    if user is None:
        return RedirectResponse("/login")
    if user.role == "admin":
        return RedirectResponse("/admin-dashboard")
    if user.role != "player":
        return RedirectResponse("/home")
    if user.player is not None:
        return RedirectResponse("/home")
    return templates.TemplateResponse(request=request, name="location_choice.jinja")


@router.get("/admin-dashboard", response_class=HTMLResponse, name="views.admin_dashboard")
@router.get("/admin-dashboard/{full_path}", response_class=HTMLResponse, name="views.admin_dashboard")
def render_admin_dashboard(  # noqa: ANN201
    request: Request,
    user: Annotated[User | None, Depends(get_user)],
):
    """Manage returning pages for SPA admin dashboard views."""
    if user is None:
        return RedirectResponse("/login")
    if user.role != "admin":
        return RedirectResponse("/home")
    return FileResponse("energetica/static/react/index.html")


@router.get("/landing-page", response_class=HTMLResponse, name="views.landing-page")
def render_landing_page() -> FileResponse:
    return FileResponse("energetica/static/react/index.html")


@router.get("/home", response_class=HTMLResponse, name="views.home")
def render_dashboard(request: Request, user: Annotated[User | None, Depends(get_user)]):  # noqa: ANN201
    if user is None:
        return RedirectResponse("/login")
    if user.role == "admin":
        return RedirectResponse("/admin-dashboard")
    # user is a player
    if user.player is None:
        # User has not yet settled
        return RedirectResponse("/location_choice")
    return templates.TemplateResponse(request=request, name="dashboard.jinja")


@router.get("/settings", response_class=HTMLResponse, name="views.settings")
def render_settings(request: Request, user: Annotated[User | None, Depends(get_user)]):  # noqa: ANN201
    if user is None:
        return RedirectResponse("/login")
    return templates.TemplateResponse(request=request, name="settings.jinja")


@router.get("/map_view", response_class=HTMLResponse, name="views.map_view")
def render_map(request: Request, user: Annotated[User | None, Depends(get_user)]):  # noqa: ANN201
    if user is None:
        return RedirectResponse("/login")
    return templates.TemplateResponse(request=request, name="map.jinja")


@router.get("/profile", response_class=HTMLResponse, name="views.profile")
def render_profile(  # noqa: ANN201
    request: Request,
    user: Annotated[User | None, Depends(get_user)],
    player_id: int | None = None,
):
    if user is None or user.role != "player" or user.player is None:
        return RedirectResponse("/login")
    if player_id is None:
        profile = user.player
    else:
        profile = Player.get(player_id)
        if profile is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    return templates.TemplateResponse(request=request, name="profile.jinja", context={"profile": profile})


@router.get("/messages", response_class=HTMLResponse, name="views.messages")
def render_chats(  # noqa: ANN201
    request: Request,
    user: Annotated[User | None, Depends(get_user)],
):
    if user is None or user.role != "player" or user.player is None:
        return RedirectResponse("/login")
    chats = list(Chat.filter(lambda chat: user.player in chat.participants))
    return templates.TemplateResponse(request=request, context={"chats": chats}, name="messages.jinja")


@router.get("/network", response_class=HTMLResponse, name="views.network")
def render_network(  # noqa: ANN201
    request: Request,
    user: Annotated[User | None, Depends(get_user)],
):
    if user is None:
        return RedirectResponse("/login")
    if user.role == "admin":
        return RedirectResponse("/admin-dashboard")
    if user.role != "player" or user.player is None:
        return RedirectResponse("/home")
    if not user.player.achievements["network"]:
        return RedirectResponse("/home")
    return templates.TemplateResponse(request=request, name="network.jinja")


@router.get("/power_facilities", response_class=HTMLResponse, name="views.power_facilities")
def render_power_facilities(  # noqa: ANN201
    request: Request,
    user: Annotated[User | None, Depends(get_user)],
):
    if user is None or user.role != "player" or user.player is None:
        return RedirectResponse("/login")
    return templates.TemplateResponse(
        request=request,
        name="assets/power_facilities.jinja",
        context={"constructions": user.player.power_facilities_data},
    )


@router.get("/storage_facilities", response_class=HTMLResponse, name="views.storage_facilities")
def render_storage_facilities(  # noqa: ANN201
    request: Request,
    user: Annotated[User | None, Depends(get_user)],
):
    if user is None or user.role != "player" or user.player is None:
        return RedirectResponse("/login")
    return templates.TemplateResponse(
        request=request,
        name="assets/storage_facilities.jinja",
        context={"constructions": user.player.storage_facilities_data},
    )


@router.get("/technology", response_class=HTMLResponse, name="views.technology")
def render_technology(  # noqa: ANN201
    request: Request,
    user: Annotated[User | None, Depends(get_user)],
):
    if user is None or user.role != "player" or user.player is None:
        return RedirectResponse("/login")
    if not user.player.achievements["laboratory"]:
        return RedirectResponse("/home")
    return templates.TemplateResponse(
        request=request,
        name="assets/technologies.jinja",
        context={"available_technologies": user.player.technologies_data},
    )


@router.get("/functional_facilities", response_class=HTMLResponse, name="views.functional_facilities")
def render_functional_facilities(  # noqa: ANN201
    request: Request,
    user: Annotated[User | None, Depends(get_user)],
):
    if user is None or user.role != "player" or user.player is None:
        return RedirectResponse("/login")
    return templates.TemplateResponse(
        request=request,
        name="assets/functional_facilities.jinja",
        context={"constructions": user.player.functional_facilities_data},
    )


@router.get("/extraction_facilities", response_class=HTMLResponse, name="views.extraction_facilities")
def render_extraction_facilities(  # noqa: ANN201
    request: Request,
    user: Annotated[User | None, Depends(get_user)],
):
    if user is None or user.role != "player" or user.player is None:
        return RedirectResponse("/login")
    return templates.TemplateResponse(
        request=request,
        name="assets/extraction_facilities.jinja",
        context={"constructions": user.player.extraction_facilities_data},
    )


@router.get("/resource_market", response_class=HTMLResponse, name="views.resource_market")
def render_resource_market(  # noqa: ANN201
    request: Request,
    user: Annotated[User | None, Depends(get_user)],
):
    if user is None or user.role != "player" or user.player is None:
        return RedirectResponse("/login")
    if not user.player.achievements["warehouse"]:
        return RedirectResponse("/home")
    return templates.TemplateResponse(
        request=request,
        name="resource_market.jinja",
        context={"on_sale": ResourceOnSale.all()},
    )


@router.get("/scoreboard", response_class=HTMLResponse, name="views.scoreboard")
def render_scoreboard(  # noqa: ANN201
    request: Request,
    user: Annotated[User | None, Depends(get_user)],
):
    if user is None or user.role != "player" or user.player is None:
        return RedirectResponse("/login")
    return templates.TemplateResponse(request=request, name="scoreboard.jinja")


@router.get("/production_overview/revenues", response_class=HTMLResponse, name="overviews.revenues")
def render_revenues(  # noqa: ANN201
    request: Request,
    user: Annotated[User | None, Depends(get_user)],
):
    if user is None or user.role != "player" or user.player is None:
        return RedirectResponse("/login")
    return templates.TemplateResponse(request=request, name="overviews/revenues.jinja")


@router.get("/production_overview/electricity", response_class=HTMLResponse, name="overviews.electricity")
def render_electricity(  # noqa: ANN201
    request: Request,
    user: Annotated[User | None, Depends(get_user)],
):
    if user is None or user.role != "player" or user.player is None:
        return RedirectResponse("/login")
    return templates.TemplateResponse(request=request, name="overviews/electricity.jinja")


@router.get("/production_overview/storage", response_class=HTMLResponse, name="overviews.storage")
def render_storage(  # noqa: ANN201
    request: Request,
    user: Annotated[User | None, Depends(get_user)],
):
    if user is None or user.role != "player" or user.player is None:
        return RedirectResponse("/login")
    return templates.TemplateResponse(request=request, name="overviews/storage.jinja")


@router.get("/production_overview/resources", response_class=HTMLResponse, name="overviews.resources")
def render_resources(  # noqa: ANN201
    request: Request,
    user: Annotated[User | None, Depends(get_user)],
):
    if user is None or user.role != "player" or user.player is None:
        return RedirectResponse("/login")
    return templates.TemplateResponse(request=request, name="overviews/resources.jinja")


@router.get("/production_overview/emissions", response_class=HTMLResponse, name="overviews.emissions")
def render_emissions(  # noqa: ANN201
    request: Request,
    user: Annotated[User | None, Depends(get_user)],
):
    if user is None or user.role != "player" or user.player is None:
        return RedirectResponse("/login")
    if not user.player.discovered_greenhouse_gas_effect():
        return RedirectResponse("/home")
    return templates.TemplateResponse(request=request, name="overviews/emissions.jinja")


@router.get("/wiki/{template_name}", response_class=HTMLResponse, name="wiki.render_template_wiki")
def render_template_wiki(request: Request, template_name: str, _anchor: str | None = None):  # noqa: ANN201
    valid_templates = [
        "introduction",
        "time_and_weather",
        "map",
        "projects",
        "power_facilities",
        "storage_facilities",
        "functional_facilities",
        "technologies",
        "power_management",
        "network",
        "resources",
        "climate_effects",
    ]
    if template_name not in valid_templates:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No such wiki page")
    return templates.TemplateResponse(request=request, name=f"wiki/{template_name}.jinja")


@router.get("/changelog", response_class=HTMLResponse, name="changelog.render_changelog")
def render_changelog(request: Request):  # noqa: ANN201
    return templates.TemplateResponse(request=request, name="changelog.jinja")
