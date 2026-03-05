require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

const app = express();
const port = process.env.PORT || 3001;

// Database Setup
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(process.cwd(), 'database.sqlite'),
    logging: false
});

// Models
const Settings = sequelize.define('Settings', {
    haUrl: { type: DataTypes.STRING, defaultValue: '' },
    haToken: { type: DataTypes.TEXT, defaultValue: '' },
    haDeviceId: { type: DataTypes.STRING, defaultValue: '' },
    trackingInterval: { type: DataTypes.INTEGER, defaultValue: 15 }
});

const TrackingSession = sequelize.define('TrackingSession', {
    startTime: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    endTime: { type: DataTypes.DATE, allowNull: true }
});

const Location = sequelize.define('Location', {
    latitude: { type: DataTypes.FLOAT, allowNull: false },
    longitude: { type: DataTypes.FLOAT, allowNull: false },
    timestamp: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
});

// Associations
TrackingSession.hasMany(Location, { as: 'locations', onDelete: 'CASCADE' });
Location.belongsTo(TrackingSession);

// Initialize DB
let currentSettings = {
    haUrl: process.env.HA_URL || '',
    haToken: process.env.HA_TOKEN || '',
    haDeviceId: process.env.HA_DEVICE_ID || '',
    trackingInterval: 15
};

const initDb = async () => {
    try {
        await sequelize.sync();
        console.log('Database synced');
        
        // Load settings from DB or create default
        let settingsRow = await Settings.findOne();
        if (!settingsRow) {
            settingsRow = await Settings.create(currentSettings);
        }
        currentSettings = settingsRow.toJSON();
    } catch (error) {
        console.error('Failed to sync database:', error);
    }
};

initDb();

app.use(cors());
app.use(express.json());

let trackingIntervalId = null;
let lastKnownLocation = null;
let currentTrackingSession = null;

const getDeviceLocation = async () => {
    if (!currentSettings.haUrl || !currentSettings.haToken || !currentSettings.haDeviceId) {
        console.log('Home Assistant settings are not configured.');
        return;
    }

    try {
        let baseUrl = currentSettings.haUrl;
        if (!baseUrl.endsWith('/')) baseUrl += '/';

        if (!currentSettings.haDeviceId.includes('.')) {
            console.error('Invalid device ID format.');
            return;
        }

        const apiUrl = `${baseUrl}api/states/${currentSettings.haDeviceId}`;
        console.log(`Fetching from HA API: ${apiUrl}`);

        const response = await axios.get(apiUrl, {
            headers: {
                'Authorization': `Bearer ${currentSettings.haToken}`,
                'Content-Type': 'application/json',
            },
        });

        const { attributes } = response.data;

        if (response.status === 200 && attributes && attributes.latitude !== undefined && attributes.longitude !== undefined) {
            const { latitude, longitude } = attributes;
            console.log(`Device location: ${latitude}, ${longitude}`);
            lastKnownLocation = { latitude, longitude };
            
            if (currentTrackingSession) {
                await Location.create({
                    latitude,
                    longitude,
                    timestamp: new Date(),
                    TrackingSessionId: currentTrackingSession.id
                });
            }
        } else {
            console.error('Location attributes not found.');
            lastKnownLocation = null;
        }
    } catch (error) {
        console.error('Error fetching location:', error.message);
        lastKnownLocation = null;
    }
};

app.get('/api/settings', (req, res) => {
    res.json(currentSettings);
});

app.post('/api/settings', async (req, res) => {
    try {
        let settingsRow = await Settings.findOne();
        if (settingsRow) {
            await settingsRow.update(req.body);
        } else {
            settingsRow = await Settings.create(req.body);
        }
        currentSettings = settingsRow.toJSON();
        res.json(currentSettings);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.post('/api/tracking/start', async (req, res) => {
    if (trackingIntervalId) {
        return res.status(400).json({ message: 'Tracking is already active.' });
    }
    
    try {
        currentTrackingSession = await TrackingSession.create({ startTime: new Date() });
        console.log('Starting tracking session:', currentTrackingSession.id);
        
        await getDeviceLocation();
        trackingIntervalId = setInterval(getDeviceLocation, currentSettings.trackingInterval * 1000);
        res.json({ message: 'Tracking started.', sessionId: currentTrackingSession.id });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.post('/api/tracking/stop', async (req, res) => {
    if (!trackingIntervalId) {
        return res.status(400).json({ message: 'Tracking is not active.' });
    }
    
    clearInterval(trackingIntervalId);
    trackingIntervalId = null;
    
    if (currentTrackingSession) {
        await currentTrackingSession.update({ endTime: new Date() });
        currentTrackingSession = null;
    }
    
    res.json({ message: 'Tracking stopped.' });
});

app.get('/api/location', (req, res) => {
    res.json(lastKnownLocation);
});

app.get('/api/tracking/histories', async (req, res) => {
    try {
        const histories = await TrackingSession.findAll({
            include: [{ model: Location, as: 'locations' }],
            order: [['startTime', 'DESC']]
        });
        res.json(histories);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.get('/api/tracking/history/:id', async (req, res) => {
    try {
        const history = await TrackingSession.findByPk(req.params.id, {
            include: [{ model: Location, as: 'locations' }]
        });
        if (!history) return res.status(404).json({ message: 'Not found' });
        res.json(history);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.get('/api/tracking/current', async (req, res) => {
    if (!currentTrackingSession) return res.json(null);
    try {
        const session = await TrackingSession.findByPk(currentTrackingSession.id, {
            include: [{ model: Location, as: 'locations' }]
        });
        res.json(session);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.delete('/api/tracking/histories', async (req, res) => {
    try {
        await TrackingSession.destroy({ where: {}, truncate: false });
        res.json({ message: 'All tracking histories cleared.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.get('/', (req, res) => {
    res.json({ status: 'Server is running', timestamp: new Date().toISOString() });
});

app.listen(port, () => {
    console.log(`Backend server listening at http://localhost:${port}`);
});
