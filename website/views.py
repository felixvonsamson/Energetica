"""
In this file, the main routes of the website are managed
"""

from flask import Blueprint, render_template, request, flash, jsonify, session
from flask import g, current_app
from flask_login import login_required, current_user
import pickle
import datetime

views = Blueprint("views", __name__)

# this function is executed once before every request :
@views.before_request
@login_required
def check_user():
    g.engine = current_app.config["engine"]
    g.config = g.engine.config[current_user.id]

    def render_template_ctx(page):
        # render template with or without player production data
        if page == "production_overview.jinja":
            with open(
                "instance/player_prod/" + current_user.production_table_name, "rb"
            ) as file:
                prod_table = pickle.load(file)
            return render_template(
                page,
                engine=g.engine,
                user=current_user,
                data=g.config["assets"],
                prod_table=prod_table,
                t=datetime.datetime.today().time(),
            )
        else:
            return render_template(
                page, engine=g.engine, user=current_user, data=g.config["assets"]
            )

    g.render_template_ctx = render_template_ctx
    if len(current_user.tile) == 0:
        return g.render_template_ctx("location_choice.jinja")

@views.route("/", methods=["GET", "POST"])
@views.route("/home", methods=["GET", "POST"])
def home():
    return g.render_template_ctx("home.jinja")

@views.route("/power_buildings")
def energy_buildings():
    return g.render_template_ctx("power_buildings.jinja")

@views.route("/storage_buildings")
def storage_buildings():
    return g.render_template_ctx("storage_buildings.jinja")

@views.route("/technology")
def technology():
    return g.render_template_ctx("technologies.jinja")

@views.route("/functional_buildings")
def functional_buildings():
    return g.render_template_ctx("functional_buildings.jinja")

@views.route("/extraction_plants")
def extraction_plants():
    return g.render_template_ctx("extraction_plants.jinja")

@views.route("/production_overview")
def production_overview():
    return g.render_template_ctx("production_overview.jinja")

@views.route("/network")
def network():
    return g.render_template_ctx("network.jinja")