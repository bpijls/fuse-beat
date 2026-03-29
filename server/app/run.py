"""
Entry point: starts the Flask REST API and WebSocket server concurrently.
"""
import threading
from app import create_app
from app.ws_server import run_ws_server
from app.config import FLASK_HOST, FLASK_PORT, WS_HOST, WS_PORT


def main() -> None:
    # Start WebSocket server in a background thread
    ws_thread = threading.Thread(
        target=run_ws_server,
        args=(WS_HOST, WS_PORT),
        daemon=True,
    )
    ws_thread.start()
    print(f"[Run] WebSocket server thread started on {WS_HOST}:{WS_PORT}", flush=True)

    # Start Flask via waitress (blocking)
    import waitress
    flask_app = create_app()
    print(f"[Run] Flask server starting on {FLASK_HOST}:{FLASK_PORT}", flush=True)
    waitress.serve(flask_app, host=FLASK_HOST, port=FLASK_PORT)


if __name__ == "__main__":
    main()
