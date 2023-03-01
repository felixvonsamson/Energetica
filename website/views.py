from flask import Blueprint, render_template, request, flash, jsonify, session, g, current_app
from flask_login import login_required, current_user
import pandas as pd

views = Blueprint('views', __name__)

@views.before_request
@login_required
def check_user():
    g.engine = current_app.config["engine"]
    g.config = g.engine.config[session["ID"]]
    def render_template_ctx(page):
        if page == "production_overview.jinja" :
            load_table = pd.read_csv('instance/player_prod/'+current_user.production_table_name)
            prod_table = load_table.to_dict('list')
            return render_template(page, engine=g.engine, user=current_user, data=g.config["assets"], prod_table=prod_table)
        else:
            return render_template(page, engine=g.engine, user=current_user, data=g.config["assets"])
    g.render_template_ctx = render_template_ctx

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

    return g.render_template_ctx("home.jinja")

@views.route('/power_buildings')
@login_required
def energy_buildings():
    return g.render_template_ctx("power_buildings.jinja")

@views.route('/storage_buildings')
@login_required
def storage_buildings():
    return g.render_template_ctx("storage_buildings.jinja")

@views.route('/technology')
@login_required
def technology():
    return g.render_template_ctx("technologies.jinja")

@views.route('/functional_buildings')
@login_required
def functional_buildings():
    return g.render_template_ctx("functional_buildings.jinja")

@views.route('/extraction_plants')
@login_required
def extraction_plants():
    return g.render_template_ctx("extraction_plants.jinja")

@views.route('/production_overview')
@login_required
def production_overview():
    return g.render_template_ctx("production_overview.jinja")

@views.route('/network')
@login_required
def network():
    return g.render_template_ctx("network.jinja")
