import React from 'react';
import {View, StyleSheet} from 'react-native';
import {WebView} from 'react-native-webview';

// Self-built Leaflet map (loaded from CDN inside the WebView, same technique as the
// Razorpay checkout screen) so the delivery partner shows as an actual 🛵 marker that
// moves as currentLocation updates — OpenStreetMap's plain embed.html iframe only
// supports a generic pin, no custom icon. Needs real internet access in the WebView
// (CDN + map tiles), same requirement the Razorpay checkout already has.
function buildHtml(bike, destination) {
  const bikeJson = JSON.stringify([bike.lat, bike.lng]);
  const destJson = destination?.lat != null ? JSON.stringify([destination.lat, destination.lng]) : 'null';
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
  var bike = ${bikeJson};
  var dest = ${destJson};
  var map = L.map('map', {zoomControl:false, attributionControl:false}).setView(bike, 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom:19}).addTo(map);
  var bikeIcon = L.divIcon({className:'', html:'<div style="font-size:28px;line-height:28px;transform:translate(-14px,-14px);filter:drop-shadow(0 1px 2px rgba(0,0,0,0.5));">🛵</div>', iconSize:[28,28]});
  L.marker(bike, {icon:bikeIcon}).addTo(map);
  if (dest) {
    var destIcon = L.divIcon({className:'', html:'<div style="font-size:24px;line-height:24px;transform:translate(-12px,-24px);filter:drop-shadow(0 1px 2px rgba(0,0,0,0.5));">📍</div>', iconSize:[24,24]});
    L.marker(dest, {icon:destIcon}).addTo(map);
    map.fitBounds([bike, dest], {padding:[30,30], maxZoom:16});
  }
</script>
</body>
</html>`;
}

// bike: {lat,lng} required. destination: {lat,lng} optional — when given, the map
// fits both markers so you can see the bike approaching the drop-off point.
export default function BikeMap({bike, destination, height = 200, scrollEnabled = false}) {
  if (!bike?.lat) return null;
  return (
    <View style={[styles.wrap, {height}]}>
      <WebView
        source={{html: buildHtml(bike, destination)}}
        style={styles.web}
        scrollEnabled={scrollEnabled}
        javaScriptEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {width: '100%', borderRadius: 10, overflow: 'hidden', backgroundColor: '#eee'},
  web: {flex: 1, backgroundColor: 'transparent'},
});
