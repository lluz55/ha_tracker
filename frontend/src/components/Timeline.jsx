import React, { useState, useEffect } from 'react';

function Timeline({ history, onPointChange, isMobile }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const locations = history?.locations || [];

  useEffect(() => {
    // Reset to start when history changes
    setCurrentIndex(0);
    setIsPlaying(false);
  }, [history]);

  useEffect(() => {
    let interval;
    if (isPlaying && currentIndex < locations.length - 1) {
      interval = setInterval(() => {
        setCurrentIndex((prev) => {
          const next = prev + 1;
          onPointChange(next);
          if (next >= locations.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return next;
        });
      }, 1000); // 1 second per point
    } else {
      setIsPlaying(false);
    }
    return () => clearInterval(interval);
  }, [isPlaying, currentIndex, locations.length, onPointChange]);

  if (locations.length === 0) return null;

  const currentPoint = locations[currentIndex];
  const timeStr = new Date(currentPoint.timestamp).toLocaleTimeString();

  const handleSliderChange = (e) => {
    const index = parseInt(e.target.value);
    setCurrentIndex(index);
    onPointChange(index);
    setIsPlaying(false);
  };

  return (
    <div style={{
      padding: '15px',
      backgroundColor: '#252525',
      borderRadius: '8px',
      marginTop: '15px',
      border: '1px solid #444',
      color: '#e0e0e0'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h4 style={{ margin: 0, color: '#bb86fc' }}>Session Timeline</h4>
        <span style={{ fontSize: '0.85rem', color: '#aaa' }}>{timeStr}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          disabled={currentIndex >= locations.length - 1 && !isPlaying}
          style={{
            backgroundColor: isPlaying ? '#f44336' : '#6200ea',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '8px 12px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '0.9rem',
            minWidth: '70px'
          }}
        >
          {isPlaying ? 'PAUSE' : 'PLAY'}
        </button>

        <input
          type="range"
          min="0"
          max={locations.length - 1}
          value={currentIndex}
          onChange={handleSliderChange}
          style={{
            flex: 1,
            cursor: 'pointer',
            accentColor: '#bb86fc'
          }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '0.75rem', color: '#888' }}>
        <span>Start: {new Date(locations[0].timestamp).toLocaleTimeString()}</span>
        <span>Point {currentIndex + 1} of {locations.length}</span>
        <span>End: {new Date(locations[locations.length - 1].timestamp).toLocaleTimeString()}</span>
      </div>
    </div>
  );
}

export default Timeline;