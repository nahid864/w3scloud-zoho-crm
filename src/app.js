const express = require('express');
require('dotenv').config();

const { exchangeAuthorizationCode } = require('./services/zohoAuthService');

const { setTokenData } = require('./services/tokenStore');

const leadRoutes = require('./routes/leadRoutes');

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3000;

// Check required environment variables
const requiredEnv = [
    'ZOHO_CLIENT_ID',
    'ZOHO_CLIENT_SECRET',
    'ZOHO_REDIRECT_URI',
    'ZOHO_ACCOUNTS_URL',
    'ZOHO_API_DOMAIN',
];

for (const key of requiredEnv) {
    if (!process.env[key]) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
}

// Zoho CRM OAuth scopes
const ZOHO_SCOPES = [
    'ZohoCRM.modules.leads.READ',
    'ZohoCRM.modules.leads.CREATE',
    'ZohoCRM.settings.fields.READ',
].join(',');

// Home route
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'W3S Cloud Zoho CRM Integration API is running',
    });
});

// Lead routes
app.use('/api/leads', leadRoutes);

// Return malformed JSON as a client error instead of terminating the request.
app.use((error, req, res, next) => {
    if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
        return res.status(400).json({ success: false, message: 'Request body must contain valid JSON' });
    }
    return next(error);
});

// Start Zoho OAuth flow
app.get('/auth/zoho', (req, res) => {
    const params = new URLSearchParams({
        client_id: process.env.ZOHO_CLIENT_ID,
        response_type: 'code',
        redirect_uri: process.env.ZOHO_REDIRECT_URI,
        scope: ZOHO_SCOPES,
        access_type: 'offline',
        prompt: 'consent',
    });

    const authorizationUrl = `${process.env.ZOHO_ACCOUNTS_URL}/oauth/v2/auth?${params.toString()}`;

    res.redirect(authorizationUrl);
});

// Zoho OAuth callback
app.get('/auth/zoho/callback', async (req, res) => {
    const { code, error, error_description } = req.query;

    // Zoho returned an OAuth error
    if (error) {
        return res.status(400).json({
            success: false,
            error,
            message: error_description || 'Zoho authorization failed',
        });
    }

    // Authorization code missing
    if (!code) {
        return res.status(400).json({
            success: false,
            message: 'Authorization code was not received',
        });
    }

    try {
        // Exchange authorization code for access token and refresh token
        const tokenData = await exchangeAuthorizationCode(code);

        // Store token information in memory
        setTokenData(tokenData);

        return res.json({
            success: true,
            message: 'Zoho authentication completed successfully',
            token_type: tokenData.token_type,
            api_domain: tokenData.api_domain,
            expires_in: tokenData.expires_in,
            access_token_received: Boolean(tokenData.access_token),
            refresh_token_received: Boolean(tokenData.refresh_token),
        });
    } catch (error) {
        console.error('Zoho token exchange failed:', error.message);

        return res.status(500).json({
            success: false,
            message: 'Failed to exchange authorization code for tokens',
        });
    }
});

app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Endpoint not found' });
});

app.use((error, req, res, next) => {
    console.error('Unhandled request error:', error.message);
    res.status(500).json({ success: false, message: 'Unexpected server error' });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
