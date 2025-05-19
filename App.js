import React, { useState, useEffect, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Vibration,
  TouchableOpacity,
  ScrollView,
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
import { StatusBar } from "react-native";

import { NativeModules } from "react-native";
const { ForegroundModule } = NativeModules;
import BackgroundTimer from "react-native-background-timer";

import { DeviceEventEmitter } from "react-native";

import * as Location from "expo-location";
import { getDistance } from "geolib";

const { StepCounterModule } = NativeModules;

import { PermissionsAndroid, Platform } from "react-native";

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
  const [sessionComplete, setSessionComplete] = useState(false); // NEW STATE for post-session summary
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);
  const intervalRef = useRef(null);
  const countdownTimersRef = useRef([]);
  const currentIntervalIndex = useRef(0);

  const isPausedRef = useRef(isPaused);
  const currentIntervalRef = useRef(null);
  const runDistance = useRef(0);
  const walkDistance = useRef(0);
  const previousLocation = useRef(null);
  const [stepCount, setStepCount] = useState(0);
  const stepListener = useRef(null);
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
    try {
      const { sound } = await Audio.Sound.createAsync(soundFile, {
        shouldPlay: true,
        staysActiveInBackground: true,
        isLooping: false,
      });

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          sound.unloadAsync();
        }
      });
    } catch (error) {
      console.warn("Playback error:", error);
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

    // New logic for remaining time:
    if (timeRemaining >= runSeconds + walkSeconds) {
      // already handled by while loop
    } else if (timeRemaining >= runSeconds) {
      intervals.push({ type: "Run", duration: runSeconds });
      timeRemaining -= runSeconds;
      if (timeRemaining > 0) {
        intervals.push({ type: "Walk", duration: timeRemaining });
      }
    } else if (timeRemaining > 0) {
      intervals.push({ type: "Run", duration: timeRemaining });
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

  const requestActivityRecognitionPermission = async () => {
    if (Platform.OS === "android" && Platform.Version >= 29) {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION,
          {
            title: "Activity Recognition Permission",
            message:
              "App needs access to your physical activity to track steps.",
            buttonNeutral: "Ask Me Later",
            buttonNegative: "Cancel",
            buttonPositive: "OK",
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true;
  };

  const startMainTimer = async () => {
    // Request location permissions first
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      alert("Permission to access location was denied");
      return;
    }
    const hasPermission = await requestActivityRecognitionPermission();
    if (!hasPermission) {
      alert("Permission to access physical activity was denied");
      return;
    }

    const intervals = buildIntervals(
      Number(totalTime),
      Number(runTime),
      Number(walkTime)
    );
    currentIntervalIndex.current = 0;
    // Save session start time
    const startTimestamp = new Date();
    setStartTime(startTimestamp);
    setIsRunning(true);
    
    StepCounterModule.startStepTracking();
    stepListener.current = DeviceEventEmitter.addListener(
      "StepCounterUpdate",
      (count) => {
        if (typeof count === "number") {
          setStepCount(Math.round(count));
        } else if (count && typeof count.value === "number") {
          setStepCount(Math.round(count.value));
        } else {
          console.warn("Unexpected step count payload:", count);
        }
      }
    );
    ForegroundModule.startService();

    Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 1000,
        distanceInterval: 1,
      },
      (location) => {
        const { latitude, longitude } = location.coords;
        if (previousLocation.current) {
          const delta = getDistance(previousLocation.current, {
            latitude,
            longitude,
          });
          if (currentIntervalRef.current?.type === "Run") {
            runDistance.current += delta;
          } else if (currentIntervalRef.current?.type === "Walk") {
            walkDistance.current += delta;
          }
        }
        previousLocation.current = { latitude, longitude };
      }
    );

    const runInterval = () => {
      if (currentIntervalIndex.current >= intervals.length) {
        // Save end time when session completes
        setEndTime(new Date());
        BackgroundTimer.clearInterval(intervalRef.current); // FIXED
        intervalRef.current = null;
        ForegroundModule.stopService();
        setIsRunning(false);
        setIsPaused(false);
        setIsPrepping(false);
        setSecondsLeft(0);
        setCurrentInterval({ type: "Done", duration: 0 });
        setSessionComplete(true);
        currentIntervalIndex.current = 0;
        return;
      }

      const { type, duration } = intervals[currentIntervalIndex.current];
      setCurrentInterval({ type, duration });
      currentIntervalRef.current = { type, duration };
      previousLocation.current = null;

      // Trigger vibration immediately for new interval
      if (type === "Run") {
        Vibration.vibrate([0, 500, 0, 500]); // single long buzz for run
      } else if (type === "Walk") {
        Vibration.vibrate([0, 300, 100, 300]); // double buzz for walk
      }

      setSecondsLeft(Math.round(duration));
    };

    runInterval();

    intervalRef.current = BackgroundTimer.setInterval(() => {
      if (isPausedRef.current || sessionComplete) return;

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
          if (newTime === 3 || newTime === 2 || newTime === 1) {
            const countdownBeep =
              currentIntervalRef.current?.type === "Run" ? beep4 : beep2;
            playSound(countdownBeep);
          }
        }

        return newTime;
      });
      setElapsedTime((et) => et + 1);
      if (currentIntervalRef.current?.type === "Run") {
        setRunElapsedTime((rt) => rt + 1);
      }
    }, 1000);
  };

  const resetTimer = () => {
    if (!endTime) setEndTime(new Date());
    // Always clear interval
    BackgroundTimer.clearInterval(intervalRef.current);
    intervalRef.current = null;
    ForegroundModule.stopService();
    runDistance.current = 0;
    walkDistance.current = 0;
    previousLocation.current = null;
    // If timer is stopped mid-session (not at the end), show summary screen instead of resetting everything
    if (elapsedTime > 0 && !sessionComplete) {
      setIsRunning(false);
      setIsPaused(false);
      setIsPrepping(false);
      setCurrentInterval(null);
      setSessionComplete(true);
      return;
    }
    StepCounterModule.stopStepTracking();
    if (stepListener.current) {
      stepListener.current.remove();
      stepListener.current = null;
    }
    countdownTimersRef.current.forEach(clearTimeout);
    // Ensure any playing sound is unloaded (using expo-audio)
    (() => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().then(() => {
          soundRef.current = null;
        });
      }
    })();
    setIsRunning(false);
    setIsPaused(false);
    setIsPrepping(false);
    setSecondsLeft(0);
    setElapsedTime(0);
    setRunElapsedTime(0);
    setCurrentInterval(null);
    setSessionComplete(false); // Reset session summary state
    currentIntervalIndex.current = 0;
  };

  if (!isThemeLoaded || !fontsLoaded) {
    return null;
  }

  // Insert StatusBar at the top of the return block
  // Set dark-content for white/high visibility, light-content for dark/maroon
  // Relies on theme.name and theme.mainBG
  const statusBar = (
    <StatusBar
      barStyle={theme.statusBar === "dark" ? "dark-content" : "light-content"}
      backgroundColor={
        isPaused || !isRunning
          ? theme.mainBG
          : currentInterval?.type === "Run"
          ? theme.runBG
          : theme.walkBG
      }
    />
  );

  // Post-session summary screen
  if (sessionComplete) {
    const walkElapsedTime = elapsedTime - runElapsedTime;
    return (
      <>
        {statusBar}
        <View
          style={[
            styles.container,
            { backgroundColor: theme.mainBG, justifyContent: "center" },
          ]}
        >
          <Text
            style={[
              styles.phaseText,
              {
                fontFamily: theme.text,
                color: theme.textColor,
                textAlign: "center",
                marginBottom: 20,
                fontSize: 64,
                letterSpacing: 2,
              },
            ]}
          >
            Session Complete
          </Text>
          <ScrollView
            style={{
              maxHeight: "60%",
              width: "90%",
              alignSelf: "center",
              borderRadius: 20,
              backgroundColor: theme.inputContainerBG,
              shadowColor: "#000",
              shadowOpacity: 0.15,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 5 },
              elevation: 6,
              marginVertical: 10,
            }}
            contentContainerStyle={{ padding: 30, gap: 20 }}
          >
            <Text
              style={[
                styles.timeText,
                {
                  fontFamily: theme.text,
                  color: theme.labelText,
                  textAlign: "center",
                  fontSize: 48,
                },
              ]}
            >
              Total Time {"\n" + Math.floor(elapsedTime / 60)}:
              {(elapsedTime % 60).toString().padStart(2, "0")}
            </Text>
            <Text
              style={[
                styles.timeText,
                {
                  fontFamily: theme.text,
                  color: theme.labelText,
                  textAlign: "center",
                  fontSize: 48,
                },
              ]}
            >
              Run Time {"\n" + Math.floor(runElapsedTime / 60)}:
              {(runElapsedTime % 60).toString().padStart(2, "0")}
            </Text>
            <Text
              style={[
                styles.timeText,
                {
                  fontFamily: theme.text,
                  color: theme.labelText,
                  textAlign: "center",
                  fontSize: 48,
                },
              ]}
            >
              Walk Time {"\n" + Math.floor(walkElapsedTime / 60)}:
              {(walkElapsedTime % 60).toString().padStart(2, "0")}
            </Text>
            <Text
              style={[
                styles.timeText,
                {
                  fontFamily: theme.text,
                  color: theme.labelText,
                  textAlign: "center",
                  fontSize: 48,
                },
              ]}
            >
              Run Distance{" "}
              {"\n" + (runDistance.current * 0.000621371).toFixed(2)} mi
            </Text>
            <Text
              style={[
                styles.timeText,
                {
                  fontFamily: theme.text,
                  color: theme.labelText,
                  textAlign: "center",
                  fontSize: 48,
                },
              ]}
            >
              Walk Distance{" "}
              {"\n" + (walkDistance.current * 0.000621371).toFixed(2)} mi
            </Text>
            {(startTime || endTime) && (
              <Text
                style={[
                  styles.timeText,
                  {
                    fontFamily: theme.text,
                    color: theme.labelText,
                    textAlign: "center",
                    fontSize: 48,
                  },
                ]}
              >
                Time: {"\n"}
                {startTime
                  ? startTime.toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    })
                  : "—"}
                {" - "}
                {endTime
                  ? endTime.toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    })
                  : "—"}
              </Text>
            )}
            {/* {endTime && (
              <Text style={[styles.timeText, {
                fontFamily: theme.text,
                color: theme.labelText,
                textAlign: "center",
                fontSize: 48,
              }]}>
                Ended: {'\n'+endTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}
              </Text>
            )} */}
          </ScrollView>
          <TouchableOpacity
            style={[
              styles.startButton,
              {
                backgroundColor: theme.stopButtonBG,
                shadowColor: theme.buttonShadowColor,
                shadowOpacity: theme.buttonShadowOpacity,
                shadowRadius: theme.buttonShadowRadius,
                shadowOffset: theme.buttonShadowOffset,
                elevation: theme.buttonElevation,
                marginTop: 60,
              },
            ]}
            onPress={resetTimer}
          >
            <Text
              style={{
                fontSize: 36,
                fontFamily: theme.text,
                color: theme.iconStop,
              }}
            >
              Done
            </Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  return (
    <>
      {statusBar}
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
                    gap: 22,
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
                    <Text
                      style={{
                        fontSize: 40,
                        color: theme.labelText,
                        fontFamily: theme.text,
                      }}
                    >
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
                    <Text
                      style={{
                        fontSize: 40,
                        color: theme.labelText,
                        fontFamily: theme.text,
                      }}
                    >
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
                    <Text
                      style={{
                        fontSize: 40,
                        color: theme.labelText,
                        fontFamily: theme.text,
                      }}
                    >
                      High Visibility
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            <View
              style={[
                styles.inputContainer,
                { backgroundColor: theme.inputContainerBG },
              ]}
            >
              <Text
                style={[
                  styles.label,
                  { color: theme.labelText, fontFamily: theme.text },
                ]}
              >
                Total Time (min)
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.inputBG,
                    borderColor: theme.inputBorder,
                    fontFamily: theme.text,
                    color: theme.inputText,
                  },
                ]}
                value={totalTime}
                onChangeText={setTotalTime}
                keyboardType="numeric"
              />

              <Text
                style={[
                  styles.label,
                  { color: theme.labelText, fontFamily: theme.text },
                ]}
              >
                Run Time (min)
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.inputBG,
                    borderColor: theme.inputBorder,
                    fontFamily: theme.text,
                    color: theme.inputText,
                  },
                ]}
                value={runTime}
                onChangeText={setRunTime}
                keyboardType="numeric"
              />

              <Text
                style={[
                  styles.label,
                  { color: theme.labelText, fontFamily: theme.text },
                ]}
              >
                Walk Time (min)
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.inputBG,
                    borderColor: theme.inputBorder,
                    fontFamily: theme.text,
                    color: theme.inputText,
                  },
                ]}
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
                <MaterialIcons
                  name="play-arrow"
                  size={64}
                  color={theme.iconStart}
                />
              </TouchableOpacity>
            </View>
          </>
        )}

        {(isRunning || isPrepping) && currentInterval && (
          <View style={styles.timerView}>
            <Text
              style={[
                styles.phaseText,
                { fontFamily: theme.text, color: theme.textColor },
              ]}
            >
              {currentInterval.type}
            </Text>
            {!isPrepping && (
              <Text
                style={[
                  styles.timeText,
                  { fontFamily: theme.text, color: theme.textColor },
                ]}
              >
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
            <Text
              style={[
                styles.elapsedText,
                { color: theme.textColor, fontFamily: theme.text },
              ]}
            >
              {Math.floor(runElapsedTime / 60)}:
              {(runElapsedTime % 60).toString().padStart(2, "0")} /{" "}
              {Math.floor(elapsedTime / 60)}:
              {(elapsedTime % 60).toString().padStart(2, "0")}
            </Text>
            <Text
              style={[
                styles.elapsedText,
                { color: theme.textColor, fontFamily: theme.text },
              ]}
            >
              {stepCount}
            </Text>
          </View>
        )}
      </View>
    </>
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
  pauseButton: {},
  stopButton: {},
  controlButtonText: {
    fontSize: 18,
  },
});
