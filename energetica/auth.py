"""Functions for authentication and sign-up of users."""

import re
from datetime import datetime

from flask import Blueprint, abort, flash, redirect, render_template, request, url_for
from flask_login import current_user, login_required, login_user, logout_user
from werkzeug.security import check_password_hash, generate_password_hash

import energetica
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
        if not username or not password:
            flash("Please enter a username and password.", category="error")
            return

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
                f"Username does not exist.<br><b>All accounts created before the {energetica.__release_date__} "
                f"have been<br>deleted due to a server reset for the {energetica.__version__} update.<br>"
                "If your account has been deleted, please create a new one.</b>",
                category="error",
            )

    return render_template("login.jinja", engine=engine, user=current_user)


@auth.route("/root_login", methods=["POST"])
def root_login():
    if request.headers.get("X-Forwarded-For", request.remote_addr) != "127.0.0.1":
        abort(404)
    user_id = request.form.get("user_id")
    if not user_id:
        abort(400, description="User ID is required.")
    player = Player.get(int(user_id))
    if player is None:
        abort(404, description="User not found.")
    login_user(player, remember=True)
    engine.log(f"{player.username} logged in")
    return "Authenticated", 200


# logic for the logout :
@auth.route("/logout")
@login_required
def logout():
    """Log out the current user."""
    engine.log(f"{current_user.username} logged out")
    logout_user()
    return redirect(url_for("auth.login"))


def is_valid_hash_format(hash_string: str) -> bool:
    """Checks if the hash string matches the Werkzeug password hash format via regex"""
    pattern = r"^[a-z0-9]+:\d+:\d+:\d+\$[a-zA-Z0-9./]+\$[a-fA-F0-9]+$"
    return bool(re.match(pattern, hash_string))


# logic for the sign-up :
@auth.route("/sign-up", methods=["GET", "POST"])
def sign_up():
    """Create a new account."""
    if request.method == "POST":
        username = request.form.get("username")
        if not username:
            flash("Please enter a username.", category="error")
            return
        username = username.strip()
        password1 = request.form.get("password1")
        password2 = request.form.get("password2")
        pw_hash = request.form.get("pw_hash")

        existing_player = next(Player.filter_by(username=username), None)
        if existing_player:
            flash("Username already exist", category="error")
        elif len(username) < 3 or len(username) > 18:
            flash("Username must be between 3 and 18 characters.", category="error")
        elif not password1 or not password2:
            flash("Please enter a password.", category="error")
        elif pw_hash and not is_valid_hash_format(pw_hash):
            flash("Invalid password hash format.", category="error")
        elif not pw_hash and password1 != password2:
            flash("Passwords don't match.", category="error")
        elif not pw_hash and len(password1) < 7:
            flash("Password must be at least 7 characters.", category="error")
        else:
            pwhash = pw_hash or generate_password_hash(password1, method="scrypt")
            new_player = Player(username=username, pwhash=pwhash)
            login_user(new_player, remember=True)
            flash("Account created!", category="message")
            log_entry = {
                "timestamp": datetime.now().isoformat(),
                "ip": request.headers.get("X-Forwarded-For", request.remote_addr),
                "action_type": "create_user",
                "player_id": new_player.id,
                "username": new_player.username,
                "pw_hash": new_player.pwhash,
            }
            engine.log_action(log_entry)
            engine.log(f"{username} created an account")
            # websocket.rest_notify_scoreboard()
            # websocket.rest_notify_new_player()
            return redirect(url_for("views.home"))

    return render_template("sign_up.jinja", engine=engine, user=current_user)
