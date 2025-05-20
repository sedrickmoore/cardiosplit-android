package com.smooreii.cardiosplittimer;

import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import android.util.Log;


public class StepCounterModule extends ReactContextBaseJavaModule implements SensorEventListener {

    private SensorManager sensorManager;
    private Sensor stepSensor;
    private ReactApplicationContext reactContext;

    public StepCounterModule(ReactApplicationContext context) {
        super(context);
        this.reactContext = context;
        sensorManager = (SensorManager) context.getSystemService(Context.SENSOR_SERVICE);
        if (sensorManager != null) {
            stepSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
            if (stepSensor != null) {
            Log.d("StepCounterModule", "Step counter sensor found and registered.");
            } else {
                Log.e("StepCounterModule", "No step counter sensor available.");
            }
        }
    }

    @NonNull
    @Override
    public String getName() {
        return "StepCounterModule";
    }

    @ReactMethod
    public void startStepTracking() {
        if (stepSensor != null) {
            sensorManager.registerListener(this, stepSensor, SensorManager.SENSOR_DELAY_UI);
        }
        Log.d("StepCounterModule", "startStepTracking() called");
    }

    @ReactMethod
    public void stopStepTracking() {
        sensorManager.unregisterListener(this);
    }

    @ReactMethod
    public void addListener(String eventName) {
    // Required for RN built-in Event Emitter calls.
    }

    @ReactMethod
    public void removeListeners(Integer count) {
    // Required for RN built-in Event Emitter calls.
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        float steps = event.values[0];
        sendEvent("StepCounterUpdate", steps);
        Log.d("StepCounterModule", "Steps: " + steps);
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        // Not used
    }

    private void sendEvent(String eventName, float stepCount) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
            .emit(eventName, stepCount);
    }
}