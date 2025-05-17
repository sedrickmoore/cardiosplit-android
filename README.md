# CardioSplit Timer

**CardioSplit Timer** is a fully customizable interval timer for alternating between running and walking. Built in React Native with Expo, it includes visual countdowns, audio cues, vibration feedback, theme selection, persistent settings, and a lock system to prevent accidental taps.

---

## Features

* **Custom Intervals:** Set total workout time, run time, and walk time.
* **Pre-Start Countdown:** A "Ready / Set / Go" intro sequence with sound cues.
* **Live Timer:** Clearly displays current interval type and countdown.
* **Elapsed Time Tracking:** Shows both total elapsed time and run-only time.
* **Theme Customization:** Choose from multiple color themes (light, dark, and high-visibility).
* **Persistent Settings:** Remembers your last-used theme and interval settings.
* **Audio Feedback:** Beeps for interval switches and countdown warnings.
* **Vibration Cues:** Custom buzz patterns for run and walk transitions.
* **Accidental Tap Protection:** Lock/Unlock system prevents accidental presses.
* **Responsive Layout:** Smooth transitions, shadows, and color-coded backgrounds for each phase (for main theme only).

---

## Installation

```bash
git clone https://github.com/yourusername/cardio-split-timer.git
cd cardio-split-timer
npm install
expo start
```

> Make sure to install these dependencies:

```bash
expo install expo-av expo-keep-awake expo-font
```

---

## Configuration

* **Audio Files:** Beeps for run/walk countdowns and switches are stored in `/assets`.
* **Fonts:** Uses [Rajdhani](https://fonts.google.com/specimen/Rajdhani) for a bold timer look.
* **Lock Button:** Long-press for 1 second to toggle visibility of Pause/Stop buttons.

---

## Build for Android

For personal use:

```bash
eas build --platform android --profile preview
```

> To install on device, build an `.apk` instead of `.aab`

---

## What's Next

Additional features like Google Fit syncing, notification widgets, and background services will be explored in a future native (ejected) version of this app.

---

## License

MIT License

---

## Screenshots

### Home Screen
<img src="screenshots/home.png" alt="Home Screen" width="300" />

### Run Screen
<img src="screenshots/run-timer.png" alt="Run Screen" width="300" />

### Walk Screen
<img src="screenshots/walk-timer.png" alt="Walk Screen" width="300" />

### Dark Theme
<img src="screenshots/home-dark.png" alt="Dark Theme" width="300" />

### High-Visibility Theme
<img src="screenshots/home-light.png" alt="High-Visibility Theme" width="300" />