const passport = require('passport');
const FacebookStrategy = require('passport-facebook').Strategy;
const fetch = require('node-fetch');

const FACEBOOK_CONFIG = {
    clientID: process.env.FACEBOOK_APP_ID || '1075738087575726',
    clientSecret: process.env.FACEBOOK_APP_SECRET || 'c84a108b21a4fd3c4a39a797784d0130',
    callbackURL: process.env.FACEBOOK_CALLBACK_URL || 'https://9470-2401-4900-883b-45ba-5a6-b237-745-ff43.ngrok-free.app/auth/facebook/callback',
    profileFields: ['id', 'displayName', 'email']
};

// Function to exchange short-lived token for long-lived token
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

// Function to fetch Instagram accounts for a Facebook page
async function getInstagramAccountsForPage(pageId, pageAccessToken) {
    try {
        console.log(`Fetching Instagram account for page ${pageId} with token: ${pageAccessToken.substring(0, 10)}...`);
        
        // First try to get the basic Instagram business account info
        const basicResponse = await fetch(
            `https://graph.facebook.com/v18.0/${pageId}?fields=instagram_business_account{id,username,profile_picture_url,name}&access_token=${pageAccessToken}`
        );
        
        const basicData = await basicResponse.json();
        console.log('Basic Instagram fetch response:', basicData);

        if (!basicResponse.ok) {
            console.error('Basic fetch error:', basicData);
            throw new Error(`Failed to fetch basic Instagram data: ${basicData.error?.message}`);
        }

        // If no Instagram account found, try detailed fetch
        if (!basicData.instagram_business_account) {
            console.log('No basic Instagram account found, trying detailed fetch...');
            
            const detailedResponse = await fetch(
                `https://graph.facebook.com/v18.0/${pageId}?fields=connected_instagram_account,instagram_accounts,instagram_business_account{id,username,profile_picture_url,name,profile_pic}&access_token=${pageAccessToken}`
            );
            
            const detailedData = await detailedResponse.json();
            console.log('Detailed Instagram fetch response:', detailedData);

            // Check if we have any Instagram data in any form
            const instagramAccount = detailedData.instagram_business_account || 
                                   detailedData.connected_instagram_account ||
                                   (detailedData.instagram_accounts?.data || [])[0];

            if (!instagramAccount) {
                // Get debug information about the token
                const debugResponse = await fetch(
                    `https://graph.facebook.com/debug_token?input_token=${pageAccessToken}&access_token=${pageAccessToken}`
                );
                const debugData = await debugResponse.json();
                console.log('Token debug data:', debugData);
                
                console.log('No Instagram account found for this page. Permissions granted:', debugData.data?.scopes);
            }

            return instagramAccount || null;
        }

        return basicData.instagram_business_account;
    } catch (error) {
        console.error(`Error fetching Instagram account for page ${pageId}:`, error);
        return null;
    }
}

passport.use(new FacebookStrategy({
        ...FACEBOOK_CONFIG,
        scope: [
            'email',
            'public_profile',
            'pages_show_list',
            'pages_read_engagement',
            'instagram_basic',
            'instagram_content_publish',
            'pages_manage_metadata',
            'business_management',
            'instagram_manage_insights',
            'pages_manage_posts',
            'instagram_manage_messages',
            'instagram_manage_comments'
        ]
    },
    async function(accessToken, refreshToken, profile, done) {
        try {
            console.log('Starting authentication process...');
            
            // Exchange short-lived token for long-lived token
            const longLivedToken = await exchangeForLongLivedToken(accessToken);
            console.log('Long-lived token obtained');
            
            // Fetch pages data using the long-lived token
            const pagesResponse = await fetch(
                `https://graph.facebook.com/v18.0/me/accounts?access_token=${longLivedToken}`
            );

            if (!pagesResponse.ok) {
                const errorData = await pagesResponse.json();
                console.error('Pages fetch error:', errorData);
                throw new Error(`Failed to fetch pages: ${errorData.error?.message || 'Unknown error'}`);
            }

            const pagesData = await pagesResponse.json();
            console.log('Pages fetched:', pagesData);

            if (!pagesData.data || !Array.isArray(pagesData.data)) {
                console.error('Invalid pages data received:', pagesData);
                throw new Error('Invalid pages data received');
            }

            // Fetch Instagram accounts for each page
            const pagesWithInstagram = await Promise.all(
                pagesData.data.map(async (page) => {
                    try {
                        const instagramAccount = await getInstagramAccountsForPage(
                            page.id,
                            page.access_token
                        );
                        return {
                            ...page,
                            instagram_account: instagramAccount
                        };
                    } catch (error) {
                        console.error(`Error processing page ${page.id}:`, error);
                        return page;
                    }
                })
            );

            console.log('Final pages data:', pagesWithInstagram);

            // Add tokens and pages data to the profile object
            profile.accessToken = accessToken;
            profile.longLivedToken = longLivedToken;
            profile.pages = pagesWithInstagram;

            return done(null, profile);
        } catch (error) {
            console.error('Error in authentication process:', error);
            return done(error);
        }
    }
));

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((user, done) => {
    done(null, user);
});

module.exports = passport;