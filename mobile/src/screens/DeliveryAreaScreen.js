import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import { requestLocationPermission, getCurrentPosition } from '../location';
import { colors, cardShadow } from '../theme';

const RADIUS_OPTIONS = [2, 5, 10, 15, 25];

// Leaflet map with a draggable pin — same WebView/CDN technique as BikeMap, but
// interactive: dragging the marker reports the new position back via postMessage.
function buildHtml(center, radiusKm) {
  const centerJson = JSON.stringify([center.lat, center.lng]);
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>html,body,#map{height:100%;margin:0;padding:0;background:#eee;}</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var center = ${centerJson};
  var map = L.map('map', {zoomControl:false, attributionControl:false}).setView(center, 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom:19}).addTo(map);
  var pinIcon = L.divIcon({className:'', html:'<div style="font-size:32px;line-height:32px;transform:translate(-16px,-30px);filter:drop-shadow(0 1px 2px rgba(0,0,0,0.5));">📍</div>', iconSize:[32,32]});
  var marker = L.marker(center, {icon: pinIcon, draggable: true}).addTo(map);
  var circle = L.circle(center, {radius: ${radiusKm} * 1000, color: '#c2185b', weight: 1, fillColor: '#c2185b', fillOpacity: 0.12}).addTo(map);
  function report(latlng) {
    circle.setLatLng(latlng);
    window.ReactNativeWebView.postMessage(JSON.stringify({lat: latlng.lat, lng: latlng.lng}));
  }
  marker.on('drag', function(e) { circle.setLatLng(e.target.getLatLng()); });
  marker.on('dragend', function(e) { report(e.target.getLatLng()); });
  map.on('click', function(e) { marker.setLatLng(e.latlng); report(e.latlng); });
</script>
</body>
</html>`;
}

// Lets a delivery partner set a home base + radius so "Nearby deliveries" still shows
// orders around where they usually work even before their phone has a live GPS fix —
// see setWorkArea/listAvailableOrders on the backend for how it's used as a fallback.
export default function DeliveryAreaScreen({ navigation }) {
  const { user, refreshUser } = useAuth();
  const [center, setCenter] = useState(
    user?.workArea?.lat != null ? { lat: user.workArea.lat, lng: user.workArea.lng } : null
  );
  const [radiusKm, setRadiusKm] = useState(user?.workArea?.radiusKm || 5);
  const [loading, setLoading] = useState(!center);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (center) return;
    (async () => {
      try {
        const granted = await requestLocationPermission();
        if (granted) {
          const here = await getCurrentPosition();
          setCenter(here);
        } else {
          setCenter({ lat: 20.5937, lng: 78.9629 }); // India-wide fallback view
        }
      } catch (err) {
        setCenter({ lat: 20.5937, lng: 78.9629 });
      } finally {
        setLoading(false);
      }
    })();
  }, [center]);

  async function save() {
    if (!center) return;
    setSaving(true);
    try {
      const { data } = await client.put('/orders/work-area', { lat: center.lat, lng: center.lng, radiusKm });
      refreshUser({ ...user, workArea: data.workArea });
      Alert.alert('Saved', 'Your delivery area has been updated.');
      navigation.goBack();
    } catch (err) {
      Alert.alert('Could not save', err.response?.data?.message || 'Try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !center) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.hint}>
        Tap or drag the pin to your usual work base, then pick a radius. We'll show you deliveries around this area
        when your phone doesn't have a live location yet.
      </Text>
      <View style={styles.map}>
        <WebView
          source={{ html: buildHtml(center, radiusKm) }}
          style={{ flex: 1 }}
          javaScriptEnabled
          onMessage={(e) => {
            try {
              setCenter(JSON.parse(e.nativeEvent.data));
            } catch (err) {
              // ignore malformed message
            }
          }}
        />
      </View>
      <Text style={styles.sectionLabel}>Radius</Text>
      <View style={styles.radiusRow}>
        {RADIUS_OPTIONS.map((km) => (
          <TouchableOpacity
            key={km}
            style={[styles.radiusChip, radiusKm === km && styles.radiusChipActive]}
            onPress={() => setRadiusKm(km)}
          >
            <Text style={[styles.radiusChipText, radiusKm === km && styles.radiusChipTextActive]}>{km} km</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity style={styles.button} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save delivery area</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 17, marginBottom: 12 },
  map: { height: 320, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.border, marginBottom: 16, ...cardShadow(1) },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 8 },
  radiusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  radiusChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  radiusChipActive: { borderColor: colors.primary, backgroundColor: '#fce4ec' },
  radiusChipText: { fontSize: 13, fontWeight: '600', color: colors.muted },
  radiusChipTextActive: { color: colors.primary },
  button: { backgroundColor: colors.primary, borderRadius: 10, padding: 14, alignItems: 'center', ...cardShadow(2) },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
