from flask import Blueprint, render_template, request, flash, redirect, url_for, session
from .database import Player
from werkzeug.security import generate_password_hash, check_password_hash
from . import db
from flask_login import login_user, login_required, logout_user, current_user


auth = Blueprint('auth', __name__)


@auth.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')

        player = Player.query.filter_by(username=username).first()
        if player:
            if check_password_hash(player.password, password):
                flash('Logged in successfully!', category='success')
                login_user(player, remember=True)
                session["ID"] = player.id
                return redirect(url_for('views.home'))
            else:
                flash('Incorrect password, try again.', category='error')
        else:
            flash('Username does not exist.', category='error')

    return render_template("login.jinja", user=current_user)


@auth.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('auth.login'))


@auth.route('/sign-up', methods=['GET', 'POST'])
def sign_up():
    if request.method == 'POST':
        username = request.form.get('username')
        password1 = request.form.get('password1')
        password2 = request.form.get('password2')

        player = Player.query.filter_by(username=username).first()
        if player:
            flash('Username already exist', category='error')
        elif len(username) < 4:
            flash('Username must be greater than 3 characters.', category='error')
        elif password1 != password2:
            flash('Passwords don\'t match.', category='error')
        elif len(password1) < 7:
            flash('Password must be at least 7 characters.', category='error')
        else:
            new_player = Player(username=username, password=generate_password_hash(
                password1, method='sha256'), q=0, r=0)
            db.session.add(new_player)
            db.session.commit()
            login_user(new_player, remember=True)
            session["ID"] = new_player.id
            flash('Account created!', category='success')
            return redirect(url_for('views.home'))

    return render_template("sign_up.jinja", user=current_user)
