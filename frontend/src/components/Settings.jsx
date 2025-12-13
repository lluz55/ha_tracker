import React, { useState, useEffect } from 'react';

function Settings({ settings, onSave, isMobile }) {
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
    <div style={{ color: '#e0e0e0', flex: 1, display: 'flex', flexDirection: 'column' }}>
      <h2 style={{ color: '#bb86fc', fontSize: '1.2rem', marginBottom: '20px' }}>Settings</h2>
      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: isMobile ? '12px' : '15px',
          flex: 1,
          overflowY: 'auto',
          paddingBottom: '10px'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: '0' }}>
          <label htmlFor="haUrl" style={{ marginBottom: '5px', fontSize: '0.9rem', color: '#aaa' }}>
            Home Assistant URL:
          </label>
          <input
            type="url"
            id="haUrl"
            value={haUrl}
            onChange={(e) => setHaUrl(e.target.value)}
            placeholder="e.g., http://homeassistant.local:8123"
            style={{
              padding: isMobile ? '14px' : '12px',
              backgroundColor: '#2d2d2d',
              border: '1px solid #444',
              borderRadius: '6px',
              color: '#e0e0e0',
              fontSize: '1rem',
              flex: 1,
              minHeight: '50px'
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: '0' }}>
          <label htmlFor="haToken" style={{ marginBottom: '5px', fontSize: '0.9rem', color: '#aaa' }}>
            Long-Lived Access Token:
          </label>
          <input
            type="password"
            id="haToken"
            value={haToken}
            onChange={(e) => setHaToken(e.target.value)}
            placeholder="Enter your HA token"
            style={{
              padding: isMobile ? '14px' : '12px',
              backgroundColor: '#2d2d2d',
              border: '1px solid #444',
              borderRadius: '6px',
              color: '#e0e0e0',
              fontSize: '1rem',
              flex: 1,
              minHeight: '50px'
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: '0' }}>
          <label htmlFor="haDeviceId" style={{ marginBottom: '5px', fontSize: '0.9rem', color: '#aaa' }}>
            Device ID (e.g., person.name, device_tracker.phone):
          </label>
          <input
            type="text"
            id="haDeviceId"
            value={haDeviceId}
            onChange={(e) => setHaDeviceId(e.target.value)}
            placeholder="e.g., person.john_doe or device_tracker.phone"
            style={{
              padding: isMobile ? '14px' : '12px',
              backgroundColor: '#2d2d2d',
              border: '1px solid #444',
              borderRadius: '6px',
              color: '#e0e0e0',
              fontSize: '1rem',
              flex: 1,
              minHeight: '50px'
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: '0' }}>
          <label htmlFor="trackingInterval" style={{ marginBottom: '5px', fontSize: '0.9rem', color: '#aaa' }}>
            Tracking Interval (seconds):
          </label>
          <input
            type="number"
            id="trackingInterval"
            value={trackingInterval}
            onChange={(e) => setTrackingInterval(e.target.value)}
            min="5"
            max="3600"
            style={{
              padding: isMobile ? '14px' : '12px',
              backgroundColor: '#2d2d2d',
              border: '1px solid #444',
              borderRadius: '6px',
              color: '#e0e0e0',
              fontSize: '1rem',
              flex: 1,
              minHeight: '50px'
            }}
          />
        </div>

        <button
          type="submit"
          style={{
            backgroundColor: '#6200ea',
            color: 'white',
            border: 'none',
            padding: isMobile ? '16px' : '12px 20px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: 'bold',
            marginTop: isMobile ? '10px' : '10px',
            minHeight: '50px'
          }}
        >
          Save Settings
        </button>
      </form>
    </div>
  );
}

export default Settings;