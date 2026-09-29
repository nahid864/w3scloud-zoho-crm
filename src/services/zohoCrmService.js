const axios = require('axios');
const { getTokenData, updateAccessToken } = require('./tokenStore');
const { refreshAccessToken } = require('./zohoAuthService');

const LEAD_FIELDS = 'Full_Name,First_Name,Last_Name,Email,Company,Phone';

async function getValidAccessToken(forceRefresh = false) {
    const token = getTokenData();
    if (!token) throw new Error('Zoho authentication is required');
    if (!token.refreshToken) throw new Error('Zoho refresh token is unavailable; authorize again');
    if (forceRefresh || !token.accessToken || token.expiresAt <= Date.now() + 60_000) {
        const refreshed = await refreshAccessToken(token.refreshToken);
        if (!refreshed.access_token) throw new Error('Zoho token refresh did not return an access token');
        updateAccessToken(refreshed);
    }
    return getTokenData();
}

// Every CRM request refreshes proactively and retries an unauthorized request once.
async function crmRequest(method, path, options = {}) {
    let token = await getValidAccessToken();
    const send = (current) => axios({
        method,
        url: `${current.apiDomain}/crm/v8/${path}`,
        ...options,
        headers: {
            ...options.headers,
            Authorization: `Zoho-oauthtoken ${current.accessToken}`,
        },
    });
    try {
        return await send(token);
    } catch (error) {
        if (error.response?.status !== 401) throw error;
        token = await getValidAccessToken(true);
        return send(token);
    }
}

function dataOf(response) {
    return response.status === 204 ? { data: [] } : response.data;
}

async function getLeads() {
    return dataOf(await crmRequest('get', 'Leads', { params: { fields: LEAD_FIELDS, per_page: 20 } }));
}

async function getLeadById(leadId) {
    return dataOf(await crmRequest('get', `Leads/${encodeURIComponent(leadId)}`, { params: { fields: LEAD_FIELDS } }));
}

async function searchLeadByEmail(email) {
    return dataOf(await crmRequest('get', 'Leads/search', { params: { email, fields: LEAD_FIELDS } }));
}

async function createLead(leadData) {
    return dataOf(await crmRequest('post', 'Leads', { data: { data: [leadData] } }));
}

module.exports = { getLeads, getLeadById, searchLeadByEmail, createLead, getValidAccessToken };
