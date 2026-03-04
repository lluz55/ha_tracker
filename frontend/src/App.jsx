import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Map from './components/Map';
import Settings from './components/Settings';
import Timeline from './components/Timeline';

function App() {
  const [location, setLocation] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isTrackingActive, setIsTrackingActive] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected'); // disconnected, connected, error
  const [locationFetchError, setLocationFetchError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [trackingHistories, setTrackingHistories] = useState([]);
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [playbackIndex, setPlaybackIndex] = useState(-1);

  const [haSettings, setHaSettings] = useState({
    haUrl: '',
    haToken: '',
    haDeviceId: '',
    trackingInterval: 15,
  });

  const handlePointChange = (index) => {
    setPlaybackIndex(index);
  };

  const handleHistorySelect = (history) => {
    if (selectedHistory?.id === history.id) {
      setSelectedHistory(null);
      setPlaybackIndex(-1);
    } else {
      setSelectedHistory(history);
      setPlaybackIndex(history.locations?.length - 1 || 0);
    }
  };

  useEffect(() => {
    // Fetch initial settings from backend
    axios.get('/api/settings')
      .then(response => {
        setHaSettings(response.data);
        setConnectionStatus('connected'); // Update status to connected when settings are successfully fetched
      })
      .catch(error => {
        console.error('Error fetching settings:', error);
        setConnectionStatus('error');
      });
      
    // Load tracking histories
    axios.get('/api/tracking/histories')
      .then(response => {
        setTrackingHistories(response.data);
      })
      .catch(error => {
        console.error('Error fetching tracking histories:', error);
      });
  }, []);

  const handleSaveSettings = (newSettings) => {
    axios.post('/api/settings', newSettings)
      .then(response => {
        setHaSettings(response.data);
        setConnectionStatus('connected'); // Confirm connection is good when saving settings
      })
      .catch(error => {
        console.error('Error saving settings:', error);
        setConnectionStatus('error');
      });
  };

  const handleTrackingToggle = () => {
    if (isTrackingActive) {
      // Stop tracking
      console.log('Sending request to stop tracking...');
      axios.post('/api/tracking/stop')
        .then(response => {
          console.log('Tracking stopped:', response.data.message);
          setIsTrackingActive(false);
          setConnectionStatus('connected'); // Confirm we're still connected to backend
          
          // Refresh tracking histories
          refreshTrackingHistories();
        })
        .catch(error => {
          console.error('Error stopping tracking:', error);
          setConnectionStatus('error');
        });
    } else {
      // Start tracking
      console.log('Sending request to start tracking...');
      axios.post('/api/tracking/start')
        .then(response => {
          console.log('Tracking started:', response.data.message);
          setIsTrackingActive(true);
          setConnectionStatus('connected'); // Confirm we're still connected to backend
          
          // Clear selected history when starting new tracking
          setSelectedHistory(null);
          setPlaybackIndex(-1);
        })
        .catch(error => {
          console.error('Error starting tracking:', error);
          setConnectionStatus('error');
        });
    }
  };

  // Refresh tracking histories after tracking stops
  const refreshTrackingHistories = () => {
    axios.get('/api/tracking/histories')
      .then(response => {
        setTrackingHistories(response.data);
      })
      .catch(error => {
        console.error('Error fetching tracking histories:', error);
      });
  };

  // Fetch actual location data periodically
  useEffect(() => {
    let locationFetchIntervalId;

    const fetchLocation = () => {
      axios.get('/api/location')
        .then(response => {
          if (response.data && response.data.latitude && response.data.longitude) {
            setLocation(response.data);
            setLastUpdated(new Date());
            setLocationFetchError(null); // Clear any previous error
            setConnectionStatus('connected'); // Confirm connection is still good
          } else {
            // Location is null but no error in fetching
            setLocation(null);
            setLastUpdated(new Date());
            setConnectionStatus('connected'); // We're still connected to backend, just no location
          }
        })
        .catch(error => {
          console.error('Error fetching location:', error);
          setLocationFetchError(error.message);
          setConnectionStatus('error');
        });
    };

    // Start fetching location every 5 seconds (or a configurable interval)
    locationFetchIntervalId = setInterval(fetchLocation, 5000); // Fetch every 5 seconds
    // Fetch once immediately
    fetchLocation();

    return () => {
      clearInterval(locationFetchIntervalId);
    };
  }, []);

  // Refresh current tracking history periodically when tracking is active
  useEffect(() => {
    let historyFetchIntervalId;

    if (isTrackingActive) {
      const fetchCurrentTrackingHistory = () => {
        axios.get('/api/tracking/current')
          .then(response => {
            if (response.data && response.data.locations) {
              // Create a temporary history object for the current tracking session
              const currentTrackingAsHistory = {
                ...response.data,
                locations: response.data.locations
              };
              // Update selected history to show current tracking path in real-time
              setSelectedHistory(currentTrackingAsHistory);
              // When tracking is active, always show the latest point
              setPlaybackIndex(response.data.locations.length - 1);
            }
          })
          .catch(error => {
            console.error('Error fetching current tracking history:', error);
          });
      };

      // Fetch current tracking history every 10 seconds when tracking is active
      historyFetchIntervalId = setInterval(fetchCurrentTrackingHistory, 10000);
      fetchCurrentTrackingHistory(); // Fetch immediately
    }

    return () => {
      if (historyFetchIntervalId) {
        clearInterval(historyFetchIntervalId);
      }
    };
  }, [isTrackingActive]);



  // Determine status indicator color
  const getStatusColor = () => {
    switch(connectionStatus) {
      case 'connected':
        return isTrackingActive ? '#4CAF50' : '#9E9E9E'; // Green for tracking, gray for connected but not tracking
      case 'error':
        return '#f44336'; // Red for error
      default:
        return '#FF9800'; // Orange for disconnected
    }
  };

  // State for responsive design
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // Ref for the map component to call resize when sidebar changes
  const mapRef = useRef();

  // Add resize listener to handle responsive design
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Update map size when sidebar state changes (to fix map not resizing properly)
  useEffect(() => {
    if (mapRef.current && !isMobile) {
      const mapInstance = mapRef.current.getMap();
      if (mapInstance) {
        setTimeout(() => {
          mapInstance.invalidateSize();
        }, 100); // Small delay to ensure DOM has updated
      }
    }
  }, [sidebarOpen, isMobile]);

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      backgroundColor: '#121212',
      color: '#e0e0e0',
      flexDirection: isMobile ? (sidebarOpen ? 'column' : 'row') : 'row',
      position: 'relative'
    }}>
      {/* Main Map Area */}
      <div style={{
        flex: 1,
        position: 'relative',
        backgroundColor: '#1a1a1a',
        marginLeft: isMobile ? '0' : '10px',
        marginTop: isMobile ? '0' : '10px',
        marginRight: isMobile ? sidebarOpen && !isMobile ? '360px' : '0' : '10px', // Add margin when sidebar is open on desktop
        marginBottom: isMobile ? '0' : '10px',
        ...(isMobile && sidebarOpen ? { display: 'none' } : {})
      }}>
        <Map
          ref={mapRef}
          latitude={location?.latitude || (haSettings.haUrl ? 0 : 51.505)}
          longitude={location?.longitude || (haSettings.haUrl ? 0 : -0.09)}
          isTracking={isTrackingActive}
          isMobile={isMobile}
          selectedHistory={selectedHistory}
          playbackIndex={playbackIndex}
        />
      </div>

      {/* Hamburger Menu - Show on all devices, now on the right */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        style={{
          position: 'absolute',
          top: '15px',
          right: isMobile ? '15px' : '15px',
          left: 'auto',
          zIndex: 1001,
          backgroundColor: 'transparent',
          border: 'none',
          color: '#e0e0e0',
          fontSize: isMobile ? '1.5rem' : '1.2rem',
          cursor: 'pointer',
          padding: '5px',
          width: isMobile ? '40px' : '35px',
          height: isMobile ? '40px' : '35px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        ☰
      </button>

      {/* Sidebar - Settings and Controls on the right */}
      {sidebarOpen && (
        <div style={{
          width: isMobile ? '100%' : '350px',
          padding: '20px',
          borderLeft: isMobile ? 'none' : '1px solid #333', // Changed from borderRight to borderLeft
          backgroundColor: '#1e1e1e',
          color: '#e0e0e0',
          display: 'flex',
          flexDirection: 'column',
          height: isMobile ? 'calc(100% - 100px)' : 'calc(100% - 20px)',  // Adjust height for desktop considering the spacing
          minHeight: isMobile ? '40vh' : '100%',
          overflowY: 'auto',
          zIndex: 999,
          position: isMobile ? 'absolute' : 'relative',
          top: isMobile ? '0' : '10px',
          right: isMobile ? '0' : '10px', // Changed from left to right
          bottom: isMobile ? '0' : '10px',
          marginLeft: isMobile ? '0' : '10px' // Changed from marginRight to marginLeft
        }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '20px', color: '#bb86fc' }}>HA Device Tracker</h1>

          {/* Connection Status */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
            <div
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: getStatusColor(),
                marginRight: '8px'
              }}
            />
            <span style={{ fontSize: '0.9rem' }}>
              {connectionStatus === 'connected'
                ? isTrackingActive
                  ? 'Tracking Active'
                  : 'Connected'
                : connectionStatus === 'error'
                  ? 'Connection Error'
                  : 'Disconnected'}
              {isTrackingActive && location && ` - ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`}
            </span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            <Settings settings={haSettings} onSave={handleSaveSettings} isMobile={isMobile} />
          </div>

          {/* Location Info and Timeline */}
          {selectedHistory && !isTrackingActive && (
            <Timeline
              history={selectedHistory}
              onPointChange={handlePointChange}
              isMobile={isMobile}
            />
          )}

          {location && (
            <div style={{
              marginTop: '20px',
              padding: '12px',
              backgroundColor: '#2d2d2d',
              borderRadius: '6px',
              border: '1px solid #444'
            }}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: '#bb86fc' }}>Current Location</h3>
              <p style={{ margin: '5px 0' }}><strong>Latitude:</strong> {location.latitude.toFixed(6)}</p>
              <p style={{ margin: '5px 0' }}><strong>Longitude:</strong> {location.longitude.toFixed(6)}</p>
              {lastUpdated && (
                <p style={{ margin: '8px 0 0 0', fontSize: '0.8rem', color: '#aaa' }}><small>Last updated: {lastUpdated.toLocaleTimeString()}</small></p>
              )}
              
              {/* Tracking History Section */}
              <div style={{
                marginTop: '20px',
                padding: '12px',
                backgroundColor: '#2d2d2d',
                borderRadius: '6px',
                border: '1px solid #444'
              }}>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: '#bb86fc' }}>Tracking History</h3>
                
                {trackingHistories.length > 0 ? (
                  <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {trackingHistories.map((history, index) => (
                      <div
                        key={history.id}
                        onClick={() => handleHistorySelect(history)}
                        style={{
                          padding: '8px',
                          margin: '4px 0',
                          backgroundColor: selectedHistory?.id === history.id ? '#3a3a3a' : '#222',
                          border: '1px solid #555',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>
                          {new Date(history.startTime).toLocaleString()}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#aaa' }}>
                          Locations: {history.locations?.length || 0} |
                          Duration: {history.endTime ?
                            `${Math.round((new Date(history.endTime) - new Date(history.startTime))/60000)} min` :
                            'Active'}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ margin: '10px 0 0 0', fontSize: '0.9rem', color: '#aaa' }}>No tracking history yet</p>
                )}
              </div>
            </div>
          )}

          {locationFetchError && (
            <div style={{
              marginTop: '15px',
              padding: '12px',
              backgroundColor: '#3e2020',
              color: '#f44336',
              borderRadius: '6px',
              border: '1px solid #642e2e'
            }}>
              <p><strong>Error:</strong> {locationFetchError}</p>
            </div>
          )}
        </div>
      )}

      {/* Floating Tracking Button at Bottom */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000
      }}>
        <button
          onClick={handleTrackingToggle}
          style={{
            backgroundColor: isTrackingActive ? '#d32f2f' : '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            width: isMobile ? '70px' : '80px',
            height: isMobile ? '70px' : '80px',
            fontSize: isMobile ? '14px' : '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 4px 8px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {isTrackingActive ? 'STOP' : 'START'}
        </button>
      </div>
    </div>
  );
}

export default App;