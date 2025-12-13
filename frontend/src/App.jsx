import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Map from './components/Map';
import Settings from './components/Settings';

function App() {
  const [location, setLocation] = useState(null);
  const [haSettings, setHaSettings] = useState({
    haUrl: '',
    haToken: '',
    haDeviceId: '',
    trackingInterval: 15,
  });

  useEffect(() => {
    // Fetch initial settings from backend
    axios.get('http://localhost:3001/api/settings')
      .then(response => setHaSettings(response.data))
      .catch(error => console.error('Error fetching settings:', error));
  }, []);

  const handleSaveSettings = (newSettings) => {
    axios.post('http://localhost:3001/api/settings', newSettings)
      .then(response => setHaSettings(response.data))
      .catch(error => console.error('Error saving settings:', error));
  };

  const handleStartTracking = () => {
    axios.post('http://localhost:3001/api/tracking/start')
      .then(response => console.log(response.data.message))
      .catch(error => console.error('Error starting tracking:', error));
  };

  const handleStopTracking = () => {
    axios.post('http://localhost:3001/api/tracking/stop')
      .then(response => console.log(response.data.message))
      .catch(error => console.error('Error stopping tracking:', error));
  };

  // Fetch actual location data periodically
  useEffect(() => {
    let locationFetchIntervalId;

    const fetchLocation = () => {
      axios.get('http://localhost:3001/api/location')
        .then(response => {
          if (response.data && response.data.latitude && response.data.longitude) {
            setLocation(response.data);
          }
        })
        .catch(error => console.error('Error fetching location:', error));
    };

    // Start fetching location every 5 seconds (or a configurable interval)
    locationFetchIntervalId = setInterval(fetchLocation, 5000); // Fetch every 5 seconds

    return () => {
      clearInterval(locationFetchIntervalId);
    };
  }, []);


  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <div style={{ width: '30%', padding: '20px', borderRight: '1px solid #ccc' }}>
        <h1>HA Device Tracker</h1>
        <Settings settings={haSettings} onSave={handleSaveSettings} />
        <div style={{ marginTop: '20px' }}>
          <button onClick={handleStartTracking}>Start Tracking</button>
          <button onClick={handleStopTracking} style={{ marginLeft: '10px' }}>Stop Tracking</button>
        </div>
      </div>
      <div style={{ flexGrow: 1 }}>
        {location ? (
          <Map latitude={location.latitude} longitude={location.longitude} />
        ) : (
          <p>Waiting for location data...</p>
        )}
      </div>
    </div>
  );
}

export default App;