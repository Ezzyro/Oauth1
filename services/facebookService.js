// services/facebookService.js
const fetch = require('node-fetch');

class FacebookService {
    async getPages(accessToken) {
        try {
            const response = await fetch(
                `https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}`
            );

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Failed to fetch pages: ${errorData.error?.message}`);
            }

            const data = await response.json();
            return data.data;
        } catch (error) {
            console.error('Error fetching pages:', error);
            throw error;
        }
    }

    async getPageDetails(pageId, accessToken) {
        try {
            const response = await fetch(
                `https://graph.facebook.com/v18.0/${pageId}?fields=id,name,category,access_token&access_token=${accessToken}`
            );

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Failed to fetch page details: ${errorData.error?.message}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`Error fetching page details for ${pageId}:`, error);
            throw error;
        }
    }

    async getConnectedInstagramAccount(pageId, pageAccessToken) {
        try {
            const response = await fetch(
                `https://graph.facebook.com/v18.0/${pageId}?fields=instagram_business_account{id,username,profile_picture_url,name}&access_token=${pageAccessToken}`
            );

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Failed to fetch Instagram account: ${errorData.error?.message}`);
            }

            const data = await response.json();
            return data.instagram_business_account || null;
        } catch (error) {
            console.error(`Error fetching Instagram account for page ${pageId}:`, error);
            throw error;
        }
    }
}

module.exports = new FacebookService();