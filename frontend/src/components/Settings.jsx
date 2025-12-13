import React, { useState, useEffect } from 'react';

function Settings({ settings, onSave }) {
  const [haUrl, setHaUrl] = useState(settings.haUrl);
  const [haToken, setHaToken] = useState(settings.haToken);
  const [haDeviceId, setHaDeviceId] = useState(settings.haDeviceId);
  const [trackingInterval, setTrackingInterval] = useState(settings.trackingInterval);

  useEffect(() => {
    setHaUrl(settings.haUrl);
    setHaToken(settings.haToken);
    setHaDeviceId(settings.haDeviceId);
    setTrackingInterval(settings.trackingInterval);
  }, [settings]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ haUrl, haToken, haDeviceId, trackingInterval: Number(trackingInterval) });
  };

  return (
    <div>
      <h2>Settings</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '10px' }}>
          <label htmlFor="haUrl">Home Assistant URL:</label>
          <input
            type="text"
            id="haUrl"
            value={haUrl}
            onChange={(e) => setHaUrl(e.target.value)}
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <label htmlFor="haToken">Home Assistant Long-Lived Access Token:</label>
          <input
            type="password"
            id="haToken"
            value={haToken}
            onChange={(e) => setHaToken(e.target.value)}
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <label htmlFor="haDeviceId">Home Assistant Device ID (e.g., person.your_name):</label>
          <input
            type="text"
            id="haDeviceId"
            value={haDeviceId}
            onChange={(e) => setHaDeviceId(e.target.value)}
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <label htmlFor="trackingInterval">Tracking Interval (seconds):</label>
          <input
            type="number"
            id="trackingInterval"
            value={trackingInterval}
            onChange={(e) => setTrackingInterval(e.target.value)}
            min="5"
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
        </div>
        <button type="submit">Save Settings</button>
      </form>
    </div>
  );
}

export default Settings;