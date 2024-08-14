"""In this file, the main routes of the website are managed"""

from flask import Blueprint, current_app, g, redirect, render_template, request
from flask_login import current_user, login_required

from .database.messages import Chat
from .database.player import Player
from .database.player_assets import ResourceOnSale
from .technology_effects import (
    get_current_technology_values,
    package_available_technologies,
    package_extraction_facilities,
    package_functional_facilities,
    package_power_facilities,
    package_storage_facilities,
)

views = Blueprint("views", __name__)
overviews = Blueprint("overviews", __name__, static_folder="static")
wiki = Blueprint("wiki", __name__, static_folder="static")
changelog = Blueprint("changelog", __name__, static_folder="static")


# this function is executed once before every request :
@views.before_request
@overviews.before_request
@login_required
def check_user():
    """This function is called before every request"""
    g.engine = current_app.config["engine"]
    if current_user.tile is not None:
        g.data = get_current_technology_values(current_user)

    def render_template_ctx(page):
        # show location choice if player didn't choose yet
        if current_user.tile is None:
            return render_template("location_choice.jinja", engine=g.engine)
        # render template with or without player production data
        if page == "messages.jinja":
            chats = Chat.query.filter(Chat.participants.any(id=current_user.id)).all()
            return render_template(page, engine=g.engine, user=current_user, chats=chats, data=g.data)
        elif page == "resource_market.jinja":
            on_sale = ResourceOnSale.query.all()
            return render_template(page, engine=g.engine, user=current_user, on_sale=on_sale, data=g.data)
        elif page == "facilities/power_facilities.jinja":
            # TODO: rename constructions to power_facilities
            constructions = package_power_facilities(current_user)
            return render_template(page, engine=g.engine, user=current_user, constructions=constructions)
        elif page == "facilities/storage_facilities.jinja":
            # TODO: rename constructions to storage_facilities
            constructions = package_storage_facilities(current_user)
            return render_template(page, engine=g.engine, user=current_user, constructions=constructions)
        elif page == "facilities/extraction_facilities.jinja":
            # TODO: rename constructions to extraction_facilities
            constructions = package_extraction_facilities(current_user)
            return render_template(page, engine=g.engine, user=current_user, constructions=constructions)
        elif page == "facilities/functional_facilities.jinja":
            # TODO: rename constructions to functional_facilities
            constructions = package_functional_facilities(current_user)
            return render_template(page, engine=g.engine, user=current_user, constructions=constructions)
        elif page == "technologies.jinja":
            available_technologies = package_available_technologies(current_user)
            # TODO: remove `data` from the next line
            return render_template(
                page, engine=g.engine, user=current_user, data=g.data, available_technologies=available_technologies
            )
        else:
            return render_template(page, engine=g.engine, user=current_user, data=g.data)

    g.render_template_ctx = render_template_ctx


@wiki.before_request
@changelog.before_request
def check_user_no_login():
    """This function is called before every request"""
    g.engine = current_app.config["engine"]
    g.data = None
    if current_user.is_authenticated:
        if current_user.tile is not None:
            g.data = get_current_technology_values(current_user)

    def render_template_ctx(page):
        if g.data is not None:
            return render_template(page, engine=g.engine, user=current_user, data=g.data)
        return render_template(page, engine=g.engine, user=None)

    g.render_template_ctx = render_template_ctx


@views.route("/")
@views.route("/home")
def home():
    return g.render_template_ctx("dashboard.jinja")


@views.route("/map_view")
def map_view():
    return g.render_template_ctx("map.jinja")


@views.route("/profile")
def profile():
    """
    This is the endpoint for the profile page.
    When players are on their own profile page, it can see more information about their account
    """
    player_id = request.args.get("player_id")
    if player_id is None:
        player_id = current_user.id
    player = Player.query.get(player_id)
    return render_template(
        "profile.jinja",
        engine=g.engine,
        user=current_user,
        profile=player,
        data=g.data,
    )


@views.route("/messages", methods=["GET", "POST"])
def messages():
    return g.render_template_ctx("messages.jinja")


@views.route("/network")
def network():
    if "network" not in current_user.advancements:
        return redirect("/home", code=302)
    return g.render_template_ctx("network.jinja")


@views.route("/power_facilities")
def power_facilities():
    return g.render_template_ctx("facilities/power_facilities.jinja")


@views.route("/storage_facilities")
def storage_facilities():
    return g.render_template_ctx("facilities/storage_facilities.jinja")


@views.route("/technology")
def technology():
    if "technology" not in current_user.advancements:
        return redirect("/home", code=302)
    return g.render_template_ctx("technologies.jinja")


@views.route("/functional_facilities")
def functional_facilities():
    return g.render_template_ctx("facilities/functional_facilities.jinja")


@views.route("/extraction_facilities")
def extraction_facilities():
    if "warehouse" not in current_user.advancements:
        return redirect("/home", code=302)
    return g.render_template_ctx("facilities/extraction_facilities.jinja")


@views.route("/resource_market")
def resource_market():
    if "warehouse" not in current_user.advancements:
        return redirect("/home", code=302)
    return g.render_template_ctx("resource_market.jinja")


@views.route("/scoreboard")
def scoreboard():
    return g.render_template_ctx("scoreboard.jinja")


@overviews.route("/revenues")
def revenues():
    return g.render_template_ctx("overviews/revenues.jinja")


@overviews.route("/electricity")
def electricity():
    return g.render_template_ctx("overviews/electricity.jinja")


@overviews.route("/storage")
def storage():
    if "storage_overview" not in current_user.advancements:
        return redirect("/home", code=302)
    return g.render_template_ctx("overviews/storage.jinja")


@overviews.route("/resources")
def resources():
    if "warehouse" not in current_user.advancements:
        return redirect("/home", code=302)
    return g.render_template_ctx("overviews/resources.jinja")


@overviews.route("/emissions")
def emissions():
    if "GHG_effect" not in current_user.advancements:
        return redirect("/home", code=302)
    return g.render_template_ctx("overviews/emissions.jinja")


@wiki.route("/<template_name>")
def render_template_wiki(template_name):
    valid_templates = [
        "introduction",
        "game_time",
        "map",
        "power_facilities",
        "storage_facilities",
        "extraction_facilities",
        "functional_facilities",
        "technologies",
        "power_management",
        "network",
        "resources",
        "climate_effects",
    ]

    if template_name in valid_templates:
        return g.render_template_ctx(f"wiki/{template_name}.jinja")
    else:
        return "404 Not Found", 404


@changelog.route("/changelog")
def render_changelog():
    return g.render_template_ctx("changelog.jinja")
