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
from pathlib import Path

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
        elif len(username) < 3:
            flash("Username must have at least 3 characters.",
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
    past_data = data_init(1440)
    Path(f"instance/player_data/{username}").mkdir(parents=True, exist_ok=True)
    for timescale in ["day", "5_days", "month", "6_months"]:
        with open(f"instance/player_data/{username}/{timescale}.pck", "wb") as file:
            pickle.dump(past_data, file)

def add_player_to_data(username):
    engine = current_app.config["engine"]
    # TEMPORARY -> GENERATE NEW VALUES FOR EACH DAY 
    with open("website/static/data/industry_demand.pck", "rb") as file:
        industry_demand = pickle.load(file)
    engine.current_data[username] = data_init(1441)
    engine.current_data[username]["demand"]["industriy"] = [
        i * 50000 for i in industry_demand]

def data_init(length):
    return {
        "generation": {
            "steam_engine": [0] * length,
            "windmill": [0] * length,
            "watermill": [0] * length,
            "coal_burner": [0] * length,
            "oil_burner": [0] * length,
            "gas_burner": [0] * length,
            "shallow_geothermal_plant": [0] * length,
            "small_water_dam": [0] * length,
            "wind_turbine": [0] * length,
            "combined_cycle": [0] * length,
            "deep_geothermal_plant": [0] * length,
            "nuclear_reactor": [0] * length,
            "large_water_dam": [0] * length,
            "CSP_solar": [0] * length,
            "PV_solar": [0] * length,
            "large_wind_turbine": [0] * length,
            "nuclear_reactor_gen4": [0] * length,

            "small_pumped_hydro": [0] * length,
            "compressed_air": [0] * length,
            "molten_salt": [0] * length,
            "large_pumped_hydro": [0] * length,
            "hydrogen_storage": [0] * length,
            "lithium_ion_batteries": [0] * length,
            "solid_state_batteries": [0] * length,

            "imports": [0] * length,
        },
        "demand": {
            "industriy": [0] * length,
            "construction": [0] * length,
            "coal_mine": [0] * length,
            "oil_field": [0] * length,
            "gas_drilling_site": [0] * length,
            "uranium_mine": [0] * length,
            "research": [0] * length,

            "small_pumped_hydro": [0] * length,
            "compressed_air": [0] * length,
            "molten_salt": [0] * length,
            "large_pumped_hydro": [0] * length,
            "hydrogen_storage": [0] * length,
            "lithium_ion_batteries": [0] * length,
            "solid_state_batteries": [0] * length,

            "exports": [0] * length,
            "dumping": [0] * length,
        },
        "storage": {
            "small_pumped_hydro": [0] * length,
            "large_pumped_hydro": [0] * length,
            "compressed_air": [0] * length,
            "molten_salt": [0] * length,
            "hydrogen_storage": [0] * length,
            "lithium_ion_batteries": [0] * length,
            "solid_state_batteries": [0] * length,
        },
        "ressources": {
            "coal": [1000000] * length,
            "oil": [500000] * length,
            "gas": [700000] * length,
            "uranium": [10000] * length,
        },
        "emissions": {
            "steam_engine": [0] * length,
            "coal_burner": [0] * length,
            "oil_burner": [0] * length,
            "gas_burner": [0] * length,
            "shallow_geothermal_plant": [0] * length,
            "combined_cycle": [0] * length,
            "deep_geothermal_plant": [0] * length,
            "nuclear_reactor": [0] * length,
            "nuclear_reactor_gen4": [0] * length,
        }
    }