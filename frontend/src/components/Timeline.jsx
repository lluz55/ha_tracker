import React from 'react';

function Timeline({ history, onPointChange, isMobile }) {
  if (!history || !history.locations || history.locations.length === 0) {
    return null;
  }

  const formatTime = (isoString) => {
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div style={{
      marginTop: '20px',
      padding: '20px',
      backgroundColor: '#1E293B', // Slate 800
      borderRadius: '12px',
      border: '1px solid #334155', // Slate 700
      display: 'flex',
      flexDirection: 'column',
      maxHeight: isMobile ? '30vh' : '40vh'
    }}>
      <h3 style={{ 
        color: '#F8FAFC', 
        fontSize: '1.1rem', 
        margin: '0 0 16px 0', 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px' 
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
        Timeline da Sessão
      </h3>
      
      <div style={{ 
        overflowY: 'auto', 
        flex: 1, 
        paddingRight: '8px',
        // Estilização customizada da scrollbar para navegadores webkit
        scrollbarWidth: 'thin',
        scrollbarColor: '#475569 transparent'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative' }}>
          {/* Linha vertical conectando os pontos */}
          <div style={{
            position: 'absolute',
            left: '11px',
            top: '20px',
            bottom: '20px',
            width: '2px',
            backgroundColor: '#334155',
            zIndex: 0
          }}></div>

          {history.locations.map((loc, index) => (
            <div 
              key={loc.id || index}
              onClick={() => onPointChange(index)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 12px',
                backgroundColor: '#0F172A', // Slate 900
                borderRadius: '8px',
                cursor: 'pointer',
                border: '1px solid #334155',
                transition: 'all 0.2s',
                position: 'relative',
                zIndex: 1
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = '#6366F1';
                e.currentTarget.style.transform = 'translateX(4px)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = '#334155';
                e.currentTarget.style.transform = 'translateX(0)';
              }}
            >
              {/* Ponto na timeline */}
              <div style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: index === history.locations.length - 1 ? '#10B981' : '#6366F1', // Verde para o último, Indigo para os outros
                boxShadow: `0 0 0 4px #0F172A, 0 0 0 5px ${index === history.locations.length - 1 ? '#10B981' : '#6366F1'}`
              }}></div>
              
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ color: '#F8FAFC', fontWeight: '600', fontSize: '0.95rem' }}>
                  {formatTime(loc.timestamp)}
                </span>
                <span style={{ color: '#94A3B8', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                  {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Timeline;
