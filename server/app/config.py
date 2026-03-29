import os

SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-in-production")
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///fusebeat.db")
WS_HOST = os.environ.get("WS_HOST", "0.0.0.0")
WS_PORT = int(os.environ.get("WS_PORT", "5001"))
FLASK_PORT = int(os.environ.get("FLASK_PORT", "5000"))
FLASK_HOST = os.environ.get("FLASK_HOST", "0.0.0.0")
