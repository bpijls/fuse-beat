from flask import Flask
from flask_cors import CORS
from app.database import init_db
from app.models import Feed
from app.database import SessionLocal


def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app)

    # Initialize DB and seed default feed
    init_db()
    _seed_defaults()

    # Register blueprints
    from app.routes.devices import devices_bp
    from app.routes.feeds import feeds_bp
    from app.routes.admin import admin_bp

    app.register_blueprint(devices_bp)
    app.register_blueprint(feeds_bp)
    app.register_blueprint(admin_bp)

    return app


def _seed_defaults() -> None:
    """Create the default feed if it doesn't exist."""
    db = SessionLocal()
    try:
        if not db.query(Feed).filter(Feed.name == "default").first():
            db.add(Feed(name="default", description="Default global feed"))
            db.commit()
    finally:
        db.close()
