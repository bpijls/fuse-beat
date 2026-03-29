from flask import Blueprint, request, jsonify
from app.database import get_db
from app.models import Device

devices_bp = Blueprint("devices", __name__)


def _db():
    return next(get_db())


def _normalize_feed_ids(raw: list | str | None) -> str:
    """Always includes 'default', deduplicates, caps at 2. Returns comma-separated string."""
    if isinstance(raw, str):
        raw = [raw]
    seen: dict[str, None] = {"default": None}
    for f in (raw or []):
        f = f.strip()
        if f and len(seen) < 2:
            seen[f] = None
    return ",".join(seen)


@devices_bp.get("/api/devices")
def list_devices():
    db = _db()
    devices = db.query(Device).all()
    return jsonify([_device_dict(d) for d in devices])


@devices_bp.get("/api/devices/<device_id>")
def get_device(device_id: str):
    db = _db()
    device = db.query(Device).filter(Device.device_id == device_id.upper()).first()
    if not device:
        return jsonify({"error": "not found"}), 404
    return jsonify(_device_dict(device))


@devices_bp.post("/api/devices")
def register_device():
    data = request.get_json()
    device_id = (data.get("device_id") or "").strip().upper()
    name      = (data.get("name") or "").strip()
    feed_ids  = _normalize_feed_ids(data.get("feed_ids"))

    if not device_id:
        return jsonify({"error": "device_id required"}), 400

    db = _db()
    existing = db.query(Device).filter(Device.device_id == device_id).first()
    if existing:
        return jsonify(_device_dict(existing)), 200

    device = Device(device_id=device_id, name=name or f"Device {device_id}", feed_ids=feed_ids)
    db.add(device)
    db.commit()
    db.refresh(device)
    return jsonify(_device_dict(device)), 201


@devices_bp.patch("/api/devices/<device_id>")
def update_device(device_id: str):
    db = _db()
    device = db.query(Device).filter(Device.device_id == device_id.upper()).first()
    if not device:
        return jsonify({"error": "not found"}), 404

    data = request.get_json()
    if "color" in data:
        device.color = data["color"]
    if "feed_ids" in data:
        device.feed_ids = _normalize_feed_ids(data["feed_ids"])
    if "name" in data:
        device.name = data["name"]

    db.commit()
    db.refresh(device)
    return jsonify(_device_dict(device))


@devices_bp.delete("/api/devices/<device_id>")
def delete_device(device_id: str):
    db = _db()
    device = db.query(Device).filter(Device.device_id == device_id.upper()).first()
    if not device:
        return jsonify({"error": "not found"}), 404
    db.delete(device)
    db.commit()
    return jsonify({"status": "deleted"})


def _device_dict(d: Device) -> dict:
    return {
        "id":           d.id,
        "device_id":    d.device_id,
        "name":         d.name,
        "color":        d.color,
        "feed_ids":     d.feed_ids.split(","),
        "is_connected": d.is_connected,
        "last_seen":    d.last_seen.isoformat() if d.last_seen else None,
    }
