package com.cakeapp.mobile

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   *
   * The value comes from the product flavor (BuildConfig.FLAVOR), so the same Kotlin builds four
   * apps: MunchboxCustomer, MunchboxPartner, MunchboxShop, MunchboxAdmin. This must NOT read a
   * resValue via getString()/getResources() — ReactActivity's constructor calls
   * createReactActivityDelegate() (see below) before Android attaches this Activity's Context,
   * so any Context-dependent call here throws a NullPointerException on every launch.
   * BuildConfig.FLAVOR is a compile-time constant and safe to read this early.
   */
  override fun getMainComponentName(): String = when (BuildConfig.FLAVOR) {
    "customer" -> "MunchboxCustomer"
    "partner" -> "MunchboxPartner"
    "shop" -> "MunchboxShop"
    "admin" -> "MunchboxAdmin"
    else -> "MunchboxCustomer"
  }

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
