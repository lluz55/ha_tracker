# HA Device Tracker

This application tracks device locations from Home Assistant using the Home Assistant API.

## Setup Instructions

### Backend
1. Navigate to the backend directory: `cd backend`
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and configure your settings:
```bash
HA_URL=http://homeassistant.local:8123  # Your Home Assistant URL
HA_TOKEN=your_long_lived_access_token   # Your Home Assistant Long-Lived Access Token
HA_DEVICE_ID=device_tracker.my_device   # Entity ID of the device to track
```

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