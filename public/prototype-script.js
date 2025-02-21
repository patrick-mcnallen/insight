document.addEventListener('DOMContentLoaded', () => {
    const agentsListElement = document.getElementById('agents-list');
    const devicesListElement = document.getElementById('devices-list');
    const lastApiCallElement = document.getElementById('last-api-call');

    let selectedAgentElement = null;
    let currentSortingCriteria = 'name'; // Default sorting criteria
    let currentSearchQuery = ''; // Default search query
    let hideOldConflicts = false; // Default checkbox state

    // Add sorting dropdown menu
    const sortingDropdown = document.createElement('select');
    sortingDropdown.id = 'sorting-dropdown';
    sortingDropdown.innerHTML = `
        <option value="name">Name</option>
        <option value="room">Room</option>
        <option value="zone">Zone</option>
        <option value="type">Type</option>
        <option value="ip">IP Address</option>
        <option value="mac">MAC Address</option>
    `;
    sortingDropdown.addEventListener('change', (event) => {
        currentSortingCriteria = event.target.value;
        // Re-render devices with the new sorting criteria
        if (selectedAgentElement) {
            const agentId = selectedAgentElement.dataset.agentId;
            const agentName = selectedAgentElement.textContent;
            displayDevices(agentId, agentName);
        }
    });

    // Add search input field
    const searchInput = document.createElement('input');
    searchInput.id = 'search-input';
    searchInput.type = 'text';
    searchInput.placeholder = 'Search by MAC/IP/Name';
    searchInput.addEventListener('input', (event) => {
        currentSearchQuery = event.target.value.toLowerCase();
        // Re-render devices with the current search query
        if (selectedAgentElement) {
            const agentId = selectedAgentElement.dataset.agentId;
            const agentName = selectedAgentElement.textContent;
            displayDevices(agentId, agentName);
        }
    });

    // Add checkbox to hide old IP conflicts
    const conflictCheckbox = document.createElement('input');
    conflictCheckbox.id = 'hide-old-conflicts';
    conflictCheckbox.type = 'checkbox';
    const conflictLabel = document.createElement('label');
    conflictLabel.htmlFor = 'hide-old-conflicts';
    conflictLabel.textContent = 'Hide IP Conflicts past 24 hours';

    conflictCheckbox.addEventListener('change', (event) => {
        hideOldConflicts = event.target.checked;
        // Re-render devices with the updated filter
        if (selectedAgentElement) {
            const agentId = selectedAgentElement.dataset.agentId;
            const agentName = selectedAgentElement.textContent;
            displayDevices(agentId, agentName);
        }
    });

    const controlsContainer = document.createElement('div');
    controlsContainer.style.display = 'flex';
    controlsContainer.style.gap = '10px';
    controlsContainer.style.justifyContent = 'center';
    controlsContainer.style.marginBottom = '10px';
    controlsContainer.appendChild(sortingDropdown);
    controlsContainer.appendChild(searchInput);
    controlsContainer.appendChild(conflictCheckbox);
    controlsContainer.appendChild(conflictLabel);
    devicesListElement.before(controlsContainer);

    // Fetch and display agents with accurate last fetched timestamp
    fetch('/agent')
        .then(response => response.json())
        .then(agentData => {
            const lastFetchedTime = agentData.lastFetched;
            lastApiCallElement.textContent = `Last API call: ${new Date(lastFetchedTime).toLocaleString()}`;
            
            const agents = agentData.data;
            agents.forEach(agent => {
                const agentItem = document.createElement('div');
                agentItem.textContent = agent.display_name;
                agentItem.className = 'agent-item';
                agentItem.dataset.agentId = agent.id;
                agentItem.addEventListener('click', () => {
                    displayDevices(agent.id, agent.display_name);
                    highlightSelectedAgent(agentItem);
                });
                agentsListElement.appendChild(agentItem);
            });
        })
        .catch(error => {
            console.error('Error fetching agents:', error);
            agentsListElement.textContent = 'Failed to load agents.';
        });

    function highlightSelectedAgent(agentItem) {
        if (selectedAgentElement) {
            selectedAgentElement.classList.remove('selected-agent');
        }
        agentItem.classList.add('selected-agent');
        selectedAgentElement = agentItem;
    }

    function displayDevices(agentId, agentName) {
        devicesListElement.innerHTML = `<h2>Devices for ${agentName}</h2>`;
        fetch(`/agent/${agentId}/device`)
            .then(response => response.json())
            .then(devicesData => {
                const lastFetchedTime = devicesData.lastFetched;
                lastApiCallElement.textContent = `Last API call: ${new Date(lastFetchedTime).toLocaleString()}`;

                const devices = devicesData.data;
                renderDeviceList(devices);
            })
            .catch(error => {
                console.error(`Error fetching devices for agent ${agentId}:`, error);
                devicesListElement.textContent = `Failed to load devices for ${agentName}.`;
            });
    }

    function renderDeviceList(devices) {
        devicesListElement.innerHTML = '';

        // Define expected statuses and initialize device groups
        const statuses = ["Down", "Online", "Offline", "Hidden", "Error"];
        const deviceGroups = {
            Down: [],
            Online: [],
            Offline: [],
            Hidden: [],
            Error: []
        };

        // Filter devices based on the search query
        const filteredDevices = devices.filter(device => {
            const name = device.display_name?.toLowerCase() || '';
            const ip = device.ip_addresses[0]?.toLowerCase() || '';
            const mac = device.hw_address?.toLowerCase() || '';
            return name.includes(currentSearchQuery) || ip.includes(currentSearchQuery) || mac.includes(currentSearchQuery);
        });

        if (filteredDevices.length === 0) {
            devicesListElement.innerHTML = '<p>No matching devices found.</p>';
            return;
        }

        // Filter out devices with conflicts older than 24 hours if checkbox is checked
        const recentDevices = filteredDevices.filter(device => {
            const lastStatusChange = new Date(device.last_status_change);
            const now = new Date();
            const diffHours = (now - lastStatusChange) / 1000 / 60 / 60;
            return !hideOldConflicts || diffHours <= 24;
        });

        // Detect IP conflicts only among recent devices
        const ipConflictMap = {};
        recentDevices.forEach(device => {
            const ip = device.ip_addresses[0];
            if (ip) {
                if (!ipConflictMap[ip]) {
                    ipConflictMap[ip] = [];
                }
                ipConflictMap[ip].push(device);
            }
        });

        // Highlight devices with IP conflicts
        Object.keys(ipConflictMap).forEach(ip => {
            if (ipConflictMap[ip].length > 1) {
                ipConflictMap[ip].forEach(device => {
                    device.hasIpConflict = true;
                });
            }
        });

        // Group devices by status
        recentDevices.forEach(device => {
            const status = device.status ? device.status.toLowerCase() : 'error';
            const normalizedStatus = status.charAt(0).toUpperCase() + status.slice(1);

            if (deviceGroups[normalizedStatus]) {
                deviceGroups[normalizedStatus].push(device);
            } else {
                deviceGroups.Error.push(device);
            }
        });

        // Sort devices within each status group based on the selected criteria
        const sortingFunctions = {
            name: (a, b) => {
                const aValue = a.display_name || '';
                const bValue = b.display_name || '';
                if (!aValue) return 1;
                if (!bValue) return -1;
                return aValue.localeCompare(bValue);
            },
            room: (a, b) => {
                const aValue = a.details?.room || '';
                const bValue = b.details?.room || '';
                if (!aValue) return 1;
                if (!bValue) return -1;
                return aValue.localeCompare(bValue);
            },
            zone: (a, b) => {
                const aValue = a.details?.zone || '';
                const bValue = b.details?.zone || '';
                if (!aValue) return 1;
                if (!bValue) return -1;
                return aValue.localeCompare(bValue);
            },
            type: (a, b) => {
                const aValue = a.user_data?.type || '';
                const bValue = b.user_data?.type || '';
                if (!aValue) return 1;
                if (!bValue) return -1;
                return aValue.localeCompare(bValue);
            },
            ip: (a, b) => {
                const aValue = a.ip_addresses[0] || '';
                const bValue = b.ip_addresses[0] || '';
                if (!aValue) return 1;
                if (!bValue) return -1;
                return aValue.localeCompare(bValue);
            },
            mac: (a, b) => {
                const aValue = a.hw_address || '';
                const bValue = b.hw_address || '';
                if (!aValue) return 1;
                if (!bValue) return -1;
                return aValue.localeCompare(bValue);
            }
        };

        statuses.forEach(status => {
            if (deviceGroups[status].length > 0) {
                deviceGroups[status].sort(sortingFunctions[currentSortingCriteria]);

                // Create collapsible containers for each status group
                const header = document.createElement('div');
                header.className = 'device-status-header';
                header.textContent = `${status} (${deviceGroups[status].length})`;
                header.addEventListener('click', () => header.classList.toggle('active'));

                const container = document.createElement('div');
                container.className = 'device-status-container';

                deviceGroups[status].forEach(device => {
                    const deviceItem = document.createElement('div');
                    deviceItem.className = 'device-item';

                    const deviceNameContainer = document.createElement('div');
                    deviceNameContainer.className = 'device-name-container';

                    const deviceName = document.createElement('span');
                    deviceName.textContent = device.display_name;
                    deviceNameContainer.appendChild(deviceName);

                    const sortedProperty = document.createElement('span');
                    sortedProperty.className = 'sorted-property';
                    sortedProperty.textContent = getSortedPropertyValue(device, currentSortingCriteria);
                    deviceNameContainer.appendChild(sortedProperty);

                    // Status indicator
                    const statusSpan = document.createElement('span');
                    statusSpan.classList.add('device-status', device.status.toLowerCase());
                    statusSpan.textContent = device.status;

                    deviceItem.appendChild(deviceNameContainer);
                    deviceItem.appendChild(statusSpan);

                    // Add IP conflict indicator if applicable
                    if (device.hasIpConflict) {
                        const conflictIcon = document.createElement('span');
                        conflictIcon.className = 'ip-conflict-icon';
                        conflictIcon.title = 'IP Conflict Detected';
                        conflictIcon.textContent = '⚠️';

                        deviceItem.appendChild(conflictIcon);
                    }

                    // Add click event to toggle device details
                    deviceItem.addEventListener('click', () => {
                        const existingDetails = deviceItem.querySelector('.device-details');
                        if (existingDetails) {
                            existingDetails.remove();
                            deviceItem.classList.remove('device-item-expanded');
                            sortedProperty.style.display = 'block'; // Show the sorted property
                        } else {
                            const detailsElement = document.createElement('div');
                            detailsElement.className = 'device-details';
                            detailsElement.innerHTML = `
                                <p><strong>IP Address:</strong> ${device.ip_addresses[0] || 'N/A'} <button class="copy-button" data-value="${device.ip_addresses[0]}">Copy</button></p>
                                <p><strong>HW Address:</strong> ${device.hw_address || 'N/A'} <button class="copy-button" data-value="${device.hw_address}">Copy</button></p>
                                <p><strong>Room:</strong> ${(device.details?.room) || 'N/A'}</p>
                                <p><strong>Zone:</strong> ${(device.details?.zone) || 'N/A'}</p>
                                <p><strong>Type:</strong> ${(device.user_data?.type) || 'N/A'}</p>
                                <p><strong>Last Status Change:</strong> ${device.last_status_change || 'N/A'}</p>
                            `;
                            deviceItem.appendChild(detailsElement);
                            deviceItem.classList.add('device-item-expanded');
                            sortedProperty.style.display = 'none'; // Hide the sorted property
                        }
                    });

                    container.appendChild(deviceItem);
                });

                devicesListElement.appendChild(header);
                devicesListElement.appendChild(container);
            }
        });
    }

    function getSortedPropertyValue(device, criteria) {
        switch (criteria) {
            case 'room':
                return device.details?.room || 'N/A';
            case 'zone':
                return device.details?.zone || 'N/A';
            case 'type':
                return device.user_data?.type || 'N/A';
            case 'ip':
                return device.ip_addresses[0] || 'N/A';
            case 'mac':
                return device.hw_address || 'N/A';
            default:
                return device.display_name || 'N/A';
        }
    }

    // Add event listener for all copy buttons with capturing phase
    devicesListElement.addEventListener('click', (event) => {
        if (event.target.classList.contains('copy-button')) {
            event.stopPropagation(); // Prevent collapsing the device
            const valueToCopy = event.target.dataset.value;
            if (valueToCopy) {
                navigator.clipboard.writeText(valueToCopy)
                    .then(() => {
                        alert(`Copied: ${valueToCopy}`);
                    })
                    .catch((err) => {
                        console.error('Failed to copy text: ', err);
                    });
            }
        }
    }, true); // Use capturing phase
});
