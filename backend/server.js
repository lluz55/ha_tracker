require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());

let settings = {
    haUrl: process.env.HA_URL || '',
    haToken: process.env.HA_TOKEN || '',
    haDeviceId: process.env.HA_DEVICE_ID || '',
    trackingInterval: 15, // in seconds
};

let trackingIntervalId = null;
let lastKnownLocation = null; // New variable to store the last known location

const getDeviceLocation = async () => {
    if (!settings.haUrl || !settings.haToken || !settings.haDeviceId) {
        console.log('Home Assistant settings are not configured.');
        return;
    }

    try {
        const response = await axios.get(`${settings.haUrl}/api/states/${settings.haDeviceId}`, {
            headers: {
                'Authorization': `Bearer ${settings.haToken}`,
                'Content-Type': 'application/json',
            },
        });
        const { attributes } = response.data;
        const { latitude, longitude } = attributes;
        console.log(`Device location: ${latitude}, ${longitude}`);
        lastKnownLocation = { latitude, longitude }; // Store the last known location
    } catch (error) {
        console.error('Error fetching device location:', error.message);
    }
};


app.get('/api/settings', (req, res) => {
    res.json(settings);
});

app.post('/api/settings', (req, res) => {
    settings = { ...settings, ...req.body };
    // Persist sensitive data to env is not ideal, but for this MVP we will update the process env
    process.env.HA_URL = settings.haUrl;
    process.env.HA_TOKEN = settings.haToken;
    process.env.HA_DEVICE_ID = settings.haDeviceId;
    res.json(settings);
});

app.post('/api/tracking/start', (req, res) => {
    if (trackingIntervalId) {
        return res.status(400).json({ message: 'Tracking is already active.' });
    }
    getDeviceLocation(); // Fetch immediately
    trackingIntervalId = setInterval(getDeviceLocation, settings.trackingInterval * 1000);
    res.json({ message: 'Tracking started.' });
});

app.post('/api/tracking/stop', (req, res) => {
    if (!trackingIntervalId) {
        return res.status(400).json({ message: 'Tracking is not active.' });
    }
    clearInterval(trackingIntervalId);
    trackingIntervalId = null;
    res.json({ message: 'Tracking stopped.' });
});

app.get('/api/location', (req, res) => {
    res.json(lastKnownLocation); // Return the last known location
});


app.listen(port, () => {
    console.log(`Backend server listening at http://localhost:${port}`);
});
