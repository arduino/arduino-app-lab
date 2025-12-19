#include <Arduino.h>

void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  delay(1000); // Wait for 1 second.

  digitalWrite(LED_BUILTIN, LOW);
  delay(1000); // Wait for 1 second.
}
