import React, { useState, useEffect, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Vibration,
  TouchableOpacity,
} from "react-native";
import { Audio } from "expo-av";
import {
  useKeepAwake,
  activateKeepAwakeAsync,
  deactivateKeepAwake,
} from "expo-keep-awake";
import { MaterialIcons } from "@expo/vector-icons";
import * as Font from "expo-font";
import { mainTheme, blackTheme, whiteTheme } from "./utils/themes";

export default function App() {
  const [totalTime, setTotalTime] = useState(""); // minutes
  const [runTime, setRunTime] = useState(""); // minutes
  const [walkTime, setWalkTime] = useState(""); // minutes
  const [currentInterval, setCurrentInterval] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [runElapsedTime, setRunElapsedTime] = useState(0); // NEW STATE for total run time
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isPrepping, setIsPrepping] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [theme, setTheme] = useState(mainTheme);
  const [isThemeLoaded, setIsThemeLoaded] = useState(false);
  const intervalRef = useRef(null);
  const countdownTimersRef = useRef([]);
  const currentIntervalIndex = useRef(0);

  const isPausedRef = useRef(isPaused);
  const currentIntervalRef = useRef(null);
  // Load stored settings for theme and timer values
  useEffect(() => {
    const loadStoredValues = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem("selectedTheme");
        if (savedTheme === "black") setTheme(blackTheme);
        else if (savedTheme === "white") setTheme(whiteTheme);
        else if (savedTheme === "maroon") setTheme(mainTheme);
        else setTheme(mainTheme);

        const savedTotal = await AsyncStorage.getItem("lastTotalTime");
        const savedRun = await AsyncStorage.getItem("lastRunTime");
        const savedWalk = await AsyncStorage.getItem("lastWalkTime");

        if (savedTotal) setTotalTime(savedTotal);
        if (savedRun) setRunTime(savedRun);
        if (savedWalk) setWalkTime(savedWalk);
      } catch (e) {
        console.log("Error loading saved values:", e);
      }
      setIsThemeLoaded(true);
    };
    loadStoredValues();
  }, []);

  // Save theme selection
  const saveTheme = async (themeName) => {
    try {
      await AsyncStorage.setItem("selectedTheme", themeName);
    } catch (e) {}
  };

  // Save timer values
  const saveTimeSettings = async () => {
    try {
      await AsyncStorage.setItem("lastTotalTime", totalTime);
      await AsyncStorage.setItem("lastRunTime", runTime);
      await AsyncStorage.setItem("lastWalkTime", walkTime);
    } catch (e) {}
  };

  // Load transition sound
  const soundRef = useRef(null);
  const silentAudio = useRef(null);

  const beep1 = require("./assets/beep1.mp3"); // switch to run
  const beep2 = require("./assets/beep2.mp3"); // countdown from walk
  const beep3 = require("./assets/beep3.mp3"); // switch to walk
  const beep4 = require("./assets/beep4.mp3"); // countdown from run

  const [fontsLoaded] = Font.useFonts({
    Rajdhani: require("./assets/fonts/Rajdhani-Regular.ttf"),
    RajdhaniBold: require("./assets/fonts/Rajdhani-Bold.ttf"),
  });

  useEffect(() => {
    if (isRunning) {
      activateKeepAwakeAsync();
    } else {
      deactivateKeepAwake();
    }
  }, [isRunning]);

  useEffect(() => {
    return soundRef.current
      ? () => {
          soundRef.current.unloadAsync();
        }
      : undefined;
  }, []);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    currentIntervalRef.current = currentInterval;
  }, [currentInterval]);

  const playSound = async (soundFile) => {
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    const { sound } = await Audio.Sound.createAsync(soundFile);
    soundRef.current = sound;
    await sound.playAsync();
  };

  const startSilentAudio = async () => {
    const { sound } = await Audio.Sound.createAsync(
      require("./assets/silence.mp3"),
      {
        isLooping: true,
        shouldPlay: true,
        volume: 0.0,
      }
    );
    silentAudio.current = sound;
    await sound.playAsync();
  };

  const stopSilentAudio = async () => {
    if (silentAudio.current) {
      await silentAudio.current.unloadAsync();
      silentAudio.current = null;
    }
  };

  const buildIntervals = (total, run, walk) => {
    const totalSeconds = total * 60;
    const runSeconds = run * 60;
    const walkSeconds = walk * 60;

    const intervals = [];
    let timeRemaining = totalSeconds;

    while (timeRemaining >= runSeconds + walkSeconds) {
      intervals.push({ type: "Run", duration: runSeconds });
      intervals.push({ type: "Walk", duration: walkSeconds });
      timeRemaining -= runSeconds + walkSeconds;
    }

    if (timeRemaining >= runSeconds) {
      intervals.push({ type: "Run", duration: runSeconds });
      timeRemaining -= runSeconds;
    }
    if (timeRemaining > 0) {
      intervals.push({ type: "Walk", duration: timeRemaining });
    }

    return intervals;
  };

  const preStartCountdown = () => {
    setIsPrepping(true);
    setCurrentInterval({ type: "Ready", duration: 1 });
    setSecondsLeft(3);
    playSound(beep2);

    setTimeout(() => {
      setCurrentInterval({ type: "Set", duration: 1 });
      setSecondsLeft(2);
      playSound(beep2);
    }, 1000);

    setTimeout(() => {
      setCurrentInterval({ type: "Go", duration: 1 });
      setSecondsLeft(1);
      playSound(beep2);
    }, 2000);

    setTimeout(() => {
      setIsPrepping(false);
      startSilentAudio();
      startMainTimer();
      playSound(beep1);
    }, 3000);
  };

  const startTimer = () => {
    if (isRunning || isPrepping) return; // prevent duplicate timers

    // Input validation
    if (!totalTime || !runTime || !walkTime) {
      alert("Please fill out all time fields before starting the timer.");
      return;
    }

    saveTimeSettings();
    preStartCountdown();
    setShowMenu(false);
  };

  const startMainTimer = () => {
    const intervals = buildIntervals(
      Number(totalTime),
      Number(runTime),
      Number(walkTime)
    );
    currentIntervalIndex.current = 0;
    setIsRunning(true);

    const runInterval = () => {
      if (currentIntervalIndex.current >= intervals.length) {
        clearInterval(intervalRef.current);
        setCurrentInterval({ type: "Done", duration: 0 });
        setIsRunning(false);
        return;
      }

      const { type, duration } = intervals[currentIntervalIndex.current];
      setCurrentInterval({ type, duration });
      currentIntervalRef.current = { type, duration };

      // Trigger vibration immediately for new interval
      if (type === "Run") {
        Vibration.vibrate([0, 500, 0, 500]); // single long buzz for run
      } else if (type === "Walk") {
        Vibration.vibrate([0, 300, 100, 300]); // double buzz for walk
      }

      setSecondsLeft(Math.round(duration));
    };

    runInterval();

    intervalRef.current = setInterval(() => {
      if (isPausedRef.current) return;

      setSecondsLeft((prev) => {
        const newTime = prev - 1;

        if (newTime <= 0) {
          const nextType = intervals[currentIntervalIndex.current + 1]?.type;
          if (nextType === "Run") {
            playSound(beep1);
          } else if (nextType === "Walk") {
            playSound(beep3);
          }
          currentIntervalIndex.current++;
          runInterval();
        } else {
          // Countdown warning
          if (newTime === 3 || newTime === 2 || newTime === 1) {
            const countdownBeep =
              currentIntervalRef.current?.type === "Run" ? beep4 : beep2;
            playSound(countdownBeep);
          }
        }

        return newTime;
      });
      // INCREMENT elapsedTime always, and runElapsedTime only during "Run"
      setElapsedTime((et) => et + 1);
      if (currentIntervalRef.current?.type === "Run") {
        setRunElapsedTime((rt) => rt + 1);
      }
    }, 1000);
  };

  const resetTimer = () => {
    clearInterval(intervalRef.current);
    countdownTimersRef.current.forEach(clearTimeout);
    // Ensure any playing sound is unloaded
    (() => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().then(() => {
          soundRef.current = null;
        });
      }
    })();
    stopSilentAudio();
    setIsRunning(false);
    setIsPaused(false);
    setIsPrepping(false);
    setSecondsLeft(0);
    setElapsedTime(0);
    setRunElapsedTime(0);
    setCurrentInterval(null);
    currentIntervalIndex.current = 0;
  };

  if (!isThemeLoaded || !fontsLoaded) {
    return null;
  }

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: !isRunning && !isPrepping ? 80 : 0,
          backgroundColor:
            isPaused || !isRunning
              ? theme.mainBG
              : currentInterval?.type === "Run"
              ? theme.runBG
              : theme.walkBG,
        },
      ]}
    >
      {!isRunning && !isPrepping && (
        <>
          <TouchableOpacity
            onPress={() => setShowMenu(!showMenu)}
            style={{
              position: "absolute",
              top: 50,
              left: 20,
              zIndex: 999,
            }}
          >
            <MaterialIcons name="menu" size={48} color={theme.iconMenu} />
          </TouchableOpacity>
          {showMenu && (
            <View
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: 0,
                right: 0,
                elevation: 10,
                zIndex: 999,
                backgroundColor: "rgba(0,0,0,.85)",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <TouchableOpacity
                style={StyleSheet.absoluteFillObject}
                activeOpacity={1}
                onPressOut={() => setShowMenu(false)}
              />
              <View
                style={{
                  width: "90%",
                  backgroundColor: theme.inputContainerBG,
                  padding: 20,
                  paddingBottom: 38,
                  borderRadius: 12,
                  shadowColor: "#000",
                  shadowOpacity: 0.2,
                  shadowRadius: 10,
                  elevation: 10,
                  gap: 22
                }}
              >
                <Text
                  style={{
                    fontFamily: theme.text,
                    fontSize: 48,
                    marginBottom: 10,
                    color: theme.labelText,
                  }}
                >
                  Select Theme
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setTheme(mainTheme);
                    saveTheme("maroon");
                  }}
                  style={{
                    borderWidth: 4,
                    borderColor: theme.labelText,
                    borderRadius: 8,
                    padding: 12,
                    marginBottom: 10,
                    shadowColor: "#000",
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                    shadowOffset: { width: 0, height: 2 },
                    elevation: 3,
                    backgroundColor: theme.inputContainerBG,
                  }}
                >
                  <Text style={{ fontSize: 40, color: theme.labelText, fontFamily: theme.text }}>
                    Main Theme
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setTheme(blackTheme);
                    saveTheme("black");
                  }}
                  style={{
                    borderWidth: 4,
                    borderColor: theme.labelText,
                    borderRadius: 8,
                    padding: 12,
                    marginBottom: 10,
                    shadowColor: "#000",
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                    shadowOffset: { width: 0, height: 2 },
                    elevation: 3,
                    backgroundColor: theme.inputContainerBG,
                  }}
                >
                  <Text style={{ fontSize: 40, color: theme.labelText, fontFamily: theme.text }}>
                    Dark Mode
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setTheme(whiteTheme);
                    saveTheme("white");
                  }}
                  style={{
                    borderWidth: 4,
                    borderColor: theme.labelText,
                    borderRadius: 8,
                    padding: 12,
                    marginBottom: 0,
                    shadowColor: "#000",
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                    shadowOffset: { width: 0, height: 2 },
                    elevation: 3,
                    backgroundColor: theme.inputContainerBG,
                  }}
                >
                  <Text style={{ fontSize: 40, color: theme.labelText, fontFamily: theme.text }}>
                    High Visibility
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          <View style={[styles.inputContainer, { backgroundColor: theme.inputContainerBG }]}>
            <Text style={[styles.label, { color: theme.labelText, fontFamily: theme.text }]}>Total Time (min)</Text>
            <TextInput
              style={[styles.input, {
                backgroundColor: theme.inputBG,
                borderColor: theme.inputBorder,
                fontFamily: theme.text,
                color:theme.inputText
              }]}
              value={totalTime}
              onChangeText={setTotalTime}
              keyboardType="numeric"
            />

            <Text style={[styles.label, { color: theme.labelText, fontFamily: theme.text }]}>Run Time (min)</Text>
            <TextInput
              style={[styles.input, {
                backgroundColor: theme.inputBG,
                borderColor: theme.inputBorder,
                fontFamily: theme.text,
                color:theme.inputText
              }]}
              value={runTime}
              onChangeText={setRunTime}
              keyboardType="numeric"
            />

            <Text style={[styles.label, { color: theme.labelText, fontFamily: theme.text }]}>Walk Time (min)</Text>
            <TextInput
              style={[styles.input, {
                backgroundColor: theme.inputBG,
                borderColor: theme.inputBorder,
                fontFamily: theme.text,
                color:theme.inputText
              }]}
              value={walkTime}
              onChangeText={setWalkTime}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.centerContent}>
            <TouchableOpacity
              style={[
                styles.startButton,
                {
                  backgroundColor: theme.startButtonBG,
                  shadowColor: theme.buttonShadowColor,
                  shadowOpacity: theme.buttonShadowOpacity,
                  shadowRadius: theme.buttonShadowRadius,
                  shadowOffset: theme.buttonShadowOffset,
                  elevation: theme.buttonElevation,
                },
              ]}
              onPress={startTimer}
            >
              <MaterialIcons name="play-arrow" size={64} color={theme.iconStart} />
            </TouchableOpacity>
          </View>
        </>
      )}

      {(isRunning || isPrepping) && currentInterval && (
        <View style={styles.timerView}>
          <Text style={[styles.phaseText, { fontFamily: theme.text, color: theme.textColor }]}>{currentInterval.type}</Text>
          {!isPrepping && (
            <Text style={[styles.timeText, { fontFamily: theme.text, color: theme.textColor }]}>
              {Math.floor(secondsLeft / 60)}:
              {(secondsLeft % 60).toString().padStart(2, "0")}
            </Text>
          )}
        </View>
      )}

      {isRunning && (
        <View style={styles.controlButtonsContainer}>
          <TouchableOpacity
            style={[
              styles.controlButton,
              {
                backgroundColor: theme.pauseButtonBG,
                shadowColor: theme.buttonShadowColor,
                shadowOpacity: theme.buttonShadowOpacity,
                shadowRadius: theme.buttonShadowRadius,
                shadowOffset: theme.buttonShadowOffset,
                elevation: theme.buttonElevation,
                marginBottom: 30,
                opacity: isLocked ? 0.3 : 1,
              },
            ]}
            onPress={() => !isLocked && setIsPaused(!isPaused)}
            disabled={isLocked}
          >
            <MaterialIcons
              name={isPaused ? "play-arrow" : "pause"}
              size={64}
              color={theme.iconPause}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.controlButton,
              {
                backgroundColor: theme.stopButtonBG,
                shadowColor: theme.buttonShadowColor,
                shadowOpacity: theme.buttonShadowOpacity,
                shadowRadius: theme.buttonShadowRadius,
                shadowOffset: theme.buttonShadowOffset,
                elevation: theme.buttonElevation,
                marginBottom: 30,
                opacity: isLocked ? 0.3 : 1,
              },
            ]}
            onPress={() => !isLocked && resetTimer()}
            disabled={isLocked}
          >
            <MaterialIcons name="stop" size={64} color={theme.iconStop} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.controlButton,
              {
                backgroundColor: theme.lockButtonBG,
                shadowColor: theme.buttonShadowColor,
                shadowOpacity: theme.buttonShadowOpacity,
                shadowRadius: theme.buttonShadowRadius,
                shadowOffset: theme.buttonShadowOffset,
                elevation: theme.buttonElevation,
              },
            ]}
            onLongPress={() => setIsLocked(!isLocked)}
            delayLongPress={1000}
          >
            <MaterialIcons
              name={isLocked ? "lock" : "lock-open"}
              size={48}
              color={theme.iconLock}
            />
          </TouchableOpacity>
          <Text style={[styles.elapsedText, { color: theme.textColor, fontFamily: theme.text, }]}>
            {Math.floor(runElapsedTime / 60)}:{(runElapsedTime % 60).toString().padStart(2, "0")} / {Math.floor(elapsedTime / 60)}:
            {(elapsedTime % 60).toString().padStart(2, "0")}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 0,
    paddingHorizontal: 20,
    flex: 1,
    alignItems: "center",
  },
  label: {
    fontSize: 42,
    marginTop: 10,
    marginBottom: 15,
    textAlign: "center",
  },
  inputContainer: {
    padding: 20,
    borderRadius: 16,
    marginTop: 40,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    width: "100%",
    alignSelf: "center",
    alignItems: "center",
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    fontSize: 42,
    marginBottom: 15,
    width: 180,
    textAlign: "center",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  timerView: {
    alignItems: "center",
    marginTop: 100,
  },
  phaseText: {
    fontSize: 72,
  },
  timeText: {
    fontSize: 72,
    marginTop: 20,
  },
  elapsedText: {
    fontSize: 72,
  },
  startButton: {
    width: "100%",
    height: 125,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  controlButtonsContainer: {
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    gap: 30,
    marginTop: 60,
    width: "100%",
  },
  controlButton: {
    width: "100%",
    height: 125,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  pauseButton: {
  },
  stopButton: {
  },
  controlButtonText: {
    fontSize: 18,
  },
});
