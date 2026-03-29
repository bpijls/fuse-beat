from flask import Blueprint, request, jsonify
from app.pubsub import pubsub_engine
from app.fusion import fusion_engine
from app import simulator
from app.config import WS_PORT

admin_bp = Blueprint("admin", __name__)


@admin_bp.get("/api/admin/status")
def admin_status():
    all_devices = pubsub_engine.get_connected_devices()
    feeds = {}
    for feed_id, state in fusion_engine.feeds.items():
        feeds[feed_id] = {
            "bpm":          round(state.fused_bpm, 1),
            "device_count": len(fusion_engine.get_active_devices(feed_id)),
        }
    return jsonify({
        "connected_devices": len(all_devices),
        "devices": all_devices,
        "feeds": feeds,
        "simulator_running": simulator.is_running(),
    })


@admin_bp.post("/api/admin/simulator/start")
def start_simulator():
    data       = request.get_json()
    n_devices  = int(data.get("n_devices", 3))
    feed_id    = data.get("feed_id", "default")
    bpm_min    = float(data.get("bpm_min", 60.0))
    bpm_max    = float(data.get("bpm_max", 90.0))
    ws_url     = data.get("ws_url", f"ws://localhost:{WS_PORT}/ws")

    result = simulator.start_simulation(n_devices, feed_id, bpm_min, bpm_max, ws_url)
    return jsonify(result)


@admin_bp.post("/api/admin/simulator/stop")
def stop_simulator():
    return jsonify(simulator.stop_simulation())


@admin_bp.get("/api/firmware/latest")
def firmware_info():
    import os
    firmware_dir = os.path.join(os.path.dirname(__file__), "..", "static", "firmware")
    meta_path = os.path.join(firmware_dir, "firmware_meta.json")
    if os.path.exists(meta_path):
        import json
        with open(meta_path) as f:
            return jsonify(json.load(f))
    return jsonify({"error": "no firmware available"}), 404
