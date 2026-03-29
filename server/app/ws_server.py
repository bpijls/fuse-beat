"""
WebSocket server — handles device and browser frontend connections.
Runs on its own asyncio event loop in a background thread.
"""

import asyncio
import json
import websockets
from websockets.server import ServerConnection

from app.pubsub import pubsub_engine
from app.fusion import fusion_engine


def _parse_feed_ids(msg: dict) -> list[str]:
    """Parse feed_ids (list) or feed_id (str) from an identify message.
    Always includes 'default'. Deduplicates and caps at 2."""
    raw = msg.get("feed_ids") or [msg.get("feed_id", "default")]
    if isinstance(raw, str):
        raw = [raw]
    seen: dict[str, None] = {"default": None}
    for f in raw:
        if f and len(seen) < 2:
            seen[f] = None
    return list(seen)


async def handle_connection(ws: ServerConnection) -> None:
    client_addr = ws.remote_address
    client_type = None
    device_id = None

    try:
        async for raw_message in ws:
            try:
                msg = json.loads(raw_message)
            except json.JSONDecodeError:
                await ws.send(json.dumps({"type": "error", "message": "invalid JSON"}))
                continue

            msg_type = msg.get("type", "")

            # ---- Device messages ---------------------------------------- #

            if msg_type == "identify":
                client_type = "device"
                device_id   = msg.get("device_id", "0000")
                feed_ids    = _parse_feed_ids(msg)
                color       = msg.get("color", "#FF0000")

                pubsub_engine.register_device(device_id, ws, feed_ids, color)

                await ws.send(json.dumps({
                    "type":      "identified",
                    "device_id": device_id,
                    "feed_ids":  feed_ids,
                    "status":    "ok",
                }))
                print(f"[WS] Device identified: {device_id} feeds={feed_ids}", flush=True)

            elif msg_type == "heartbeat":
                if client_type != "device":
                    continue
                bpm   = float(msg.get("bpm", 72))
                color = pubsub_engine.get_device_color(device_id)

                pubsub_engine.update_device_beat(device_id, bpm)
                for fid in pubsub_engine.get_device_feeds(device_id):
                    fusion_engine.update_device_beat(fid, device_id, bpm, color)

            elif msg_type == "raw_sample":
                if client_type != "device":
                    continue
                ir_value     = int(msg.get("ir_value", 0))
                timestamp_ms = int(msg.get("timestamp_ms", 0))
                await pubsub_engine.broadcast_raw_sample(device_id, ir_value, timestamp_ms)

            # ---- Frontend messages --------------------------------------- #

            elif msg_type == "subscribe":
                client_type = "frontend"
                feed_id     = msg.get("feed_id", "default")
                pubsub_engine.subscribe_to_feed(ws, feed_id)
                await ws.send(json.dumps({"type": "subscribed", "feed_id": feed_id}))

            elif msg_type == "subscribe_raw":
                client_type     = "frontend"
                target_device   = msg.get("device_id")
                pubsub_engine.subscribe_to_raw(ws, target_device)
                await ws.send(json.dumps({"type": "subscribed_raw"}))

            # ---- Common ------------------------------------------------- #

            elif msg_type == "ping":
                await ws.send(json.dumps({"type": "pong"}))

    except websockets.exceptions.ConnectionClosedOK:
        pass
    except websockets.exceptions.ConnectionClosedError:
        pass
    except Exception as e:
        print(f"[WS] Error for {client_addr}: {e}", flush=True)
    finally:
        if client_type == "device" and device_id:
            removed = pubsub_engine.unregister_device(ws)
            for did in removed:
                for fid in pubsub_engine.get_device_feeds(did):
                    fusion_engine.remove_device(fid, did)
        else:
            pubsub_engine.unsubscribe(ws)
        print(f"[WS] Disconnected: {client_addr}", flush=True)


async def start_ws_server(host: str, port: int) -> None:
    # Connect fusion engine to pubsub broadcast
    fusion_engine.set_broadcast_fn(pubsub_engine.broadcast_fused_beat)

    print(f"[WS] Starting WebSocket server on {host}:{port}", flush=True)
    async with websockets.serve(handle_connection, host, port, ping_interval=20, ping_timeout=20):
        await asyncio.Future()  # run forever


def run_ws_server(host: str, port: int) -> None:
    """Entry point called from a background thread."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(start_ws_server(host, port))
    finally:
        loop.close()
