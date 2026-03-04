require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

let settings = {
    haUrl: process.env.HA_URL || '',
    haToken: process.env.HA_TOKEN || '',
    haDeviceId: process.env.HA_DEVICE_ID || '',
    trackingInterval: 15, // in seconds
};

let trackingIntervalId = null;
let lastKnownLocation = null; // New variable to store the last known location

// Structure to store tracking histories
let trackingHistories = [];
let currentTrackingSession = null; // To keep track of the current active tracking session

const getDeviceLocation = async () => {
    if (!settings.haUrl || !settings.haToken || !settings.haDeviceId) {
        console.log('Home Assistant settings are not configured.');
        return;
    }

    try {
        // Ensure the URL ends with a slash if needed
        let baseUrl = settings.haUrl;
        if (!baseUrl.endsWith('/')) {
            baseUrl += '/';
        }

        // Validate the entity ID format (should be domain.entity_id)
        if (!settings.haDeviceId.includes('.')) {
            console.error('Invalid device ID format. Expected format: domain.entity_name (e.g. device_tracker.my_device, person.user_name)');
            return;
        }

        const apiUrl = `${baseUrl}api/states/${settings.haDeviceId}`;
        console.log(`Fetching from Home Assistant API: ${apiUrl}`);

        const response = await axios.get(apiUrl, {
            headers: {
                'Authorization': `Bearer ${settings.haToken}`,
                'Content-Type': 'application/json',
            },
        });

        console.log('Response from Home Assistant:', response.data);
        const { attributes } = response.data;

        if (response.status === 200 && attributes && attributes.latitude !== undefined && attributes.longitude !== undefined) {
            const { latitude, longitude } = attributes;
            console.log(`Device location: ${latitude}, ${longitude}`);
            lastKnownLocation = { latitude, longitude }; // Store the last known location
            
            // Add to current tracking session if active
            if (currentTrackingSession) {
                const locationEntry = {
                    latitude,
                    longitude,
                    timestamp: new Date().toISOString()
                };
                
                currentTrackingSession.locations.push(locationEntry);
            }
        } else {
            console.error('Latitude or longitude not found in Home Assistant response attributes.');
            console.error('Response data:', JSON.stringify(response.data, null, 2));
            lastKnownLocation = null; // Clear last known location if not found
        }
    } catch (error) {
        console.error('Error fetching device location:', error.message);
        if (error.response) {
            console.error('HTTP Status:', error.response.status);
            console.error('Error response data:', error.response.data);
            console.error('Error response headers:', error.response.headers);

            // If we got a 404, it could be due to incorrect entity ID, incorrect URL format, or invalid token
            if (error.response.status === 404) {
                console.error('404 Error: Check that the entity ID exists and is in the correct format (e.g. device_tracker.my_device, person.user_name, sensor.my_location)');
            } else if (error.response.status === 401) {
                console.error('401 Error: Unauthorized - check your Home Assistant token');
            }
        } else if (error.request) {
            // Request was made but no response received
            console.error('No response received from Home Assistant:', error.request);
        }
        // Clear last known location if there's an error
        lastKnownLocation = null;
    }
};


app.get('/api/settings', (req, res) => {
    res.json(settings);
});

app.post('/api/settings', (req, res) => {
    settings = { ...settings, ...req.body };
    res.json(settings);
});

app.post('/api/tracking/start', (req, res) => {
    if (trackingIntervalId) {
        return res.status(400).json({ message: 'Tracking is already active.' });
    }
    
    // Create a new tracking session
    currentTrackingSession = {
        id: Date.now(), // Using timestamp as unique ID
        startTime: new Date().toISOString(),
        locations: []
    };
    
    console.log('Starting tracking...');
    getDeviceLocation(); // Fetch immediately
    trackingIntervalId = setInterval(getDeviceLocation, settings.trackingInterval * 1000);
    res.json({ message: 'Tracking started.', sessionId: currentTrackingSession.id });
});

app.post('/api/tracking/stop', (req, res) => {
    if (!trackingIntervalId) {
        return res.status(400).json({ message: 'Tracking is not active.' });
    }
    
    clearInterval(trackingIntervalId);
    trackingIntervalId = null;
    
    // Finalize current tracking session if exists
    if (currentTrackingSession) {
        currentTrackingSession.endTime = new Date().toISOString();
        
        // Add the completed session to the history
        trackingHistories.unshift(currentTrackingSession); // Add to beginning of array
        
        // Clear current session
        currentTrackingSession = null;
    }
    
    res.json({ message: 'Tracking stopped.' });
});

app.get('/api/location', (req, res) => {
    res.json(lastKnownLocation); // Return the last known location
});

// Get tracking histories
app.get('/api/tracking/histories', (req, res) => {
    res.json(trackingHistories);
});

// Get a specific tracking history by ID
app.get('/api/tracking/history/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const history = trackingHistories.find(h => h.id === id);
    
    if (!history) {
        return res.status(404).json({ message: 'Tracking history not found.' });
    }
    
    res.json(history);
});

// Get current tracking session
app.get('/api/tracking/current', (req, res) => {
    res.json(currentTrackingSession);
});

// Delete all tracking histories
app.delete('/api/tracking/histories', (req, res) => {
    trackingHistories = []; // Clear all histories
    res.json({ message: 'All tracking histories cleared.' });
});

// Health check endpoint
app.get('/', (req, res) => {
    res.json({ status: 'Server is running', timestamp: new Date().toISOString() });
});


app.listen(port, () => {
    console.log(`Backend server listening at http://localhost:${port}`);
});
