"""Functions for authentication and sign-up of users."""

from flask import Blueprint, current_app, flash, g, redirect, render_template, request, url_for
from flask_login import current_user, login_required, login_user, logout_user
from werkzeug.security import check_password_hash

from energetica.database.player import Player
from energetica.game_engine import GameError
from energetica.utils.auth_logic import signup_player

auth = Blueprint("auth", __name__)


@auth.before_request
def check_user() -> None:
    """Call this function before every request."""
    g.engine = current_app.config["engine"]


# logic for the login :
@auth.route("/login", methods=["GET", "POST"])
def login():
    """Endpoint for attempting to log in."""
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
                "the 20.12.2024 have been<br>deleted due to a server reset for "
                "the 0.11 update.<br>If your account has been deleted, please "
                "create a new one.</b>",
                category="error",
            )

    return render_template("login.jinja", engine=g.engine, user=current_user)


# logic for the logout :
@auth.route("/logout")
@login_required
def logout():
    """Log out the current user."""
    g.engine.log(f"{current_user.username} logged out")
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

        try:
            new_player = signup_player(username, password1, password2)
            login_user(new_player, remember=True)
            flash("Account created!", category="message")
            return redirect(url_for("views.home"))
        except GameError as e:
            match e.exception_type:
                case "usernameExists":
                    flash("Username already exist", category="error")
                case "usernameLength":
                    flash("Username must be between 3 and 18 characters.", category="error")
                case "passwordMismatch":
                    flash("Passwords don't match.", category="error")
                case "passwordLength":
                    flash("Password must be at least 7 characters.", category="error")
                case _:
                    raise
            return None

    return render_template("sign_up.jinja", engine=g.engine, user=current_user)
