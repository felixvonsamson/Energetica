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
from .database.database import Player
from werkzeug.security import generate_password_hash, check_password_hash
from . import db
from flask_login import login_user, login_required, logout_user, current_user
from website.api import ws

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
            login_user(new_player, remember=True)
            flash("Account created!", category="message")
            g.engine.log(f"{username} created an account")
            ws.rest_notify_scoreboard(current_app.config["engine"])
            ws.rest_notify_new_player(current_app.config["engine"], new_player)
            return redirect(url_for("views.home"))

    return render_template("sign_up.jinja", user=current_user)
