"""
Heartbeat fusion engine.

Maintains per-feed state: collects beat events from N devices,
computes a weighted-average BPM, and drives a phase-locked async
ticker that broadcasts fused_beat messages.
"""

import asyncio
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Callable, Awaitable

DEVICE_TIMEOUT_S = 10.0   # device considered inactive after this many seconds without a beat
FEED_IDLE_S      = 15.0   # stop ticker after this many seconds of no device activity
LERP_FACTOR      = 0.15   # phase nudge strength
MIN_BPM          = 40.0
MAX_BPM          = 200.0


@dataclass
class DeviceBeatRecord:
    device_id: str
    bpm: float
    last_beat_s: float
    color: str = "#FF0000"
    beat_history: deque = field(default_factory=lambda: deque(maxlen=5))


@dataclass
class FeedState:
    feed_id: str
    devices: dict = field(default_factory=dict)   # device_id -> DeviceBeatRecord
    master_phase_s: float = 0.0                   # absolute time when next beat fires
    fused_bpm: float = 72.0
    ticker_task: asyncio.Task | None = None
    last_activity_s: float = field(default_factory=time.monotonic)


# Broadcast callback type: async fn(feed_id, fused_bpm, interval_ms, device_count) -> None
BroadcastFn = Callable[[str, float, int, int], Awaitable[None]]


class FusionEngine:
    def __init__(self) -> None:
        self.feeds: dict[str, FeedState] = {}
        self._broadcast_fn: BroadcastFn | None = None

    def set_broadcast_fn(self, fn: BroadcastFn) -> None:
        self._broadcast_fn = fn

    # ------------------------------------------------------------------ #
    #  Public API                                                          #
    # ------------------------------------------------------------------ #

    def update_device_beat(
        self,
        feed_id: str,
        device_id: str,
        bpm: float,
        color: str = "#FF0000",
    ) -> None:
        """Called when a device sends a heartbeat event."""
        now = time.monotonic()
        feed = self._get_or_create_feed(feed_id)

        if device_id not in feed.devices:
            feed.devices[device_id] = DeviceBeatRecord(
                device_id=device_id,
                bpm=bpm,
                last_beat_s=now,
                color=color,
            )
        else:
            rec = feed.devices[device_id]
            rec.bpm = bpm
            rec.last_beat_s = now
            rec.color = color
            rec.beat_history.append(now)

        feed.last_activity_s = now

        # Update fused BPM
        feed.fused_bpm = self._compute_fused_bpm(feed)

        # Nudge master phase toward incoming beat
        interval_s = 60.0 / feed.fused_bpm
        if feed.master_phase_s > 0:
            # Compute phase error (how far ahead/behind the current beat is)
            phase_error = (now - feed.master_phase_s) % interval_s
            if phase_error > interval_s / 2:
                phase_error -= interval_s
            feed.master_phase_s += LERP_FACTOR * phase_error
        else:
            # First beat — set phase immediately
            feed.master_phase_s = now + interval_s

        # Start ticker if not running
        if feed.ticker_task is None or feed.ticker_task.done():
            feed.ticker_task = asyncio.create_task(self._run_feed_ticker(feed_id))

    def remove_device(self, feed_id: str, device_id: str) -> None:
        feed = self.feeds.get(feed_id)
        if feed:
            feed.devices.pop(device_id, None)

    def get_active_devices(self, feed_id: str) -> list[DeviceBeatRecord]:
        feed = self.feeds.get(feed_id)
        if not feed:
            return []
        now = time.monotonic()
        return [r for r in feed.devices.values() if (now - r.last_beat_s) < DEVICE_TIMEOUT_S]

    def get_all_feed_ids(self) -> list[str]:
        return list(self.feeds.keys())

    # ------------------------------------------------------------------ #
    #  Internal helpers                                                    #
    # ------------------------------------------------------------------ #

    def _get_or_create_feed(self, feed_id: str) -> FeedState:
        if feed_id not in self.feeds:
            self.feeds[feed_id] = FeedState(feed_id=feed_id)
        return self.feeds[feed_id]

    def _compute_fused_bpm(self, feed: FeedState) -> float:
        now = time.monotonic()
        active = [r for r in feed.devices.values() if (now - r.last_beat_s) < DEVICE_TIMEOUT_S]
        if not active:
            return feed.fused_bpm  # hold last known value

        weights = [1.0 / max(0.1, now - r.last_beat_s) for r in active]
        total_w = sum(weights)
        weighted_bpm = sum(w * r.bpm for w, r in zip(weights, active)) / total_w
        return max(MIN_BPM, min(MAX_BPM, weighted_bpm))

    async def _run_feed_ticker(self, feed_id: str) -> None:
        """Per-feed async task: sleeps until master_phase_s, broadcasts, repeats."""
        print(f"[Fusion] Ticker started for feed '{feed_id}'", flush=True)

        while True:
            feed = self.feeds.get(feed_id)
            if feed is None:
                break

            now = time.monotonic()

            # Check for inactivity
            if (now - feed.last_activity_s) > FEED_IDLE_S:
                print(f"[Fusion] Feed '{feed_id}' idle — stopping ticker", flush=True)
                break

            # Sleep until next beat
            wait = feed.master_phase_s - now
            if wait > 0:
                await asyncio.sleep(wait)

            feed = self.feeds.get(feed_id)
            if feed is None:
                break

            # Broadcast fused beat
            if self._broadcast_fn:
                active = self.get_active_devices(feed_id)
                interval_ms = int(60000.0 / feed.fused_bpm)
                try:
                    await self._broadcast_fn(
                        feed_id,
                        round(feed.fused_bpm, 1),
                        interval_ms,
                        len(active),
                    )
                except Exception as e:
                    print(f"[Fusion] Broadcast error for '{feed_id}': {e}", flush=True)

            # Advance master phase
            interval_s = 60.0 / feed.fused_bpm
            feed.master_phase_s += interval_s

        if feed_id in self.feeds:
            self.feeds[feed_id].ticker_task = None
        print(f"[Fusion] Ticker stopped for feed '{feed_id}'", flush=True)


# Module-level singleton
fusion_engine = FusionEngine()
