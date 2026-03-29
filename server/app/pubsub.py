"""
PubSub engine — manages WebSocket connections for devices and browser frontends.
Thread-safe via asyncio; all mutations happen on the asyncio event loop thread.
"""

import asyncio
import json
import time
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from websockets.server import ServerConnection


class PubSubEngine:
    def __init__(self) -> None:
        # device_id -> websocket
        self.device_connections: dict[str, "ServerConnection"] = {}
        # device_id -> {"feed_ids": list[str], "color": str, "bpm": float, "last_beat_s": float}
        self.device_meta: dict[str, dict] = {}

        # feed_id -> set of browser websockets
        self.feed_subscribers: dict[str, set["ServerConnection"]] = {}

        # set of browser websockets subscribed to ALL raw samples
        self.raw_subscribers: set["ServerConnection"] = set()
        # device_id -> set of browser websockets subscribed to that device's raw signal
        self.device_raw_subscribers: dict[str, set["ServerConnection"]] = {}

    # ------------------------------------------------------------------ #
    #  Device management                                                  #
    # ------------------------------------------------------------------ #

    def register_device(self, device_id: str, ws: "ServerConnection", feed_ids: list[str], color: str) -> None:
        self.device_connections[device_id] = ws
        self.device_meta[device_id] = {
            "feed_ids": feed_ids,
            "color": color,
            "bpm": 0.0,
            "last_beat_s": time.monotonic(),
        }
        print(f"[PubSub] Device registered: {device_id} on feeds {feed_ids}", flush=True)

    def unregister_device(self, ws: "ServerConnection") -> list[str]:
        removed = [did for did, w in self.device_connections.items() if w is ws]
        for did in removed:
            del self.device_connections[did]
            self.device_meta.pop(did, None)
            print(f"[PubSub] Device unregistered: {did}", flush=True)
        return removed

    def update_device_beat(self, device_id: str, bpm: float) -> None:
        if device_id in self.device_meta:
            self.device_meta[device_id]["bpm"] = bpm
            self.device_meta[device_id]["last_beat_s"] = time.monotonic()

    def get_device_feeds(self, device_id: str) -> list[str]:
        return self.device_meta.get(device_id, {}).get("feed_ids", ["default"])

    def get_device_color(self, device_id: str) -> str:
        return self.device_meta.get(device_id, {}).get("color", "#FF0000")

    def get_connected_devices(self, feed_id: str | None = None) -> list[dict]:
        result = []
        for did, meta in self.device_meta.items():
            if feed_id is None or feed_id in meta["feed_ids"]:
                result.append({"id": did, **meta})
        return result

    # ------------------------------------------------------------------ #
    #  Frontend subscriptions                                             #
    # ------------------------------------------------------------------ #

    def subscribe_to_feed(self, ws: "ServerConnection", feed_id: str) -> None:
        self.feed_subscribers.setdefault(feed_id, set()).add(ws)
        print(f"[PubSub] Frontend subscribed to feed '{feed_id}'", flush=True)

    def subscribe_to_raw(self, ws: "ServerConnection", device_id: str | None = None) -> None:
        if device_id:
            self.device_raw_subscribers.setdefault(device_id, set()).add(ws)
        else:
            self.raw_subscribers.add(ws)

    def unsubscribe(self, ws: "ServerConnection") -> None:
        self.raw_subscribers.discard(ws)
        for subs in self.feed_subscribers.values():
            subs.discard(ws)
        for subs in self.device_raw_subscribers.values():
            subs.discard(ws)

    # ------------------------------------------------------------------ #
    #  Broadcast helpers                                                  #
    # ------------------------------------------------------------------ #

    async def broadcast_fused_beat(
        self,
        feed_id: str,
        bpm: float,
        interval_ms: int,
        device_count: int,
    ) -> None:
        """Broadcast fused_beat to all devices on the feed AND all browser subscribers."""
        import time as _time
        msg = json.dumps({
            "type":         "fused_beat",
            "feed_id":      feed_id,
            "bpm":          bpm,
            "interval_ms":  interval_ms,
            "device_count": device_count,
            "timestamp_ms": int(_time.time() * 1000),
        })

        targets: list["ServerConnection"] = []

        # Devices subscribed to this feed
        for did, meta in self.device_meta.items():
            if feed_id in meta["feed_ids"] and did in self.device_connections:
                targets.append(self.device_connections[did])

        # Browser frontends subscribed to this feed
        targets.extend(self.feed_subscribers.get(feed_id, set()))

        await _safe_broadcast(msg, targets)

        # Send feed_status update to feed subscribers
        devices_info = self.get_connected_devices(feed_id)
        status_msg = json.dumps({
            "type":    "feed_status",
            "feed_id": feed_id,
            "devices": devices_info,
        })
        await _safe_broadcast(status_msg, list(self.feed_subscribers.get(feed_id, set())))

    async def broadcast_raw_sample(self, device_id: str, ir_value: int, timestamp_ms: int) -> None:
        msg = json.dumps({
            "type":         "raw_sample",
            "device_id":    device_id,
            "ir_value":     ir_value,
            "timestamp_ms": timestamp_ms,
        })
        targets = list(self.raw_subscribers) + list(self.device_raw_subscribers.get(device_id, set()))
        await _safe_broadcast(msg, targets)

    async def send_to_device(self, device_id: str, message: str) -> bool:
        ws = self.device_connections.get(device_id)
        if not ws:
            return False
        try:
            await ws.send(message)
            return True
        except Exception as e:
            print(f"[PubSub] Failed to send to {device_id}: {e}", flush=True)
            return False


async def _safe_broadcast(msg: str, targets: list["ServerConnection"]) -> None:
    if not targets:
        return
    results = await asyncio.gather(*[ws.send(msg) for ws in targets], return_exceptions=True)
    for target, result in zip(targets, results):
        if isinstance(result, Exception):
            # Don't remove here — cleanup happens in connection handler finally block
            pass


# Module-level singleton
pubsub_engine = PubSubEngine()
