"""This file contains the functions for authentication and sign-up of users."""

from flask import Blueprint, current_app, flash, g, redirect, render_template, request, url_for
from flask_login import current_user, login_required, login_user, logout_user
from werkzeug.security import check_password_hash, generate_password_hash

from website.api import websocket

from . import db
from .database.player import Player

auth = Blueprint("auth", __name__)


@auth.before_request
def check_user():
    """This function is called before every request"""
    g.engine = current_app.config["engine"]


# logic for the login :
@auth.route("/login", methods=["GET", "POST"])
def login():
    """This is the endpoint for an attempt to log in"""
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
            flash(
                "Username does not exist.<br><b>All accounts created before "
                "the 01.09.2024 have been<br>deleted due to a server reset for "
                "the 0.10 update.<br>If your account has been deleted, please "
                "create a new one.</b>",
                category="error",
            )

    return render_template("login.jinja", engine=g.engine, user=current_user)


# logic for the logout :
@auth.route("/logout")
@login_required
def logout():
    """This is the endpoint for logging out"""
    g.engine.log(f"{current_user.username} logged out")
    logout_user()
    return redirect(url_for("auth.login"))


# logic for the sign-up :
@auth.route("/sign-up", methods=["GET", "POST"])
def sign_up():
    """This is the endpoint for creating a new account"""
    if request.method == "POST":
        username = request.form.get("username")
        username = username.strip()
        password1 = request.form.get("password1")
        password2 = request.form.get("password2")

        player = Player.query.filter_by(username=username).first()
        if player:
            flash("Username already exist", category="error")
        elif len(username) < 3 or len(username) > 18:
            flash("Username must be between 3 and 18 characters.", category="error")
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
            websocket.rest_notify_scoreboard(g.engine)
            websocket.rest_notify_new_player(g.engine)
            return redirect(url_for("views.home"))

    return render_template("sign_up.jinja", engine=g.engine, user=current_user)
