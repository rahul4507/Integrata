import { useState } from 'react';
import {
    Box,
    TextField,
    Button,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Tooltip
} from '@mui/material';
import axios from 'axios';

const endpointMapping = {
    'Notion': 'notion',
    'Airtable': 'airtable',
    'HubSpot': 'hubspot',
};

export const DataForm = ({ integrationType, credentials, hideForTypes = [] }) => {
    const [loadedData, setLoadedData] = useState(null);
    const endpoint = endpointMapping[integrationType];

    // Don't render if this integration type should be hidden
    if (hideForTypes.includes(integrationType)) {
        return null;
    }

    const handleLoad = async () => {
        try {
            const formData = new FormData();
            formData.append('credentials', JSON.stringify(credentials));
            const response = await axios.post(`http://localhost:8001/integrations/${endpoint}/load`, formData);
            const data = response.data;
            setLoadedData(data);
        } catch (e) {
            alert(e?.response?.data?.detail);
        }
    }

    return (
        <Box display='flex' justifyContent='center' alignItems='center' flexDirection='column' width='100%'>
            <Box display='flex' flexDirection='column' width='100%'>
                {/* Table rendering for loaded data */}
                {Array.isArray(loadedData) && loadedData.length > 0 && (
                    <TableContainer component={Paper} sx={{ mt: 2, maxHeight: 400, maxWidth: '100%', overflowX: 'auto' }}>
                        <Table stickyHeader>
                            <TableHead>
                                <TableRow>
                                    <TableCell>NAME</TableCell>
                                    <TableCell>TYPE</TableCell>
                                    <TableCell>EMAIL</TableCell>
                                    <TableCell>CREATED DATE</TableCell>
                                    <TableCell>API RESPONSE</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {loadedData.map((item, idx) => (
                                    <TableRow key={item.id || idx}>
                                        <TableCell>{item.name || '-'}</TableCell>
                                        <TableCell>{item.type || '-'}</TableCell>
                                        <TableCell>{item.email || '-'}</TableCell>
                                        <TableCell>{item.creation_time ? new Date(item.creation_time).toLocaleString() : '-'}</TableCell>
                                        <TableCell>
                                            <Tooltip
                                                title={
                                                    <pre style={{ maxWidth: 400, whiteSpace: 'pre-wrap', margin: 0 }}>
                                                        {JSON.stringify(item.api_response, null, 2)}
                                                    </pre>
                                                }
                                                arrow
                                                placement="left"
                                            >
                                                <span style={{ cursor: 'pointer', color: '#1976d2', textDecoration: 'underline' }}>
                                                    View JSON
                                                </span>
                                            </Tooltip>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
                {/* Fallback for no data */}
                {(!loadedData || (Array.isArray(loadedData) && loadedData.length === 0)) && (
                    <TextField
                        label="Loaded Data"
                        value={loadedData ? JSON.stringify(loadedData, null, 2) : ''}
                        sx={{mt: 2}}
                        InputLabelProps={{ shrink: true }}
                        multiline
                        minRows={4}
                        disabled
                    />
                )}
                <Button
                    onClick={handleLoad}
                    sx={{mt: 2}}
                    variant='contained'
                >
                    Load Data
                </Button>
                <Button
                    onClick={() => setLoadedData(null)}
                    sx={{mt: 1}}
                    variant='contained'
                >
                    Clear Data
                </Button>
            </Box>
        </Box>
    );
}