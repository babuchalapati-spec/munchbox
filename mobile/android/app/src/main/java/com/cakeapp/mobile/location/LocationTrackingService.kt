package com.cakeapp.mobile.location

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.location.Location
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.cakeapp.mobile.MainActivity
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

// Foreground service that keeps sending the delivery partner's GPS position to the backend
// while an order is out for delivery, even if the partner backgrounds the app or locks the
// phone. Plain JS watchPosition() (see location.js) pauses once the app leaves the
// foreground, which defeats live tracking for exactly the case that matters most.
class LocationTrackingService : Service() {

  companion object {
    const val EXTRA_ORDER_ID = "orderId"
    const val EXTRA_TOKEN = "token"
    const val EXTRA_BASE_URL = "baseUrl"
    private const val CHANNEL_ID = "live_location_tracking"
    private const val NOTIFICATION_ID = 4210
  }

  private lateinit var fusedClient: FusedLocationProviderClient
  private val executor = Executors.newSingleThreadExecutor()
  private var orderId: String? = null
  private var token: String? = null
  private var baseUrl: String? = null

  private val locationCallback = object : LocationCallback() {
    override fun onLocationResult(result: LocationResult) {
      val loc = result.lastLocation ?: return
      postLocation(loc)
    }
  }

  override fun onCreate() {
    super.onCreate()
    fusedClient = LocationServices.getFusedLocationProviderClient(this)
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    orderId = intent?.getStringExtra(EXTRA_ORDER_ID) ?: orderId
    token = intent?.getStringExtra(EXTRA_TOKEN) ?: token
    baseUrl = intent?.getStringExtra(EXTRA_BASE_URL) ?: baseUrl

    startForeground(NOTIFICATION_ID, buildNotification())
    startLocationUpdates()
    return START_STICKY
  }

  private fun buildNotification(): Notification {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val manager = getSystemService(NotificationManager::class.java)
      val channel = NotificationChannel(
        CHANNEL_ID,
        "Live delivery tracking",
        NotificationManager.IMPORTANCE_LOW
      )
      manager.createNotificationChannel(channel)
    }

    val openApp = packageManager.getLaunchIntentForPackage(packageName)
      ?: Intent(this, MainActivity::class.java)
    val pendingIntent = PendingIntent.getActivity(
      this,
      0,
      openApp,
      PendingIntent.FLAG_IMMUTABLE
    )

    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("Sharing your live location")
      .setContentText("The customer can see where you are on the map.")
      .setSmallIcon(android.R.drawable.ic_menu_mylocation)
      .setOngoing(true)
      .setContentIntent(pendingIntent)
      .build()
  }

  private fun startLocationUpdates() {
    // Same cadence as the JS watchPosition fallback (location.js) — 8s interval, 15m
    // distance filter — so tracking behaves the same whether foregrounded or not.
    val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 8000L)
      .setMinUpdateIntervalMillis(5000L)
      .setMinUpdateDistanceMeters(15f)
      .build()
    try {
      fusedClient.requestLocationUpdates(request, locationCallback, mainLooper)
    } catch (err: SecurityException) {
      // Background location permission wasn't actually granted — nothing to track.
      stopSelf()
    }
  }

  private fun postLocation(location: Location) {
    val id = orderId ?: return
    val base = baseUrl ?: return
    val authToken = token
    executor.execute {
      try {
        val url = URL("$base/orders/$id/location")
        val conn = url.openConnection() as HttpURLConnection
        conn.requestMethod = "PUT"
        conn.setRequestProperty("Content-Type", "application/json")
        if (!authToken.isNullOrEmpty()) {
          conn.setRequestProperty("Authorization", "Bearer $authToken")
        }
        conn.doOutput = true
        conn.connectTimeout = 10000
        conn.readTimeout = 10000
        val body = "{\"lat\":${location.latitude},\"lng\":${location.longitude}}"
        OutputStreamWriter(conn.outputStream).use { it.write(body) }
        conn.responseCode
        conn.disconnect()
      } catch (err: Exception) {
        // Dropped update — the next GPS fix retries; the customer just sees a slightly
        // stale "last updated" time until connectivity returns.
      }
    }
  }

  override fun onDestroy() {
    super.onDestroy()
    fusedClient.removeLocationUpdates(locationCallback)
  }

  override fun onBind(intent: Intent?): IBinder? = null
}
