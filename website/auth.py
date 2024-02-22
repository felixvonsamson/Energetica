"""
This file contains the functions for authentification and sign-up of users
"""

from flask import (
    Blueprint,
    render_template,
    request,
    flash,
    redirect,
    url_for,
    g,
)
from flask import current_app
from .database import Player, CircularBufferPlayer
from werkzeug.security import generate_password_hash, check_password_hash
from . import db
from flask_login import login_user, login_required, logout_user, current_user
import pickle
from website import rest_api

auth = Blueprint("auth", __name__)


@auth.before_request
def check_user():
    g.engine = current_app.config["engine"]


# logic for the login :
@auth.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username")
        password = request.form.get("password")

        player = Player.query.filter_by(username=username).first()
        if player:
            if check_password_hash(player.pwhash, password):
                flash("Logged in successfully!", category="message")
                login_user(player, remember=True)
                g.engine.log(f"{username} logged in")
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
    g.engine.log(f"{current_user.username} logged out")
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
            flash("Username must have at least 3 characters.", category="error")
        elif password1 != password2:
            flash("Passwords don't match.", category="error")
        elif len(password1) < 7:
            flash("Password must be at least 7 characters.", category="error")
        else:
            new_player = Player(
                username=username,
                pwhash=generate_password_hash(password1, method="scrypt"),
            )
            db.session.add(new_player)
            db.session.commit()
            add_player_to_data(new_player.id)
            init_table(new_player)
            db.session.commit()
            login_user(new_player, remember=True)
            flash("Account created!", category="message")
            print(f"{username} created an account")
            rest_api.rest_notify_new_player(
                current_app.config["engine"], new_player
            )
            return redirect(url_for("views.home"))

    return render_template("sign_up.jinja", user=current_user)


# initialize data table for new user and stores it as a .pck in the 'player_data' repo
def init_table(player):
    past_data = data_init()
    with open(f"instance/player_data/player_{player.id}.pck", "wb") as file:
        pickle.dump(past_data, file)


def add_player_to_data(user_id):
    g.engine.data["current_data"][user_id] = CircularBufferPlayer()


def data_init():
    def init_array():
        return [[0.0] * 1440] * 4

    return {
        "revenues": {
            "industry": init_array(),
            "exports": init_array(),
            "imports": init_array(),
            "dumping": init_array(),
        },
        "op_costs": {
            "steam_engine": init_array(),
        },
        "generation": {
            "steam_engine": init_array(),
            "imports": init_array(),
        },
        "demand": {
            "industry": init_array(),
            "construction": init_array(),
            "research": init_array(),
            "transport": init_array(),
            "exports": init_array(),
            "dumping": init_array(),
        },
        "storage": {},
        "resources": {},
        "emissions": {
            "steam_engine": init_array(),
            "construction": init_array(),
        },
    }
