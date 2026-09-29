const axios = require('axios');

async function exchangeAuthorizationCode(code) {
    const params = new URLSearchParams({
        client_id: process.env.ZOHO_CLIENT_ID,
        client_secret: process.env.ZOHO_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.ZOHO_REDIRECT_URI,
    });

    const response = await axios.post(
        `${process.env.ZOHO_ACCOUNTS_URL}/oauth/v2/token`,
        null,
        {
            params,
        }
    );

    return response.data;
}

async function refreshAccessToken(refreshToken) {
    const params = new URLSearchParams({
        client_id: process.env.ZOHO_CLIENT_ID,
        client_secret: process.env.ZOHO_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
    });

    const response = await axios.post(
        `${process.env.ZOHO_ACCOUNTS_URL}/oauth/v2/token`,
        null,
        {
            params,
        }
    );

    return response.data;
}

module.exports = {
    exchangeAuthorizationCode,
    refreshAccessToken,
};
