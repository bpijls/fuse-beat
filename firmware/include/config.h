#ifndef CONFIG_H
#define CONFIG_H

#define LED_PIN         6
#define LED_COUNT       1
#define BUTTON_PIN      7
#define SERIAL_BAUD_RATE 115200
#define SETUP_DELAY     500

// MAX30102 I2C pins for ESP32-C3 (default I2C)
#define SDA_PIN         8
#define SCL_PIN         9

// Sensor settings
#define SENSOR_SAMPLE_RATE   100    // Hz
#define SENSOR_BUFFER_SIZE   100    // samples
#define BEAT_MIN_INTERVAL_MS 300    // min ms between beats (200 BPM max)
#define BEAT_THRESHOLD_K     1.5f   // multiplier above mean for beat detection

#endif // CONFIG_H
