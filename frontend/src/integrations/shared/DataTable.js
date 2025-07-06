import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Tooltip,
    Typography,
    LinearProgress,
    Box
} from '@mui/material';

export const DataTable = ({ data, loading, emptyMessage = "No data available" }) => {
    if (loading) {
        return (
            <Box sx={{ width: '100%', mt: 2 }}>
                <LinearProgress />
            </Box>
        );
    }

    if (!data || data.length === 0) {
        return (
            <TableContainer component={Paper} sx={{ mt: 2, maxHeight: 400, maxWidth: '100%', overflowX: 'auto' }}>
                <Table stickyHeader>
                    <TableHead>
                        <TableRow>
                            <TableCell><strong>NAME</strong></TableCell>
                            <TableCell><strong>TYPE</strong></TableCell>
                            <TableCell><strong>EMAIL</strong></TableCell>
                            <TableCell><strong>CREATED DATE</strong></TableCell>
                            <TableCell><strong>API RESPONSE</strong></TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        <TableRow>
                            <TableCell colSpan={5} align="center">
                                <Typography variant="body2" color="text.secondary">
                                    {emptyMessage}
                                </Typography>
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </TableContainer>
        );
    }

    return (
        <TableContainer component={Paper} sx={{ mt: 2, maxHeight: 400, maxWidth: '100%', overflowX: 'auto' }}>
            <Table stickyHeader>
                <TableHead>
                    <TableRow>
                        <TableCell><strong>NAME</strong></TableCell>
                        <TableCell><strong>TYPE</strong></TableCell>
                        <TableCell><strong>EMAIL</strong></TableCell>
                        <TableCell><strong>CREATED DATE</strong></TableCell>
                        <TableCell><strong>API RESPONSE</strong></TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {data.map((item, idx) => (
                        <TableRow key={item.id || idx} hover>
                            <TableCell>{item.name || '-'}</TableCell>
                            <TableCell>{item.type || '-'}</TableCell>
                            <TableCell>{item.email || '-'}</TableCell>
                            <TableCell>
                                {item.creation_time ? new Date(item.creation_time).toLocaleString() : '-'}
                            </TableCell>
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
    );
};
