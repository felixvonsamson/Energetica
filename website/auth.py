"""
This file contains the functions for authentification and sign-up of users
"""

from flask import Blueprint, render_template, request, flash, redirect, url_for
from flask import session, current_app
from .database import Player
from werkzeug.security import generate_password_hash, check_password_hash
from . import db
from flask_login import login_user, login_required, logout_user, current_user
import pickle

auth = Blueprint("auth", __name__)

# logic for the login :
@auth.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username")
        password = request.form.get("password")

        player = Player.query.filter_by(username=username).first()
        if player:
            if check_password_hash(player.password, password):
                flash("Logged in successfully!", category="success")
                login_user(player, remember=True)
                session["ID"] = player.id
                return redirect(url_for("views.home"))
            else:
                flash("Incorrect password, try again.", category="error")
        else:
            flash("Username does not exist.", category="error")

    return render_template("login.jinja", user=current_user)

# logic for the logout :
@auth.route("/logout")
@login_required
def logout():
    logout_user()
    return redirect(url_for("auth.login"))

# logic for the sign-up :
@auth.route("/sign-up", methods=["GET", "POST"])
def sign_up():
    if request.method == "POST":
        username = request.form.get("username")
        password1 = request.form.get("password1")
        password2 = request.form.get("password2")

        player = Player.query.filter_by(username=username).first()
        if player:
            flash("Username already exist", category="error")
        elif len(username) < 4:
            flash("Username must be greater than 3 characters.",
                  category="error")
        elif password1 != password2:
            flash("Passwords don't match.", category="error")
        elif len(password1) < 7:
            flash("Password must be at least 7 characters.", category="error")
        else:
            new_player = Player(
                username=username,
                password=generate_password_hash(password1, method="sha256"),
                data_table_name=f"data_{username}.pck",
            )
            add_player_to_data(username)
            init_table(username)
            db.session.add(new_player)
            db.session.commit()
            login_user(new_player, remember=True)
            session["ID"] = new_player.id
            flash("Account created!", category="success")
            return redirect(url_for("views.home"))

    return render_template("sign_up.jinja", user=current_user)

# initialize data table for new user and stores it as a .pck in the 'player_prod' repo
def init_table(username):
    past_data = {
        "generation": {
            "fossil": [0] * 2880,
            "wind": [0] * 2880,
            "hydro": [0] * 2880,
            "geothermal": [0] * 2880,
            "nuclear": [0] * 2880,
            "solar": [0] * 2880,
            "storage": [0] * 2880,
            "imports": [0] * 2880,
        },
        "demand": {
            "industriy": [0] * 2880,
            "construction": [0] * 2880,
            "extraction_plants": [0] * 2880,
            "research": [0] * 2880,
            "storage": [0] * 2880,
            "exports": [0] * 2880,
            "dumping": [0] * 2880,
        },
        "storage": {
            "pumped_hydro": [0] * 2880,
            "compressed_air": [0] * 2880,
            "molten_salt": [0] * 2880,
            "hydrogen": [0] * 2880,
            "batteries": [0] * 2880,
        },
        "ressources": {
            "coal": [0] * 168,
            "oil": [0] * 168,
            "gas": [0] * 168,
            "uranium": [0] * 168,
        },
        "emissions": [0] * 168,
    }
    with open(f"instance/player_prod/data_{username}.pck", "wb") as file:
        pickle.dump(past_data, file)

def add_player_to_data(username):
    engine = current_app.config["engine"]
    # TEMPORARY -> GENERATE NEW VALUES FOR EACH DAY 
    with open("website/static/data/industry_demand.pck", "rb") as file:
        industry_demand = pickle.load(file)
    engine.current_data[username] = {
        "generation": {
            "steam_engine": [0] * 1440,
            "windmill": [0] * 1440,
            "watermill": [0] * 1440,
            "coal_burner": [0] * 1440,
            "oil_burner": [0] * 1440,
            "gas_burner": [0] * 1440,
            "shallow_geothermal_plant": [0] * 1440,
            "small_water_dam": [0] * 1440,
            "wind_turbine": [0] * 1440,
            "combined_cycle": [0] * 1440,
            "deep_geothermal_plant": [0] * 1440,
            "nuclear_reactor": [0] * 1440,
            "large_water_dam": [0] * 1440,
            "CSP_solar": [0] * 1440,
            "PV_solar": [0] * 1440,
            "large_wind_turbine": [0] * 1440,
            "nuclear_reactor_gen4": [0] * 1440,

            "small_pumped_hydro": [0] * 1440,
            "compressed_air": [0] * 1440,
            "molten_salt": [0] * 1440,
            "large_pumped_hydro": [0] * 1440,
            "hydrogen_storage": [0] * 1440,
            "lithium_ion_batteries": [0] * 1440,
            "solid_state_batteries": [0] * 1440,

            "imports": [0] * 1440,
        },
        "demand": {
            "industriy": [i * 50000 for i in industry_demand],
            "construction": [0] * 1440,
            "coal_mine": [0] * 1440,
            "oil_field": [0] * 1440,
            "gas_drilling_site": [0] * 1440,
            "uranium_mine": [0] * 1440,
            "research": [0] * 1440,

            "small_pumped_hydro": [0] * 1440,
            "compressed_air": [0] * 1440,
            "molten_salt": [0] * 1440,
            "large_pumped_hydro": [0] * 1440,
            "hydrogen_storage": [0] * 1440,
            "lithium_ion_batteries": [0] * 1440,
            "solid_state_batteries": [0] * 1440,

            "exports": [0] * 1440,
            "dumping": [0] * 1440,
        },
        "storage": {
            "small_pumped_hydro": [0] * 1440,
            "large_pumped_hydro": [0] * 1440,
            "compressed_air": [0] * 1440,
            "molten_salt": [0] * 1440,
            "hydrogen": [0] * 1440,
            "lithium_ion_batteries": [0] * 1440,
            "solid_state_batteries": [0] * 1440,
        },
        "ressources": {
            "coal": [0] * 24,
            "oil": [0] * 24,
            "gas": [0] * 24,
            "uranium": [0] * 24,
        },
        "emissions": [0] * 24,
    }
