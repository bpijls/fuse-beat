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
          bufferIndex(0),
          bufferFull(false),
          beatDetected(false),
          lastBeatTime(0),
          currentBPM(0.0f),
          lastBeatInterval(0)
    {
        memset(irBuffer, 0, sizeof(irBuffer));
    }

    void setup() override {
        Wire.begin(SDA_PIN, SCL_PIN);

        if (!sensor.begin(Wire, I2C_SPEED_FAST)) {
            Serial.println("[Sensor] MAX30102 not found! Check wiring.");
            halt();
            return;
        }

        // ledMode=2: Red+IR only (no green); getIR() reads the IR channel
        sensor.setup(0x1F, 4, 2, 400, 411, 4096);
        sensor.setPulseAmplitudeRed(0x0A);
        sensor.setPulseAmplitudeGreen(0);
        Serial.println("[Sensor] MAX30102 initialized");
        sampleTimer.reset();
    }

    void update() override {
        beatDetected = false;

        if (!sampleTimer.checkAndReset()) return;

        // check() returns the number of new samples read from the FIFO.
        // Use that count to bound the loop so uninitialized sense.head/tail
        // cannot cause an infinite spin.
        uint16_t newSamples = sensor.check();

        for (uint16_t s = 0; s < newSamples && sensor.available(); s++) {
            long irValue = sensor.getIR();
            sensor.nextSample();

            // Store sample in circular buffer
            irBuffer[bufferIndex] = irValue;
            bufferIndex = (bufferIndex + 1) % SENSOR_BUFFER_SIZE;
            if (bufferIndex == 0) bufferFull = true;

            // Output raw signal if in raw mode
            if (rawSignalMode) {
                Serial.println(irValue);
            }

            // Only do beat detection when buffer has enough samples
            int validSamples = bufferFull ? SENSOR_BUFFER_SIZE : bufferIndex;
            if (validSamples < 20) continue;

            // Compute mean and standard deviation
            double sum = 0;
            for (int i = 0; i < validSamples; i++) {
                sum += irBuffer[i];
            }
            double mean = sum / validSamples;

            double sqSum = 0;
            for (int i = 0; i < validSamples; i++) {
                double diff = irBuffer[i] - mean;
                sqSum += diff * diff;
            }
            double stdDev = sqrt(sqSum / validSamples);

            double threshold = mean + BEAT_THRESHOLD_K * stdDev;

            // Check if finger is present (IR > 50000)
            if (irValue < 50000) continue;

            // Beat detection: current value crosses threshold going up
            unsigned long now = millis();
            if (irValue > threshold && (now - lastBeatTime) > BEAT_MIN_INTERVAL_MS) {
                // Compute BPM from last two beats
                if (lastBeatTime > 0) {
                    lastBeatInterval = now - lastBeatTime;
                    currentBPM = 60000.0f / lastBeatInterval;
                    // Clamp to physiological range
                    if (currentBPM >= 40.0f && currentBPM <= 200.0f) {
                        beatDetected = true;
                    }
                }
                lastBeatTime = now;
            }
        }
    }

    bool hasBeat() const { return beatDetected; }
    float getBPM() const { return currentBPM; }
    unsigned long getLastBeatInterval() const { return lastBeatInterval; }

private:
    MAX30105 sensor;
    Timer sampleTimer;

    long irBuffer[SENSOR_BUFFER_SIZE];
    int bufferIndex;
    bool bufferFull;

    bool beatDetected;
    unsigned long lastBeatTime;
    float currentBPM;
    unsigned long lastBeatInterval;
};

#endif // SENSOR_PROCESS_H
