import React, { useEffect, useRef, forwardRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
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

const Map = forwardRef(({ latitude, longitude, isTracking, isMobile }, ref) => {
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

  return (
    <MapContainer
      center={position}
      zoom={isTracking ? 15 : 13}
      style={{ height: '100%', width: '100%' }}
      ref={internalMapRef}
      whenCreated={(map) => {
        // For dark theme, we just keep the default OpenStreetMap tiles
        // but we could add a dark tile provider if needed
      }}
    >
      <TileLayer
        attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        // For dark theme: url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      <ChangeView lat={latitude} lng={longitude} isTracking={isTracking} />
      {(latitude !== 0 && longitude !== 0) && (
        <Marker position={position} icon={markerIcon}>
          <Popup>
            Device Location: <br />
            Latitude: {Number(latitude).toFixed(6)}, Longitude: {Number(longitude).toFixed(6)} <br />
            Status: {isTracking ? 'Tracking Active' : 'Location Stored'}
          </Popup>
        </Marker>
      )}
    </MapContainer>
  );
});

export default Map;