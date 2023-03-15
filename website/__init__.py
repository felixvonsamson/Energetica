from flask import Flask, g, session
from flask_sqlalchemy import SQLAlchemy
import os
from pathlib import Path
from flask_login import LoginManager
from flask_socketio import SocketIO
import atexit
from flask_apscheduler import APScheduler

db = SQLAlchemy()
DB_NAME = "database.db"

heap = []

from website.gameEngine import gameEngine

def create_app():
    Path("instance/player_prod/").mkdir(parents=True, exist_ok=True)

    app = Flask(__name__)
    app.config['SECRET_KEY'] = 'ghdfjfetgftqayööhkh'
    app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{DB_NAME}'
    db.init_app(app)
    
    engine = gameEngine.load_data() if os.path.isfile("data.pck")  \
       else gameEngine()
    app.config["engine"] = engine

    socketio = SocketIO(app)
    engine.socketio = socketio

    from .socketio_handlers import add_handlers
    add_handlers(socketio=socketio, engine=engine)

    from .views import views
    from .auth import auth

    app.register_blueprint(views, url_prefix='/')
    app.register_blueprint(auth, url_prefix='/')

    from .database import Player
    
    with app.app_context():
        db.create_all()

    login_manager = LoginManager()
    login_manager.login_view = 'auth.login'
    login_manager.init_app(app)

    @login_manager.user_loader
    def load_user(id):
        return Player.query.get(int(id))
    
    if os.environ.get('WERKZEUG_RUN_MAIN') == 'true':
        from .gameEngine import daily_update, state_update_h, state_update_m, check_heap
        scheduler = APScheduler()
        engine.log("adding job")
        scheduler.init_app(app)
        daily_update(engine, app)
        scheduler.add_job(func=daily_update, args=(engine, app), id="daily_update", trigger="cron", hour=2)
        scheduler.add_job(func=state_update_h, args=(engine, app), id="state_update_h", trigger="interval", seconds=3600)
        scheduler.add_job(func=state_update_m, args=(engine, app), id="state_update_m", trigger="interval", seconds=60)
        scheduler.add_job(func=check_heap, args=(engine, app), id="check_heap", trigger="interval", seconds=1)
        scheduler.start()
        atexit.register(lambda: scheduler.shutdown())

    return socketio, app