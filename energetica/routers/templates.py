import os
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from starlette.datastructures import URL
from starlette.requests import Request
from starlette.templating import Jinja2Templates

from energetica import engine
from energetica.auth import get_current_user
from energetica.database.messages import Chat
from energetica.database.player import Player

router = APIRouter(prefix="", tags=["Templates"])


def flask_style_url_for(request: Request, name: str, **params: Any) -> URL:
    # Extract and remove _anchor from params (it's not part of route resolution)
    anchor = params.pop("_anchor", None)

    # Handle Flask's 'filename' param (optional compatibility)
    if "filename" in params:
        params["path"] = params.pop("filename")

    # Get the base URL
    url = request.url_for(name, **params)

    # Append the anchor manually, if present
    if anchor:
        url = URL(f"{url}#{anchor}")

    return url


def app_context(request: Request) -> dict[str, Any]:
    # TODO: add user injection on per view case
    try:
        user = get_current_user(request)
    except HTTPException:
        user = None
    return {
        "engine": engine,
        "user": user,
        "url_for": lambda name, **params: flask_style_url_for(request, name, **params),
    }


templates = Jinja2Templates(directory="energetica/templates", context_processors=[app_context])

print("Current working directory:", os.getcwd())


# TODO: add a redirect on / for users not logged in
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
def logout(user: Annotated[Player, Depends(get_current_user)]):  # noqa: ANN201
    # TODO: review this
    engine.log(f"{user.username} logged out")
    # logout_user()
    return RedirectResponse("/login")


@router.get("/location_choice", response_class=HTMLResponse)
def render_location_choice(  # noqa: ANN201
    request: Request,
    user: Annotated[Player, Depends(get_current_user)],
):
    if user.tile is not None:
        return RedirectResponse("/home")  # TODO double check this works correctly
    return templates.TemplateResponse(request=request, name="location_choice.jinja")


@router.get("/home", response_class=HTMLResponse, name="views.home")
def render_dashboard(request: Request):  # noqa: ANN201
    return templates.TemplateResponse(request=request, name="dashboard.jinja")


@router.get("/settings", response_class=HTMLResponse, name="views.settings")
def render_settings(request: Request):  # noqa: ANN201
    return templates.TemplateResponse(request=request, name="settings.jinja")


@router.get("/map_view", response_class=HTMLResponse, name="views.map_view")
def render_map(request: Request):  # noqa: ANN201
    return templates.TemplateResponse(request=request, name="map.jinja")


@router.get("/profile", response_class=HTMLResponse, name="views.profile")
def render_profile(request: Request):  # noqa: ANN201
    # TODO:
    # @views.route("/profile")
    # def profile() -> str:
    #     """
    #     Serve the profile page.

    #     When players are on their own profile page, they can see more information about their account.
    #     """
    #     player_id_str = request.args.get("player_id")
    #     if player_id_str is None:
    #         player_id = current_user.id
    #     else:
    #         player_id = int(player_id_str)
    #     player = Player.get(player_id)
    #     return g.render_template_ctx("profile.jinja", profile=player)
    return templates.TemplateResponse(request=request, name="dashboard.jinja")


@router.get("/messages", response_class=HTMLResponse, name="views.messages")
def render_chats(  # noqa: ANN201
    request: Request,
    user: Annotated[Player, Depends(get_current_user)],
):
    chats = list(Chat.filter(lambda chat: user in chat.participants))
    return templates.TemplateResponse(request=request, context={"chats": chats}, name="messages.jinja")


@router.get("/network", response_class=HTMLResponse, name="views.network")
def render_network(request: Request):  # noqa: ANN201
    # TODO:
    # if not current_user.achievements["network"]:
    #     return redirect("/home", code=302)
    return templates.TemplateResponse(request=request, name="network.jinja")


@router.get("/power_facilities", response_class=HTMLResponse, name="views.power_facilities")
def render_power_facilities(request: Request):  # noqa: ANN201
    return templates.TemplateResponse(request=request, name="assets/power_facilities.jinja")


@router.get("/storage_facilities", response_class=HTMLResponse, name="views.storage_facilities")
def render_storage_facilities(request: Request):  # noqa: ANN201
    return templates.TemplateResponse(request=request, name="assets/storage_facilities.jinja")


@router.get("/technology", response_class=HTMLResponse, name="views.technology")
def render_technology(request: Request):  # noqa: ANN201
    # TODO
    # if not current_user.achievements["laboratory"]:
    #     return redirect("/home", code=302)
    # TODO: missing context: available_technologies=current_user.technologies_data
    return templates.TemplateResponse(request=request, name="assets/technologies.jinja")


@router.get("/functional_facilities", response_class=HTMLResponse, name="views.functional_facilities")
def render_functional_facilities(request: Request):  # noqa: ANN201
    return templates.TemplateResponse(request=request, name="assets/functional_facilities.jinja")


@router.get("/extraction_facilities", response_class=HTMLResponse, name="views.extraction_facilities")
def render_extraction_facilities(request: Request):  # noqa: ANN201
    return templates.TemplateResponse(request=request, name="assets/extraction_facilities.jinja")


@router.get("/resource_market", response_class=HTMLResponse, name="views.resource_market")
def render_resource_market(request: Request):  # noqa: ANN201
    # TODO:
    # if not current_user.achievements["warehouse"]:
    #     return redirect("/home", code=302)
    return templates.TemplateResponse(request=request, name="resource_market.jinja")


@router.get("/scoreboard", response_class=HTMLResponse, name="views.scoreboard")
def render_scoreboard(request: Request):  # noqa: ANN201
    return templates.TemplateResponse(request=request, name="scoreboard.jinja")


@router.get("/revenues", response_class=HTMLResponse, name="overviews.revenues")
def render_revenues(request: Request):  # noqa: ANN201
    return templates.TemplateResponse(request=request, name="overviews/revenues.jinja")


@router.get("/electricity", response_class=HTMLResponse, name="overviews.electricity")
def render_electricity(request: Request):  # noqa: ANN201
    return templates.TemplateResponse(request=request, name="overviews/electricity.jinja")


@router.get("/storage", response_class=HTMLResponse, name="overviews.storage")
def render_storage(request: Request):  # noqa: ANN201
    return templates.TemplateResponse(request=request, name="overviews/storage.jinja")


@router.get("/resources", response_class=HTMLResponse, name="overviews.resources")
def render_resources(request: Request):  # noqa: ANN201
    return templates.TemplateResponse(request=request, name="overviews/resources.jinja")


@router.get("/emissions", response_class=HTMLResponse, name="overviews.emissions")
def render_emissions(request: Request):  # noqa: ANN201
    # TODO:
    # if not current_user.discovered_greenhouse_gas_effect():
    #     return redirect("/home", code=302)
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
        raise HTTPException(status_code=404, detail="No such wiki page")
    return templates.TemplateResponse(request=request, name=f"wiki/{template_name}.jinja")


@router.get("/changelog", response_class=HTMLResponse, name="changelog.render_changelog")
def render_changelog(request: Request):  # noqa: ANN201
    return templates.TemplateResponse(request=request, name="changelog.jinja")
