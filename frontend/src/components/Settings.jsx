import React, { useState, useEffect } from 'react';
import api from '../api';

function Settings({ settings, onSave, isMobile }) {
  const [haUrl, setHaUrl] = useState(settings.haUrl);
  const [haToken, setHaToken] = useState(settings.haToken);
  const [haDeviceId, setHaDeviceId] = useState(settings.haDeviceId);
  const [trackingInterval, setTrackingInterval] = useState(settings.trackingInterval);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setHaUrl(settings.haUrl);
    setHaToken(settings.haToken);
    setHaDeviceId(settings.haDeviceId);
    setTrackingInterval(settings.trackingInterval);
  }, [settings]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    await onSave({ haUrl, haToken, haDeviceId, trackingInterval: Number(trackingInterval) });
    setTimeout(() => setIsSaving(false), 500); // Visual feedback
  };

  const inputStyle = {
    padding: '12px 14px',
    backgroundColor: '#0F172A', // Slate 900
    border: '1px solid #334155', // Slate 700
    borderRadius: '8px',
    color: '#F8FAFC',
    fontSize: '0.95rem',
    width: '100%',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
    outline: 'none',
  };

  const labelStyle = {
    display: 'block',
    marginBottom: '6px',
    fontSize: '0.85rem',
    color: '#94A3B8', // Slate 400
    fontWeight: '500'
  };

  const sectionStyle = {
    backgroundColor: '#1E293B',
    padding: '20px',
    borderRadius: '12px',
    marginBottom: '20px',
    border: '1px solid #334155'
  };

  return (
    <div style={{ color: '#F8FAFC', flex: 1, display: 'flex', flexDirection: 'column' }}>
      
      <div style={sectionStyle}>
        <h3 style={{ color: '#F8FAFC', fontSize: '1.1rem', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
          Configurações do Servidor
        </h3>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={labelStyle}>URL do Home Assistant</label>
            <input
              type="url"
              value={haUrl}
              onChange={(e) => setHaUrl(e.target.value)}
              placeholder="Ex: http://homeassistant.local:8123"
              style={inputStyle}
              onFocus={(e) => e.target.style.borderColor = '#6366F1'}
              onBlur={(e) => e.target.style.borderColor = '#334155'}
            />
          </div>

          <div>
            <label style={labelStyle}>Token de Acesso (Long-Lived)</label>
            <input
              type="password"
              value={haToken}
              onChange={(e) => setHaToken(e.target.value)}
              placeholder="Cole seu token aqui"
              style={inputStyle}
              onFocus={(e) => e.target.style.borderColor = '#6366F1'}
              onBlur={(e) => e.target.style.borderColor = '#334155'}
            />
          </div>

          <div>
            <label style={labelStyle}>ID do Dispositivo (Ex: person.nome)</label>
            <input
              type="text"
              value={haDeviceId}
              onChange={(e) => setHaDeviceId(e.target.value)}
              placeholder="person.seu_usuario"
              style={inputStyle}
              onFocus={(e) => e.target.style.borderColor = '#6366F1'}
              onBlur={(e) => e.target.style.borderColor = '#334155'}
            />
          </div>

          <div>
            <label style={labelStyle}>Intervalo de Rastreio (segundos)</label>
            <input
              type="number"
              value={trackingInterval}
              onChange={(e) => setTrackingInterval(e.target.value)}
              min="5"
              max="3600"
              style={inputStyle}
              onFocus={(e) => e.target.style.borderColor = '#6366F1'}
              onBlur={(e) => e.target.style.borderColor = '#334155'}
            />
          </div>

          <button
            type="submit"
            style={{
              backgroundColor: isSaving ? '#4F46E5' : '#6366F1',
              color: 'white',
              border: 'none',
              padding: '12px 20px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.95rem',
              fontWeight: '600',
              marginTop: '8px',
              transition: 'all 0.2s',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {isSaving ? 'Salvando...' : 'Salvar Configurações'}
            {!isSaving && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
          </button>
        </form>
      </div>
      
      <div style={sectionStyle}>
        <h3 style={{ color: '#F8FAFC', fontSize: '1.1rem', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
          Zona de Perigo
        </h3>
        <p style={{ fontSize: '0.85rem', color: '#94A3B8', marginBottom: '16px', lineHeight: '1.4' }}>
          Apagar o histórico removerá todas as sessões de rastreamento salvas no servidor. Esta ação não pode ser desfeita.
        </p>
        <button
          onClick={() => {
            if (window.confirm('Tem certeza? Todo o histórico de localizações será apagado.')) {
              api.delete('/api/tracking/histories')
              .then(() => {
                alert('Histórico apagado com sucesso.');
                window.location.reload();
              })
              .catch(error => {
                console.error('Error clearing tracking history:', error);
                alert('Erro ao apagar histórico.');
              });
            }
          }}
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            color: '#EF4444',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            padding: '10px 15px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: '600',
            width: '100%',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => { e.target.style.backgroundColor = 'rgba(239, 68, 68, 0.2)' }}
          onMouseOut={(e) => { e.target.style.backgroundColor = 'rgba(239, 68, 68, 0.1)' }}
        >
          Apagar Histórico
        </button>
      </div>
    </div>
  );
}

export default Settings;