import { useState, useEffect } from 'react';
import {
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Typography,
    TextField,
    Select,
    MenuItem,
} from '@mui/material';
import axios from 'axios';
import { DataTable } from './shared/DataTable';
import { useIntegrationData } from './hooks/useIntegrationData';

export const HubspotIntegration = ({ user, org, integrationParams, setIntegrationParams }) => {
    // Connection state
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);

    // Summary state
    const [summaryOpen, setSummaryOpen] = useState(false);
    const [summary, setSummary] = useState(null);
    const [summaryLoading, setSummaryLoading] = useState(false);

    // Search state
    const [searchQuery, setSearchQuery] = useState("");
    const [searchType, setSearchType] = useState("contacts");
    const [searchResults, setSearchResults] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);

    // Use shared data hook
    const { allItems, dataLoading, fetchAllItems, clearData } = useIntegrationData('HubSpot', integrationParams?.credentials);

    // OAuth Connection Handler
    const handleConnectClick = async () => {
        try {
            setIsConnecting(true);
            const formData = new FormData();
            formData.append('user_id', user);
            formData.append('org_id', org);
            const response = await axios.post(`http://localhost:8001/integrations/hubspot/authorize`, formData);
            const authURL = response?.data;

            const newWindow = window.open(authURL, 'HubSpot Authorization', 'width=600, height=600');

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
            const response = await axios.post(`http://localhost:8001/integrations/hubspot/credentials`, formData);
            const credentials = response.data;

            if (credentials) {
                setIsConnected(true);
                setIntegrationParams(prev => ({ ...prev, credentials: credentials, type: 'HubSpot' }));
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
            formData.append('type', searchType);
            const response = await axios.post('http://localhost:8001/integrations/hubspot/search', formData);
            setSearchResults(response.data);
        } catch (e) {
            alert(e?.response?.data?.detail || 'Search failed');
        } finally {
            setSearchLoading(false);
        }
    };

    // Handle summary
    const handleShowSummary = async () => {
        if (!integrationParams?.credentials) return;

        setSummaryLoading(true);
        try {
            const formData = new FormData();
            formData.append('credentials', JSON.stringify(integrationParams.credentials));
            const response = await axios.post('http://localhost:8001/integrations/hubspot/summary', formData);
            setSummary(response.data);
            setSummaryOpen(true);
        } catch (e) {
            alert(e?.response?.data?.detail || 'Failed to fetch summary');
        } finally {
            setSummaryLoading(false);
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
                HubSpot Integration
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
                    {isConnected ? 'HubSpot Connected' :
                     isConnecting ? <CircularProgress size={20} /> : 'Connect to HubSpot'}
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

                {isConnected && (
                    <Button
                        variant="outlined"
                        color="info"
                        onClick={handleShowSummary}
                        disabled={summaryLoading}
                    >
                        {summaryLoading ? <CircularProgress size={20} /> : 'Show Summary'}
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
                        {dataLoading ? <CircularProgress size={20} /> : 'Reload Data'}
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
                        label="Search HubSpot"
                        value={searchQuery}
                        onChange={handleSearchChange}
                        size="small"
                        sx={{ minWidth: 200 }}
                    />
                    <Select
                        value={searchType}
                        onChange={e => setSearchType(e.target.value)}
                        size="small"
                        sx={{ minWidth: 120 }}
                    >
                        <MenuItem value="contacts">Contacts</MenuItem>
                        <MenuItem value="companies">Companies</MenuItem>
                        <MenuItem value="deals">Deals</MenuItem>
                    </Select>
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

            {/* Summary Dialog */}
            <Dialog open={summaryOpen} onClose={() => setSummaryOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle>HubSpot Integration Summary</DialogTitle>
                <DialogContent>
                    {summary ? (
                        <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {JSON.stringify(summary, null, 2)}
                        </pre>
                    ) : (
                        <Typography>No summary data available.</Typography>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSummaryOpen(false)}>Close</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default HubspotIntegration;