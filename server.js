const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;
const apiToken = 'Azfo1SJYAXUMpOqrYRidFQUEoOWuNCP5NxfxC1R0po5';

let cachedAgents = null;
let cachedDevices = {};
let lastFetchedAgents = null;
let lastFetchedDevices = {};

// Middleware to serve static files from the 'public' directory
app.use(express.static('public'));

// Fetch agents from Domotz API or use cached data if within 15 minutes
app.get('/agent', async (req, res) => {
    const now = Date.now();

    if (!cachedAgents || (now - lastFetchedAgents > 15 * 60 * 1000)) {
        try {
            const response = await axios.get('https://api-us-east-1-cell-1.domotz.com/public-api/v1/agent', {
                headers: {
                    'Accept': 'application/json',
                    'X-Api-Key': apiToken
                }
            });
            cachedAgents = response.data;
            lastFetchedAgents = now;
        } catch (error) {
            console.error('Error fetching agents from Domotz API:', error);
            return res.status(500).json({ message: 'Error fetching agents' });
        }
    }

    res.json({
        data: cachedAgents,
        lastFetched: lastFetchedAgents
    });
});

// Fetch devices for a specific agent from Domotz API or use cached data if within 15 minutes
app.get('/agent/:agentId/device', async (req, res) => {
    const agentId = req.params.agentId;
    const now = Date.now();

    if (!cachedDevices[agentId] || (now - lastFetchedDevices[agentId] > 15 * 60 * 1000)) {
        try {
            const response = await axios.get(`https://api-us-east-1-cell-1.domotz.com/public-api/v1/agent/${agentId}/device`, {
                headers: {
                    'Accept': 'application/json',
                    'X-Api-Key': apiToken
                }
            });
            cachedDevices[agentId] = response.data;
            lastFetchedDevices[agentId] = now;
        } catch (error) {
            console.error(`Error fetching devices for agent ${agentId} from Domotz API:`, error);
            return res.status(500).json({ message: `Error fetching devices for agent ${agentId}` });
        }
    }

    res.json({
        data: cachedDevices[agentId],
        lastFetched: lastFetchedDevices[agentId]
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

