// utils/tokenUtils.js
const fetch = require('node-fetch');
const { FACEBOOK_CONFIG } = require('../config/facebook');

async function exchangeForLongLivedToken(shortLivedToken) {
    try {
        const response = await fetch(
            `https://graph.facebook.com/v18.0/oauth/access_token?` +
            `grant_type=fb_exchange_token&` +
            `client_id=${FACEBOOK_CONFIG.clientID}&` +
            `client_secret=${FACEBOOK_CONFIG.clientSecret}&` +
            `fb_exchange_token=${shortLivedToken}`
        );

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Token exchange error:', errorData);
            throw new Error(`Token exchange failed: ${errorData.error?.message || 'Unknown error'}`);
        }

        const data = await response.json();
        return data.access_token;
    } catch (error) {
        console.error('Error exchanging token:', error);
        throw error;
    }
}

async function verifyToken(accessToken) {
    try {
        const response = await fetch(
            `https://graph.facebook.com/debug_token?` +
            `input_token=${accessToken}&` +
            `access_token=${accessToken}`
        );
        
        const data = await response.json();
        return data.data;
    } catch (error) {
        console.error('Error verifying token:', error);
        throw error;
    }
}

module.exports = {
    exchangeForLongLivedToken,
    verifyToken
};