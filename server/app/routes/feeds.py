from flask import Blueprint, request, jsonify
from app.database import get_db
from app.models import Feed
from app.pubsub import pubsub_engine
from app.fusion import fusion_engine

feeds_bp = Blueprint("feeds", __name__)


def _db():
    return next(get_db())


@feeds_bp.get("/api/feeds")
def list_feeds():
    db = _db()
    feeds = db.query(Feed).all()
    return jsonify([_feed_dict(f) for f in feeds])


@feeds_bp.post("/api/feeds")
def create_feed():
    data = request.get_json()
    name = (data.get("name") or "").strip().lower().replace(" ", "_")
    desc = data.get("description", "")

    if not name:
        return jsonify({"error": "name required"}), 400

    db = _db()
    if db.query(Feed).filter(Feed.name == name).first():
        return jsonify({"error": "feed already exists"}), 409

    feed = Feed(name=name, description=desc)
    db.add(feed)
    db.commit()
    db.refresh(feed)
    return jsonify(_feed_dict(feed)), 201


@feeds_bp.get("/api/feeds/<feed_name>/status")
def feed_status(feed_name: str):
    devices = pubsub_engine.get_connected_devices(feed_name)
    active  = fusion_engine.get_active_devices(feed_name)
    bpm     = fusion_engine.feeds.get(feed_name, None)
    return jsonify({
        "feed_id":      feed_name,
        "device_count": len(devices),
        "devices":      devices,
        "fused_bpm":    round(bpm.fused_bpm, 1) if bpm else None,
    })


def _feed_dict(f: Feed) -> dict:
    return {
        "id":          f.id,
        "name":        f.name,
        "description": f.description,
        "created_at":  f.created_at.isoformat(),
    }
