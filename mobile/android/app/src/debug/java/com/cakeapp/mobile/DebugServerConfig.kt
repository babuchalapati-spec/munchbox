package com.cakeapp.mobile

import android.content.Context
import android.preference.PreferenceManager

// Debug-only: pre-seeds the Metro dev server address so a sideloaded debug APK can fetch
// the JS bundle over WiFi without ADB (adb reverse isn't available on this test device).
// The release build gets a no-op twin of this file (see src/release), so the shared
// MainApplication.onCreate() call compiles for both variants without any BuildConfig checks.
object DebugServerConfig {
  fun configure(context: Context) {
    PreferenceManager.getDefaultSharedPreferences(context)
      .edit()
      .putString("debug_http_host", "192.168.1.3:8081")
      .apply()
  }
}
