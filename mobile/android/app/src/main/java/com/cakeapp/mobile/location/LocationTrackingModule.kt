package com.cakeapp.mobile.location

import android.content.Intent
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

// JS bridge for the Partner app to start/stop the background live-tracking foreground
// service. See nativeLocationTracking.js for the JS-side wrapper.
class LocationTrackingModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName() = "LocationTrackingModule"

  @ReactMethod
  fun startTracking(orderId: String, token: String, baseUrl: String) {
    val context = reactApplicationContext
    val intent = Intent(context, LocationTrackingService::class.java).apply {
      putExtra(LocationTrackingService.EXTRA_ORDER_ID, orderId)
      putExtra(LocationTrackingService.EXTRA_TOKEN, token)
      putExtra(LocationTrackingService.EXTRA_BASE_URL, baseUrl)
    }
    ContextCompat.startForegroundService(context, intent)
  }

  @ReactMethod
  fun stopTracking() {
    val context = reactApplicationContext
    context.stopService(Intent(context, LocationTrackingService::class.java))
  }
}
