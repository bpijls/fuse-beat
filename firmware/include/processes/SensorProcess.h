#ifndef SENSOR_PROCESS_H
#define SENSOR_PROCESS_H

#include "Process.h"
#include "Timer.h"
#include "config.h"
#include <Wire.h>
#include <MAX30105.h>

extern bool rawSignalMode;

class SensorProcess : public Process {
public:
    SensorProcess()
        : Process(),
          sampleTimer(1000 / SENSOR_SAMPLE_RATE),
          smoothed(0.0f),
          dcLevel(0.0f),
          peakEnvelope(0.0f),
          aboveThreshold(false),
          settleCount(0),
          beatDetected(false),
          lastBeatTime(0),
          currentBPM(0.0f),
          lastBeatInterval(0)
    {}

    void setup() override {
        Wire.begin(SDA_PIN, SCL_PIN);

        if (!sensor.begin(Wire, I2C_SPEED_FAST)) {
            Serial.println("[Sensor] MAX30102 not found! Check wiring.");
            halt();
            return;
        }

        // ledMode=2: Red+IR only; getIR() returns the IR channel
        sensor.setup(0x1F, 4, 2, 400, 411, 4096);
        sensor.setPulseAmplitudeRed(0x0A);
        sensor.setPulseAmplitudeGreen(0);
        Serial.println("[Sensor] MAX30102 initialized");
        sampleTimer.reset();
    }

    void update() override {
        beatDetected = false;

        if (!sampleTimer.checkAndReset()) return;

        // check() returns the number of new samples pulled from the FIFO; use
        // it to bound the loop so we never spin on uninitialized sense state.
        uint16_t newSamples = sensor.check();

        for (uint16_t s = 0; s < newSamples && sensor.available(); s++) {
            long irValue = sensor.getIR();
            sensor.nextSample();

            // No finger — reset filters so they re-lock quickly when replaced
            if (irValue < 50000) {
                dcLevel        = (float)irValue;
                smoothed       = (float)irValue;
                peakEnvelope   = 0.0f;
                aboveThreshold = false;
                settleCount    = 0;
                if (rawSignalMode) {
                    Serial.print(irValue); Serial.print(','); Serial.println(irValue);
                }
                continue;
            }

            // Seed filters on very first valid sample (after no-finger state)
            if (dcLevel < 50000.0f) {
                dcLevel     = (float)irValue;
                smoothed    = (float)irValue;
                settleCount = 0;
            }

            // Two-stage IIR bandpass approximation:
            //   Stage 1: fast low-pass (~12 Hz at 100 Hz) removes shot noise
            //   Stage 2: slow low-pass (~1 Hz) tracks the DC baseline
            //   AC = stage1 − stage2  →  passes the 1–12 Hz heartbeat band
            smoothed = 0.75f * smoothed + 0.25f * (float)irValue;
            dcLevel  = 0.98f * dcLevel  + 0.02f * smoothed;
            float ac = smoothed - dcLevel;

            // Settling period: discard samples until the DC filter has converged
            // and any startup transients have passed (~200 samples ≈ 4 s at 50 Hz).
            if (settleCount < SENSOR_SETTLE_SAMPLES) {
                settleCount++;
                peakEnvelope = 0.0f;  // keep envelope clean during settling
                if (rawSignalMode) {
                    Serial.print(irValue); Serial.print(','); Serial.println(irValue);
                }
                continue;
            }

            // Adaptive peak envelope: fast attack, moderate decay.
            // 0.997/sample @ 50 Hz → half-life ~4.5 s so a single strong beat
            // doesn't suppress the threshold for many subsequent weaker beats.
            if (ac > peakEnvelope) peakEnvelope = ac;
            else                   peakEnvelope *= 0.997f;

            // Beat = upward crossing of 30% of the recent peak, with refractory guard
            float threshold = 0.3f * peakEnvelope;
            bool nowAbove   = (ac > threshold) && (peakEnvelope > BEAT_MIN_ENVELOPE);

            unsigned long now = millis();
            bool thisBeat = false;
            if (nowAbove && !aboveThreshold && (now - lastBeatTime) > BEAT_MIN_INTERVAL_MS) {
                if (lastBeatTime > 0) {
                    lastBeatInterval = now - lastBeatTime;
                    float bpm = 60000.0f / (float)lastBeatInterval;
                    if (bpm >= 40.0f && bpm <= 200.0f) {
                        currentBPM   = bpm;
                        beatDetected = true;
                        thisBeat     = true;
                    }
                }
                lastBeatTime = now;
            }
            aboveThreshold = nowAbove;

            // Raw mode: two comma-separated values.
            // Channel 2 = irValue+1000 on the exact sample of detection only.
            if (rawSignalMode) {
                long marker = thisBeat ? irValue + 1000L : irValue;
                Serial.print(irValue);
                Serial.print(',');
                Serial.println(marker);
            }
        }
    }

    bool hasBeat() const { return beatDetected; }
    float getBPM() const { return currentBPM; }
    unsigned long getLastBeatInterval() const { return lastBeatInterval; }

private:
    MAX30105 sensor;
    Timer sampleTimer;

    // IIR filter state
    float    smoothed;
    float    dcLevel;
    float    peakEnvelope;
    bool     aboveThreshold;
    uint16_t settleCount;

    bool beatDetected;
    unsigned long lastBeatTime;
    float currentBPM;
    unsigned long lastBeatInterval;
};

#endif // SENSOR_PROCESS_H
