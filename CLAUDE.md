# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

FuseBeat is a synchronized heartbeat visualization system. Physical ESP32-C3 devices measure pulse via MAX3010x sensor and stream BPM data over WebSocket to a server that fuses the beats into a single phase-locked rhythm, which is visualized in the browser. Users identify themselves by their device's 4-char hex ID (from MAC address), stored in `localStorage` — no accounts or passwords.

## Commands

### Run everything (standard workflow)
```bash
docker compose up --build
```
- Frontend: http://localhost:3000
- Backend REST API: http://localhost:5000
- Backend WebSocket: ws://localhost:5001/ws
- Admin/simulator: http://localhost:3000/admin (not linked from nav)

### Rebuild only one container
```bash
docker compose up --build server -d
docker compose up --build frontend -d
```

### Run backend locally (without Docker)
```bash
cd server
pip install -r requirements.txt
DATABASE_URL=sqlite:///fusebeat.db python -c "from app.run import main; main()"
```

### Run frontend dev server (with hot reload)
```bash
cd frontend
npm install
npm run dev   # proxies /api to localhost:5000
```

### Type-check frontend
```bash
cd frontend
npm run build   # runs tsc -b then vite build
```

### Firmware (PlatformIO, ESP32-C3 Super Mini)
```bash
cd firmware
pio run --target upload
pio device monitor   # serial at 115200 baud; type 'status' to see device ID
```

## Architecture

### Data flow
```
ESP32 device  →  WebSocket (port 5001)  →  FusionEngine  →  WebSocket broadcast
                                        ↑                         ↓
                                   PubSubEngine          Browser frontend
```

### Backend (`server/app/`)

Two concurrent servers in one process (`run.py`):
- **Flask** (waitress, port 5000) — REST API for device registration, feed management, admin/simulator
- **WebSocket** (websockets lib, port 5001) — real-time bidirectional channel; runs its own asyncio event loop in a background thread

Key singletons (module-level, shared across all requests):
- `pubsub_engine` (`pubsub.py`) — tracks live WebSocket connections, device metadata, and browser feed subscriptions. In-memory only, not persisted.
- `fusion_engine` (`fusion.py`) — per-feed BPM fusion: weighted-average across devices + phase-locked ticker task that fires `fused_beat` broadcasts. Ticker auto-starts on first beat, auto-stops after 15s of inactivity.

**Thread safety caveat**: `pubsub_engine` and `fusion_engine` are mutated from the WebSocket asyncio loop thread, never from Flask threads. Don't call async pubsub/fusion methods from REST route handlers.

Database is SQLite via SQLAlchemy (ORM). Models: `Device` (device_id, name, color, feed_id) and `Feed` (name, description). Seeded with a `default` feed on startup.

### Frontend (`frontend/src/`)

React + TypeScript + Tailwind, built with Vite. State via Zustand.

- `store/device.ts` — persists `deviceId` (the user's 4-char hex ID) in `localStorage` as `fusebeat-device`
- `api.ts` — all REST calls, no auth headers
- `hooks/useWebSocket.ts` → `hooks/useHeartbeat.ts` / `hooks/useRawSignal.ts` — WebSocket connection managed by hooks; connect only when `deviceId` is set
- `sketches/` — p5.js sketches (`HeartbeatSketch.ts`, `RawSignalSketch.ts`) instantiated inside React refs
- `/admin` route renders `AdminPage` **outside** `<Layout>` (no navbar) — it's a standalone page

### WebSocket protocol

Devices send:
- `identify` — registers device_id, feed_id, color
- `heartbeat` — bpm value, triggers fusion update
- `raw_sample` — ir_value for raw waveform visualization

Frontend sends:
- `subscribe` — subscribes to a feed's `fused_beat` + `feed_status` broadcasts
- `subscribe_raw` — subscribes to raw samples for a specific device_id

### Simulator (`server/app/simulator.py`)

Spawns N async fake devices in their own event loop thread (separate from the WebSocket server's loop). Each simulated device connects via WebSocket and sends heartbeats with slight BPM drift. Start/stop via POST `/api/admin/simulator/start` and `/stop`.

### Firmware (`firmware/src/`)

ESP32-C3 Arduino sketch. Reads MAX3010x, connects to WiFi + WebSocket server, sends `identify` then periodic `heartbeat` messages. Serial commands (`status`, `rawmode on/off`) handled by `CommandRegistry.cpp`. NeoPixel LED pulses in sync with `fused_beat` messages received from server.
