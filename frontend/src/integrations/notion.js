import { useState, useEffect } from 'react';
import {
    Box,
    Button,
    CircularProgress,
    Typography,
    TextField,
} from '@mui/material';
import axios from 'axios';
import { DataTable } from './shared/DataTable';
import { useIntegrationData } from './hooks/useIntegrationData';

export const NotionIntegration = ({ user, org, integrationParams, setIntegrationParams }) => {
    // Connection state
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);

    // Search state
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);

    // Use shared data hook
    const { allItems, dataLoading, fetchAllItems, clearData } = useIntegrationData('Notion', integrationParams?.credentials);

    // OAuth Connection Handler
    const handleConnectClick = async () => {
        try {
            setIsConnecting(true);
            const formData = new FormData();
            formData.append('user_id', user);
            formData.append('org_id', org);
            const response = await axios.post(`http://localhost:8001/integrations/notion/authorize`, formData);
            const authURL = response?.data;

            const newWindow = window.open(authURL, 'Notion Authorization', 'width=600, height=600');

            // Polling for the window to close
            const pollTimer = window.setInterval(() => {
                if (newWindow?.closed !== false) { 
                    window.clearInterval(pollTimer);
                    handleWindowClosed();
                }
            }, 200);
        } catch (e) {
            setIsConnecting(false);
            alert(e?.response?.data?.detail || 'Connection failed');
        }
    };

    // Handle OAuth window close
    const handleWindowClosed = async () => {
        try {
            const formData = new FormData();
            formData.append('user_id', user);
            formData.append('org_id', org);
            const response = await axios.post(`http://localhost:8001/integrations/notion/credentials`, formData);
            const credentials = response.data; 
            
            if (credentials) {
                setIsConnected(true);
                setIntegrationParams(prev => ({ ...prev, credentials: credentials, type: 'Notion' }));
                // Auto-load data after successful connection
                await fetchAllItems(credentials);
            }
        } catch (e) {
            alert(e?.response?.data?.detail || 'Failed to retrieve credentials');
        } finally {
            setIsConnecting(false);
        }
    };

    // Handle search
    const handleSearch = async () => {
        if (!integrationParams?.credentials || !searchQuery) return;

        setSearchLoading(true);
        try {
            const formData = new FormData();
            formData.append('credentials', JSON.stringify(integrationParams.credentials));
            formData.append('query', searchQuery);
            const response = await axios.post('http://localhost:8001/integrations/notion/search', formData);
            setSearchResults(response.data);
        } catch (e) {
            alert(e?.response?.data?.detail || 'Search failed');
        } finally {
            setSearchLoading(false);
        }
    };

    // Clear data
    const handleClearData = () => {
        clearData();
        setSearchResults([]);
        setSearchQuery("");
    };

    // Handle search input change
    const handleSearchChange = (e) => {
        const value = e.target.value;
        setSearchQuery(value);
        if (value === "") {
            setSearchResults([]);
        }
    };

    // Clear search
    const clearSearch = () => {
        setSearchQuery("");
        setSearchResults([]);
    };

    // Initialize connection state
    useEffect(() => {
        const connected = !!integrationParams?.credentials;
        setIsConnected(connected);
    }, [integrationParams]);

    // Determine what data to show
    const tableData = searchQuery && searchResults.length > 0 ? searchResults : allItems;
    const isLoading = dataLoading || searchLoading;
    const emptyMessage = searchQuery ? 'No results found for your search' : 'No data available';

    return (
        <Box sx={{ mt: 2 }}>
            <Typography variant="h6" gutterBottom>
                Notion Integration
            </Typography>

            {/* Connection Controls */}
            <Box display="flex" alignItems="center" justifyContent="center" sx={{ mt: 2, gap: 2, flexWrap: 'wrap' }}>
                <Button
                    variant="contained"
                    onClick={handleConnectClick}
                    color={isConnected ? 'success' : 'primary'}
                    disabled={isConnecting}
                    style={{
                        pointerEvents: isConnected ? 'none' : 'auto',
                        cursor: isConnected ? 'default' : 'pointer'
                    }}
                >
                    {isConnected ? 'Notion Connected' :
                     isConnecting ? <CircularProgress size={20} /> : 'Connect to Notion'}
                </Button>

                {isConnected && (
                    <Button
                        variant="outlined"
                        color="warning"
                        onClick={handleConnectClick}
                        disabled={isConnecting}
                    >
                        Reconnect
                    </Button>
                )}
            </Box>

            {/* Data Controls */}
            {isConnected && (
                <Box display="flex" alignItems="center" justifyContent="center" sx={{ mt: 2, gap: 2, flexWrap: 'wrap' }}>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={() => fetchAllItems()}
                        disabled={dataLoading}
                    >
                        {dataLoading ? <CircularProgress size={20} /> : 'Load Data'}
                    </Button>

                    <Button
                        variant="outlined"
                        color="secondary"
                        onClick={handleClearData}
                        disabled={isLoading}
                    >
                        Clear Data
                    </Button>
                </Box>
            )}

            {/* Search Controls */}
            {isConnected && (
                <Box sx={{ mt: 3, mb: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                    <TextField
                        label="Search Notion"
                        value={searchQuery}
                        onChange={handleSearchChange}
                        size="small"
                        sx={{ minWidth: 200 }}
                    />
                    <Button
                        variant="contained"
                        onClick={handleSearch}
                        disabled={searchLoading || !searchQuery}
                    >
                        {searchLoading ? <CircularProgress size={20} /> : 'Search'}
                    </Button>
                    {searchQuery && (
                        <Button
                            variant="outlined"
                            onClick={clearSearch}
                            size="small"
                        >
                            Clear
                        </Button>
                    )}
                </Box>
            )}

            {/* Data Table */}
            {isConnected && (
                <DataTable
                    data={tableData}
                    loading={isLoading}
                    emptyMessage={emptyMessage}
                />
            )}
        </Box>
    );
};