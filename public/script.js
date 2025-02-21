document.addEventListener('DOMContentLoaded', () => {
    const agentsListElement = document.getElementById('agents-list');
    const devicesListElement = document.getElementById('devices-list');
    const lastApiCallElement = document.getElementById('last-api-call');

    // Cache for storing fetched device data per agent
    const deviceCache = {};

    // Utility function to update the last API call timestamp
    function updateLastApiCall() {
        const now = new Date();
        const formattedTime = now.toLocaleString();
        lastApiCallElement.textContent = `Last API call: ${formattedTime}`;
    }

    // Fetch and display agents
    fetch('/agent')
        .then(response => response.json())
        .then(agentData => {
            updateLastApiCall();  // Update timestamp
            const agents = agentData.data;

            agents.forEach(agent => {
                const agentItem = document.createElement('div');
                agentItem.textContent = agent.display_name;
                agentItem.className = 'agent-item';
                agentItem.addEventListener('click', () => displayDevices(agent.id, agent.display_name));
                agentsListElement.appendChild(agentItem);
            });
        })
        .catch(error => {
            console.error('Error fetching agents:', error);
            agentsListElement.textContent = 'Failed to load agents.';
        });

    // Fetch and display devices for the selected agent, using cache if available
    function displayDevices(agentId, agentName) {
        // Clear previous devices list
        devicesListElement.innerHTML = `<h2>Devices for ${agentName}</h2>`;

        // Check if devices for this agent are already cached
        if (deviceCache[agentId]) {
            renderDeviceList(deviceCache[agentId]);
            return;
        }

        // Fetch devices if not cached
        fetch(`/agent/${agentId}/device`)
            .then(response => response.json())
            .then(devicesData => {
                updateLastApiCall();  // Update timestamp
                const devices = devicesData.data;
                deviceCache[agentId] = devices;  // Cache the devices for this agent
                renderDeviceList(devices);
            })
            .catch(error => {
                console.error(`Error fetching devices for agent ${agentId}:`, error);
                devicesListElement.textContent = `Failed to load devices for ${agentName}.`;
            });
    }

    // Render device list, add click events for displaying additional details, and sort devices
    function renderDeviceList(devices) {
        // Sort devices by status (online first) and then by display name alphabetically
        devices.sort((a, b) => {
            if (a.status === 'ONLINE' && b.status !== 'ONLINE') return -1;
            if (a.status !== 'ONLINE' && b.status === 'ONLINE') return 1;
            return a.display_name.localeCompare(b.display_name);
        });

        devices.forEach(device => {
            const deviceItem = document.createElement('div');
            deviceItem.textContent = device.display_name;
            deviceItem.classList.add('device-item');

            // Determine status text and color class
            const statusSpan = document.createElement('span');
            statusSpan.classList.add('device-status');

            switch (device.status) {
                case 'ONLINE':
                    statusSpan.textContent = 'Online';
                    statusSpan.classList.add('online');
                    break;
                case 'OFFLINE':
                    statusSpan.textContent = 'Offline';
                    statusSpan.classList.add('offline');
                    break;
                case 'DOWN':
                    statusSpan.textContent = 'Down';
                    statusSpan.classList.add('down');
                    break;
                case 'UNKNOWN':
                    statusSpan.textContent = 'Unknown';
                    statusSpan.classList.add('unknown');
                    break;
                default:
                    statusSpan.textContent = 'Error';
                    statusSpan.classList.add('error');
                    break;
            }

            // Add the status to the device item
            deviceItem.appendChild(statusSpan);
            
            // Add event listener to display additional details inline on click
            deviceItem.addEventListener('click', () => toggleDeviceDetails(deviceItem, device));
            
            // Append device item to the devices list
            devicesListElement.appendChild(deviceItem);
        });
    }

    // Toggle display of additional details for a selected device inline
    function toggleDeviceDetails(deviceItem, device) {
        // Check if details are already displayed
        const existingDetails = deviceItem.querySelector('.device-details');
        if (existingDetails) {
            existingDetails.remove();
            return;  // Hide details if they were already shown
        }

        // Create a new details container
        const detailsElement = document.createElement('div');
        detailsElement.classList.add('device-details');
        detailsElement.innerHTML = `
            <p><strong>IP Address:</strong> ${device.ip_addresses[0] || 'N/A'}</p>
            <p><strong>HW Address:</strong> ${device.hw_address || 'N/A'}</p>
            <p><strong>Last Status Change:</strong> ${device.last_status_change || 'N/A'}</p>
        `;

        // Insert the details right after the device item
        deviceItem.appendChild(detailsElement);
    }
});

