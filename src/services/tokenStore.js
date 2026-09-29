let tokenData = null;

function setTokenData(data) {
    tokenData = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || tokenData?.refreshToken,
        apiDomain: data.api_domain || process.env.ZOHO_API_DOMAIN,
        tokenType: data.token_type || 'Bearer',
        expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000,
    };
}

function getTokenData() {
    return tokenData;
}

function updateAccessToken(data) {
    if (!tokenData) throw new Error('Zoho authentication is required');
    tokenData = {
        ...tokenData,
        accessToken: data.access_token,
        apiDomain: data.api_domain || tokenData.apiDomain || process.env.ZOHO_API_DOMAIN,
        tokenType: data.token_type || tokenData.tokenType || 'Bearer',
        expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000,
    };
}

function clearTokenData() {
    tokenData = null;
}

module.exports = {
    setTokenData,
    getTokenData,
    updateAccessToken,
    clearTokenData,
};
