"""
Device simulator — creates N fake async device clients for testing
the fusion pipeline without physical hardware.
"""

import asyncio
import json
import random
import time
import threading
from typing import Optional


_sim_tasks: list[asyncio.Task] = []
_sim_loop: Optional[asyncio.AbstractEventLoop] = None
_sim_thread: Optional[threading.Thread] = None
_sim_lock = threading.Lock()


async def _simulate_device(
    device_id: str,
    feed_id: str,
    bpm: float,
    ws_url: str,
    stop_event: asyncio.Event,
) -> None:
    import websockets

    while not stop_event.is_set():
        try:
            async with websockets.connect(ws_url) as ws:
                # Identify
                await ws.send(json.dumps({
                    "type":        "identify",
                    "client_type": "device",
                    "device_id":   device_id,
                    "feed_id":     feed_id,
                    "color":       f"#{random.randint(0, 0xFFFFFF):06X}",
                }))
                print(f"[Sim] Device {device_id} connected", flush=True)

                while not stop_event.is_set():
                    # Add slight BPM drift
                    bpm_drift = bpm + random.uniform(-2.0, 2.0)
                    bpm_drift = max(40.0, min(200.0, bpm_drift))
                    interval_s = 60.0 / bpm_drift

                    await ws.send(json.dumps({
                        "type":         "heartbeat",
                        "device_id":    device_id,
                        "feed_id":      feed_id,
                        "bpm":          round(bpm_drift, 1),
                        "timestamp_ms": int(time.time() * 1000),
                    }))

                    await asyncio.sleep(interval_s)

        except Exception as e:
            if not stop_event.is_set():
                print(f"[Sim] Device {device_id} disconnected: {e} — retrying in 3s", flush=True)
                await asyncio.sleep(3)


# ---- Public API -------------------------------------------------------- #

_stop_event: asyncio.Event | None = None


def start_simulation(n_devices: int, feed_id: str, bpm_min: float, bpm_max: float, ws_url: str) -> dict:
    global _sim_loop, _sim_thread, _stop_event

    with _sim_lock:
        if _sim_loop is not None and not _sim_loop.is_closed():
            return {"status": "already_running"}

        _sim_loop = asyncio.new_event_loop()

        def _run_loop() -> None:
            asyncio.set_event_loop(_sim_loop)
            _sim_loop.run_forever()

        _sim_thread = threading.Thread(target=_run_loop, daemon=True)
        _sim_thread.start()

        # Create the stop event inside the simulator's event loop
        future = asyncio.run_coroutine_threadsafe(_create_stop_event(), _sim_loop)
        stop_ev = future.result(timeout=5)

        for i in range(n_devices):
            device_id = f"SIM{i:02d}"
            bpm = random.uniform(bpm_min, bpm_max)
            asyncio.run_coroutine_threadsafe(
                _simulate_device(device_id, feed_id, bpm, ws_url, stop_ev),
                _sim_loop,
            )

        return {"status": "started", "n_devices": n_devices, "feed_id": feed_id}


async def _create_stop_event() -> asyncio.Event:
    global _stop_event
    _stop_event = asyncio.Event()
    return _stop_event


def stop_simulation() -> dict:
    global _sim_loop, _sim_thread, _stop_event

    with _sim_lock:
        if _sim_loop is None:
            return {"status": "not_running"}

        if _stop_event is not None:
            _sim_loop.call_soon_threadsafe(_stop_event.set)

        _sim_loop.call_soon_threadsafe(_sim_loop.stop)
        if _sim_thread:
            _sim_thread.join(timeout=5)

        _sim_loop = None
        _sim_thread = None
        _stop_event = None

        return {"status": "stopped"}


def is_running() -> bool:
    with _sim_lock:
        return _sim_loop is not None and not _sim_loop.is_closed()
