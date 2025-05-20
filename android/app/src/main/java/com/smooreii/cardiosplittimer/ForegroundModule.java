package com.smooreii.cardiosplittimer;

import android.content.Intent;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class ForegroundModule extends ReactContextBaseJavaModule {
    private static ReactApplicationContext reactContext;

    ForegroundModule(ReactApplicationContext context) {
        super(context);
        reactContext = context;
    }

    @Override
    public String getName() {
        return "ForegroundModule";
    }

    @ReactMethod
    public void startService() {
        Intent serviceIntent = new Intent(reactContext, ForegroundService.class);
        reactContext.startForegroundService(serviceIntent);
    }

    @ReactMethod
    public void stopService() {
        Intent serviceIntent = new Intent(reactContext, ForegroundService.class);
        reactContext.stopService(serviceIntent);
    }
}