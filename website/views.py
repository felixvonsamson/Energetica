from flask import Blueprint, render_template, request, flash, jsonify
from flask_login import login_required, current_user
from . import db
from .data import data
import json

views = Blueprint('views', __name__)


@views.route('/', methods=['GET', 'POST'])
@views.route('/home', methods=['GET', 'POST'])
@login_required
def home():
#    if request.method == 'POST': 
#        note = request.form.get('note')#Gets the note from the HTML 
#
#        if len(note) < 1:
#            flash('Note is too short!', category='error') 
#        else:
#            new_note = Note(data=note, user_id=current_user.id)  #providing the schema for the note 
#            db.session.add(new_note) #adding the note to the database 
#            db.session.commit()
#            flash('Note added!', category='success')

    return render_template("home.jinja", user=current_user)

@views.route('/power_buildings')
@login_required
def energy_buildings():
    return render_template("power_buildings.jinja", user=current_user, data=data["power buildings"])

@views.route('/storage_buildings')
@login_required
def storage_buildings():
    return render_template("storage_buildings.jinja", user=current_user, data=data["storage buildings"])

@views.route('/technology')
@login_required
def technology():
    return render_template("technologies.jinja", user=current_user, data=data["technology"])

@views.route('/functional_buildings')
@login_required
def functional_buildings():
    return render_template("functional_buildings.jinja", user=current_user, data=data["functional buildings"])
