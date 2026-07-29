package com.cakeapp.mobile

import android.content.Context

// No-op twin of the debug variant (see src/debug) — release builds never need a dev server.
object DebugServerConfig {
  fun configure(context: Context) {}
}
