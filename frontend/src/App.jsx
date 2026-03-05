import React, { useState, useEffect, useRef } from 'react';
import api from './api';
import Map from './components/Map';
import Settings from './components/Settings';
import Timeline from './components/Timeline';
import Auth from './components/Auth';

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

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
    const checkAuth = async () => {
      const token = localStorage.getItem('ha_tracker_token');
      if (token) {
        try {
          const res = await api.get('/auth/me');
          setUser(res.data.user);
        } catch (err) {
          localStorage.removeItem('ha_tracker_token');
          setUser(null);
        }
      }
      setAuthLoading(false);
    };
    checkAuth();
  }, []);

  useEffect(() => {
    if (!user) return; // Only fetch data if logged in

    // Fetch initial settings from backend
    api.get('/api/settings')
      .then(response => {
        setHaSettings(response.data);
        setConnectionStatus('connected'); // Update status to connected when settings are successfully fetched
      })
      .catch(error => {
        console.error('Error fetching settings:', error);
        setConnectionStatus('error');
      });
      
    // Load tracking histories
    api.get('/api/tracking/histories')
      .then(response => {
        setTrackingHistories(response.data);
      })
      .catch(error => {
        console.error('Error fetching tracking histories:', error);
      });

    // Check if there's an ongoing tracking session
    api.get('/api/tracking/current')
      .then(response => {
        if (response.data && response.data.id) {
          console.log('Detected active tracking session on load:', response.data.id);
          setIsTrackingActive(true);
        }
      })
      .catch(error => {
        console.error('Error checking current tracking status:', error);
      });
  }, [user]);

  const handleLogout = () => {
    localStorage.removeItem('ha_tracker_token');
    setUser(null);
    setIsTrackingActive(false);
    setLocation(null);
    setTrackingHistories([]);
    setSelectedHistory(null);
  };

  const handleSaveSettings = (newSettings) => {
    api.post('/api/settings', newSettings)
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
      api.post('/api/tracking/stop')
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
      api.post('/api/tracking/start')
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
    api.get('/api/tracking/histories')
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
      if (!user) return;
      api.get('/api/location')
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
    if (user) {
      locationFetchIntervalId = setInterval(fetchLocation, 5000); // Fetch every 5 seconds
      // Fetch once immediately
      fetchLocation();
    }

    return () => {
      if (locationFetchIntervalId) clearInterval(locationFetchIntervalId);
    };
  }, [user]);

  // Refresh current tracking history periodically when tracking is active
  useEffect(() => {
    let historyFetchIntervalId;

    if (isTrackingActive && user) {
      const fetchCurrentTrackingHistory = () => {
        api.get('/api/tracking/current')
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
  }, [isTrackingActive, user]);



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

  if (authLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#121212', color: '#e0e0e0' }}>Loading...</div>;
  }

  if (!user) {
    return <Auth onLogin={setUser} />;
  }

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      backgroundColor: '#0F172A',
      color: '#F8FAFC',
      flexDirection: 'row',
      position: 'relative',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      overflow: 'hidden'
    }}>
      {/* Main Map Area */}
      <div style={{
        flex: 1,
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 1
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

      {/* Hamburger Menu (Floating) */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          zIndex: 1001,
          backgroundColor: '#1E293B',
          border: '1px solid #334155',
          color: '#F8FAFC',
          borderRadius: '12px',
          cursor: 'pointer',
          width: '48px',
          height: '48px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
          transition: 'all 0.2s'
        }}
        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#334155'}
        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#1E293B'}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {sidebarOpen ? (
            <><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></>
          ) : (
            <><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></>
          )}
        </svg>
      </button>

      {/* Sidebar - Glassmorphism style */}
      <div style={{
        width: isMobile ? '100%' : '380px',
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderLeft: '1px solid rgba(51, 65, 85, 0.5)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        zIndex: 999,
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        transform: sidebarOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: '-10px 0 25px rgba(0,0,0,0.3)',
        overflowY: 'auto'
      }}>
        
        <div style={{ padding: '24px 24px 0 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ 
                width: '40px', height: '40px', backgroundColor: '#6366F1', 
                borderRadius: '10px', display: 'flex', justifyContent: 'center', alignItems: 'center'
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
              </div>
              <h1 style={{ fontSize: '1.4rem', margin: 0, fontWeight: 'bold' }}>Tracker</h1>
            </div>
            
            <button
              onClick={handleLogout}
              style={{
                backgroundColor: 'transparent',
                color: '#94A3B8',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.9rem',
                transition: 'color 0.2s',
                paddingRight: '40px' // Space for hamburger
              }}
              onMouseOver={(e) => e.currentTarget.style.color = '#EF4444'}
              onMouseOut={(e) => e.currentTarget.style.color = '#94A3B8'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
              Sair
            </button>
          </div>

          {/* Connection Status Badge */}
          <div style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '8px',
            backgroundColor: 'rgba(30, 41, 59, 0.8)',
            padding: '8px 12px',
            borderRadius: '20px',
            border: '1px solid rgba(51, 65, 85, 0.8)',
            marginBottom: '24px'
          }}>
            <div style={{
              width: '10px', height: '10px', borderRadius: '50%',
              backgroundColor: getStatusColor(),
              boxShadow: `0 0 8px ${getStatusColor()}`
            }}/>
            <span style={{ fontSize: '0.85rem', fontWeight: '500', color: '#CBD5E1' }}>
              {connectionStatus === 'connected'
                ? isTrackingActive ? 'Rastreamento Ativo' : 'Conectado'
                : connectionStatus === 'error' ? 'Erro de Conexão' : 'Desconectado'}
            </span>
          </div>
        </div>

        <div style={{ flex: 1, padding: '0 24px 24px 24px' }}>
          <Settings settings={haSettings} onSave={handleSaveSettings} isMobile={isMobile} />

          {/* Location Info and Timeline */}
          {selectedHistory && !isTrackingActive && (
            <Timeline history={selectedHistory} onPointChange={handlePointChange} isMobile={isMobile} />
          )}

          {location && (
            <div style={{
              marginTop: '20px',
              padding: '16px',
              backgroundColor: '#1E293B',
              borderRadius: '12px',
              border: '1px solid #334155'
            }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '1.05rem', color: '#F8FAFC', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg>
                Localização Atual
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <div style={{ backgroundColor: '#0F172A', padding: '10px', borderRadius: '8px', border: '1px solid #334155' }}>
                  <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginBottom: '4px' }}>Latitude</div>
                  <div style={{ fontFamily: 'monospace', color: '#F8FAFC' }}>{location.latitude.toFixed(5)}</div>
                </div>
                <div style={{ backgroundColor: '#0F172A', padding: '10px', borderRadius: '8px', border: '1px solid #334155' }}>
                  <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginBottom: '4px' }}>Longitude</div>
                  <div style={{ fontFamily: 'monospace', color: '#F8FAFC' }}>{location.longitude.toFixed(5)}</div>
                </div>
              </div>
              {lastUpdated && (
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748B', textAlign: 'right' }}>
                  Atualizado às {lastUpdated.toLocaleTimeString()}
                </p>
              )}
              
              {/* Tracking History Section */}
              <div style={{ marginTop: '24px' }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '1.05rem', color: '#F8FAFC', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="12 8 12 12 14 14"></polyline><circle cx="12" cy="12" r="10"></circle></svg>
                  Histórico de Sessões
                </h3>
                
                {trackingHistories.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto', paddingRight: '4px' }}>
                    {trackingHistories.map((history, index) => {
                      const isSelected = selectedHistory?.id === history.id;
                      return (
                        <div
                          key={history.id}
                          onClick={() => handleHistorySelect(history)}
                          style={{
                            padding: '12px',
                            backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.15)' : '#0F172A',
                            border: `1px solid ${isSelected ? '#6366F1' : '#334155'}`,
                            borderRadius: '8px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                          onMouseOver={(e) => { if (!isSelected) e.currentTarget.style.borderColor = '#475569' }}
                          onMouseOut={(e) => { if (!isSelected) e.currentTarget.style.borderColor = '#334155' }}
                        >
                          <div>
                            <div style={{ fontWeight: '600', fontSize: '0.9rem', color: isSelected ? '#818CF8' : '#E2E8F0', marginBottom: '4px' }}>
                              {new Date(history.startTime).toLocaleDateString()} às {new Date(history.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}>
                              {history.locations?.length || 0} pontos registrados
                            </div>
                          </div>
                          <div style={{ 
                            fontSize: '0.75rem', 
                            padding: '4px 8px', 
                            backgroundColor: history.endTime ? '#1E293B' : 'rgba(16, 185, 129, 0.2)',
                            color: history.endTime ? '#94A3B8' : '#10B981',
                            borderRadius: '12px',
                            fontWeight: '600'
                          }}>
                            {history.endTime ? `${Math.round((new Date(history.endTime) - new Date(history.startTime))/60000)} min` : 'Ativa'}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#0F172A', borderRadius: '8px', border: '1px dashed #334155' }}>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748B' }}>Nenhum histórico encontrado</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {locationFetchError && (
            <div style={{
              marginTop: '16px',
              padding: '12px 16px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              color: '#F87171',
              borderRadius: '8px',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              fontSize: '0.9rem'
            }}>
              <strong>Erro:</strong> {locationFetchError}
            </div>
          )}
          
          {/* Spacer for bottom button */}
          <div style={{ height: '100px' }}></div>
        </div>
      </div>

      {/* Floating Tracking Button */}
      <div style={{
        position: 'absolute',
        bottom: '30px',
        left: sidebarOpen && !isMobile ? 'calc(50% - 190px)' : '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
      }}>
        <button
          onClick={handleTrackingToggle}
          style={{
            backgroundColor: isTrackingActive ? '#EF4444' : '#10B981', // Red 500 or Emerald 500
            color: 'white',
            border: 'none',
            borderRadius: '30px',
            padding: '0 32px',
            height: '60px',
            fontSize: '1rem',
            fontWeight: 'bold',
            letterSpacing: '1px',
            cursor: 'pointer',
            boxShadow: `0 10px 25px -5px ${isTrackingActive ? 'rgba(239, 68, 68, 0.5)' : 'rgba(16, 185, 129, 0.5)'}`,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          {isTrackingActive ? (
            <><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg> PARAR RASTREIO</>
          ) : (
            <><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> INICIAR RASTREIO</>
          )}
        </button>
      </div>
    </div>
  );
}

export default App;