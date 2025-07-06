import { useState, useEffect } from 'react';
import axios from 'axios';

export const useIntegrationData = (integrationType, credentials) => {
    const [allItems, setAllItems] = useState([]);
    const [dataLoading, setDataLoading] = useState(false);
    const [initialLoad, setInitialLoad] = useState(true);

    const endpointMapping = {
        'Notion': 'notion',
        'Airtable': 'airtable',
        'HubSpot': 'hubspot',
    };

    const fetchAllItems = async (creds = null) => {
        const credentialsToUse = creds || credentials;
        if (!credentialsToUse || !integrationType) return;

        const endpoint = endpointMapping[integrationType];
        if (!endpoint) return;

        setDataLoading(true);
        try {
            const formData = new FormData();
            formData.append('credentials', JSON.stringify(credentialsToUse));
            const response = await axios.post(`http://localhost:8001/integrations/${endpoint}/load`, formData);
            setAllItems(response.data);
            setInitialLoad(false);
        } catch (e) {
            alert(e?.response?.data?.detail || 'Failed to load data');
        } finally {
            setDataLoading(false);
        }
    };

    const clearData = () => {
        setAllItems([]);
    };

    useEffect(() => {
        if (credentials && initialLoad) {
            fetchAllItems();
        }
    }, [credentials, initialLoad]);

    return {
        allItems,
        dataLoading,
        fetchAllItems,
        clearData
    };
};