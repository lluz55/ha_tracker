# HA Device Tracker

HA Device Tracker é um aplicativo full-stack que rastreia e exibe as localizações de dispositivos do Home Assistant em um mapa interativo. A aplicação consiste em um backend Node.js que se comunica com a API do Home Assistant e um frontend React com um mapa Leaflet para visualização das localizações.

## Funcionalidades

- Rastreamento em tempo real de dispositivos Home Assistant
- Visualização interativa em mapa Leaflet
- Interface de configurações para ajustar parâmetros de rastreamento
- Atualização automática das localizações
- Sistema de build e execução com Nix para configuração de desenvolvimento consistente

## Setup Instructions

### Backend
1. Navigate to the backend directory: `cd backend`
2. Install dependencies: `npm install`
3. Configure environment variables using the example profiles:
```bash
# common defaults
.env.example

# development profile
.env.development.example

# production profile
.env.production.example
```
4. Select the profile with `APP_ENV` (`development` by default).  
   The backend loads `.env.example` plus `.env.<APP_ENV>.example`.

### Frontend
1. Navigate to the frontend directory: `cd frontend`
2. Install dependencies: `npm install`

## Common Configurations

The `HA_DEVICE_ID` should be in the format `domain.entity_name`. Common examples include:

- `device_tracker.my_phone` - For device tracker entities
- `person.john_doe` - For person entities
- `mobile_app.my_phone` - For mobile app integration
- `sensor.phone_gps_latitude` and `sensor.phone_gps_longitude` - For individual GPS sensors

Make sure the entity actually exists in your Home Assistant installation.

## Running the Application

### Using Nix with Environment (Recommended)

For the fastest execution without constant rebuilds, use the development shell:

Start backend in one terminal:
```bash
nix develop --impure
# Then in the dev shell:
cd backend
npm install  # Only needed the first time
node server.js
```

Start frontend in another terminal:
```bash
nix develop --impure
# Then in the dev shell:
cd frontend
npm install  # Only needed the first time
npx vite preview
```

### Using Nix Run Commands (May rebuild frequently)

If you want to use the nix run commands directly (note: this may trigger rebuilds if the repo is not clean):

Backend:
```bash
nix run .#backend
```

Frontend:
```bash
nix run .#frontend
```

Fullstack (Backend + Frontend simultaneously):
```bash
nix run .#fullstack
```

The backend will start on `http://localhost:$PORT` (API, defaults to 3001) and the frontend will be available on `http://localhost:$FRONTEND_PORT` (UI, defaults to 5000).

### Configuration Options

You can configure the application by setting environment variables before running the commands:

```bash
# Set Home Assistant configuration
export HA_URL="http://your-ha-instance.local:8123"
export HA_TOKEN="your_long_lived_access_token"
export HA_DEVICE_ID="device_tracker.your_device"
export APP_ENV="development"  # or "production"
export ALLOW_REGISTRATION="false" # Only "true" enables new registrations

# Set custom ports
export PORT="3001"           # Backend server port
export BACKEND_PORT="3001"   # Used by frontend to know where backend is running
export FRONTEND_PORT="5000"  # Frontend server port
export FRONTEND_HOST="0.0.0.0" # Frontend host (optional)

# Then run the application (in dev shell)
nix develop --impure
export HA_URL=$HA_URL HA_TOKEN=$HA_TOKEN HA_DEVICE_ID=$HA_DEVICE_ID PORT=$PORT
cd backend && node server.js
```

### Manual execution
Alternatively, you can run the applications manually:

#### Backend
From the `backend` directory:
```bash
npm run dev
```

#### Frontend
From the `frontend` directory:
```bash
npm run dev
```

## Troubleshooting

### 404 Error Issues
- Ensure your Home Assistant URL is correct and accessible
- Verify the device/entity ID exists in Home Assistant
- Check that the device ID uses the correct format (`domain.entity_name`)
- Ensure your Long-Lived Access Token has sufficient permissions

### 401 Error Issues
- Verify your Long-Lived Access Token is correct
- Ensure your token has read permissions to the specified entity

## API Endpoints

- `GET /api/settings` - Get current settings
- `POST /api/settings` - Save settings
- `POST /api/tracking/start` - Start tracking device location
- `POST /api/tracking/stop` - Stop tracking device location
- `GET /api/location` - Get last known location

## Arquitetura do Projeto

### Backend (`/backend`)
- Servidor Node.js com Express
- Comunicação com a API do Home Assistant
- Gerenciamento de configurações via variáveis de ambiente
- Endpoint para obter localização do dispositivo

### Frontend (`/frontend`)
- Aplicação React com Vite
- Componente Map.jsx para exibição do mapa Leaflet
- Componente Settings.jsx para configurações
- Comunicação com backend via API HTTP

### Nix Configuration
- Configurações para ambiente de desenvolvimento consistente
- Gerenciamento de dependências para backend e frontend
- Scripts de execução para desenvolvimento e produção

## Contribuindo

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/nova-feature`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request
