"""Functions for authentication and sign-up of users."""

import json
from datetime import datetime

from flask import Blueprint, current_app, flash, g, redirect, render_template, request, url_for
from flask_login import current_user, login_required, login_user, logout_user
from werkzeug.security import check_password_hash, generate_password_hash

from energetica.database.player import Player
from energetica.globals import engine

auth = Blueprint("auth", __name__)


# logic for the login :
@auth.route("/login", methods=["GET", "POST"])
def login():
    """Endpoint for attempting to log in."""
    if request.method == "POST":
        username = request.form.get("username")
        password = request.form.get("password")

        player = next(Player.filter_by(username=username), None)
        if player:
            if check_password_hash(player.pwhash, password):
                flash("Logged in successfully!", category="message")
                login_user(player, remember=True)
                engine.log(f"{username} logged in")
                return redirect(url_for("views.home"))
            else:
                flash("Incorrect password, try again.", category="error")
        else:
            flash(
                "Username does not exist.<br><b>All accounts created before "
                "the 20.12.2024 have been<br>deleted due to a server reset for "
                "the 0.11 update.<br>If your account has been deleted, please "
                "create a new one.</b>",
                category="error",
            )

    return render_template("login.jinja", engine=engine, user=current_user)


# logic for the logout :
@auth.route("/logout")
@login_required
def logout():
    """Log out the current user."""
    engine.log(f"{current_user.username} logged out")
    logout_user()
    return redirect(url_for("auth.login"))


# logic for the sign-up :
@auth.route("/sign-up", methods=["GET", "POST"])
def sign_up():
    """Create a new account."""
    if request.method == "POST":
        username = request.form.get("username")
        username = username.strip()
        password1 = request.form.get("password1")
        password2 = request.form.get("password2")

        existing_player = Player.filter_by(username=username)
        if existing_player:
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
            login_user(new_player, remember=True)
            flash("Account created!", category="message")
            log_entry = {
                "timestamp": datetime.now().isoformat(),
                "action_type": "create_user",
                "player_id": new_player.id,
            }
            engine.action_logger.info(json.dumps(log_entry))
            engine.log(f"{username} created an account")
            # websocket.rest_notify_scoreboard()
            # websocket.rest_notify_new_player()
            return redirect(url_for("views.home"))

    return render_template("sign_up.jinja", engine=engine, user=current_user)
