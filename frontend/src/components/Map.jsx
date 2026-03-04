import React, { useEffect, useRef, forwardRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Define custom icons for different states
const trackingIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  iconRetinaUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const idleIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
  iconRetinaUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const defaultIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Component to control map view and zoom
function ChangeView({ lat, lng, isTracking }) {
  const map = useMap();

  useEffect(() => {
    // Only update view when tracking is active or coordinates change significantly
    if (isTracking && lat !== 0 && lng !== 0) {
      map.setView([lat, lng], 15, { animate: true });
    } else if ((lat !== 0 || lng !== 0) && !isTracking) {
      // If not tracking, only update if we don't have a view yet
      if (map.getZoom() < 3) {
        map.setView([lat, lng], 13, { animate: true });
      }
    }
  }, [lat, lng, isTracking, map]);

  return null;
}

const Map = forwardRef(({ latitude, longitude, isTracking, isMobile, selectedHistory, playbackIndex }, ref) => {
  const internalMapRef = useRef();

  // Forward the internal ref to the parent
  React.useImperativeHandle(ref, () => ({
    getMap: () => internalMapRef.current
  }));

  const position = [latitude, longitude];

  // Choose marker icon based on tracking state
  let markerIcon = defaultIcon;
  if (isTracking && latitude !== 0 && longitude !== 0) {
    markerIcon = trackingIcon;
  } else if (!isTracking && latitude !== 0 && longitude !== 0) {
    markerIcon = idleIcon;
  }

  // Filter locations based on playbackIndex
  const visibleLocations = selectedHistory && selectedHistory.locations && playbackIndex >= 0
    ? selectedHistory.locations.slice(0, playbackIndex + 1)
    : (selectedHistory?.locations || []);

  const playbackPoint = selectedHistory && selectedHistory.locations && playbackIndex >= 0
    ? selectedHistory.locations[playbackIndex]
    : null;

  return (
    <MapContainer
      center={position}
      zoom={isTracking ? 15 : 13}
      style={{ height: '100%', width: '100%' }}
      ref={internalMapRef}
    >
      <TileLayer
        attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ChangeView 
        lat={playbackPoint ? playbackPoint.latitude : latitude} 
        lng={playbackPoint ? playbackPoint.longitude : longitude} 
        isTracking={isTracking || !!playbackPoint} 
      />
      
      {/* Display tracking history as lines if available */}
      {visibleLocations.length > 0 && (
        <Polyline
          positions={visibleLocations.map(loc => [loc.latitude, loc.longitude])}
          color="#bb86fc"
          weight={4}
          opacity={0.8}
        />
      )}
      
      {/* Display a specific marker for the playback point */}
      {playbackPoint && (
        <Marker position={[playbackPoint.latitude, playbackPoint.longitude]} icon={trackingIcon}>
          <Popup>
            {isTracking ? 'Current Position' : 'Playback Point'}: <br />
            Time: {new Date(playbackPoint.timestamp).toLocaleString()} <br />
            Point: {playbackIndex + 1} of {selectedHistory.locations.length}
          </Popup>
        </Marker>
      )}

      {/* Show live marker if it's different from playback point or we're just tracking */}
      {isTracking && latitude !== 0 && longitude !== 0 && (!playbackPoint || (Math.abs(playbackPoint.latitude - latitude) > 0.00001 || Math.abs(playbackPoint.longitude - longitude) > 0.00001)) && (
        <Marker position={position} icon={trackingIcon}>
          <Popup>
            Live Position (latest): <br />
            Latitude: {Number(latitude).toFixed(6)}, Longitude: {Number(longitude).toFixed(6)}
          </Popup>
        </Marker>
      )}

      {/* Show other points as smaller markers if not too many */}
      {visibleLocations.length > 0 && visibleLocations.length < 100 && visibleLocations.map((loc, index) => (
        index !== playbackIndex && (
          <Marker 
            key={index} 
            position={[loc.latitude, loc.longitude]} 
            icon={new L.DivIcon({
              className: 'custom-div-icon',
              html: `<div style="background-color: #bb86fc; width: 8px; height: 8px; border-radius: 50%; border: 1px solid white;"></div>`,
              iconSize: [8, 8],
              iconAnchor: [4, 4]
            })}
          >
            <Popup>
              Point {index + 1} <br />
              Time: {new Date(loc.timestamp).toLocaleString()}
            </Popup>
          </Marker>
        )
      ))}
      
      {(!isTracking && !selectedHistory && latitude !== 0 && longitude !== 0) && (
        <Marker position={position} icon={markerIcon}>
          <Popup>
            Last Known Location: <br />
            Latitude: {Number(latitude).toFixed(6)}, Longitude: {Number(longitude).toFixed(6)}
          </Popup>
        </Marker>
      )}
    </MapContainer>
  );
});

export default Map;