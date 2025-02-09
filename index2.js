require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const xhub = require('express-x-hub');
const axios = require('axios');
const app = express();

// App configuration
app.set('port', (process.env.PORT || 3000));

// Middleware
app.use(xhub({ algorithm: 'sha1', secret: process.env.FACEBOOK_APP_SECRET }));
app.use(bodyParser.json());

// Store received updates
const received_updates = [];

// Debug endpoint to check if server is running
app.get('/status', (req, res) => {
    res.json({
        status: 'online',
        timestamp: new Date().toISOString(),
        env: {
            hasAppSecret: !!process.env.FACEBOOK_APP_SECRET,
            hasVerifyToken: !!process.env.VERIFY_TOKEN
        }
    });
});

// Setup Instagram subscriptions endpoint
app.post('/setup', async (req, res) => {
    try {
        console.log('Received setup request:', req.body);
        
        const { pageId, accessToken } = req.body;
        
        if (!pageId || !accessToken) {
            return res.status(400).json({ 
                error: 'Missing required parameters',
                required: ['pageId', 'accessToken'],
                received: Object.keys(req.body)
            });
        }

        // First, subscribe to the page
        const pageSubscriptionUrl = `https://graph.facebook.com/v22.0/${pageId}/subscribed_apps`;
        console.log('Setting up page subscription:', pageSubscriptionUrl);

        const pageResponse = await axios.post(
            pageSubscriptionUrl,
            null,
            {
                params: {
                    access_token: accessToken,
                    subscribed_fields: 'feed,mention'  // Valid fields from the API
                }
            }
        );

        console.log('Page subscription response:', pageResponse.data);

        // Now set up Instagram webhook subscription
        const webhookSubscriptionUrl = 'https://graph.facebook.com/v22.0/app/subscriptions';
        console.log('Setting up webhook subscription:', webhookSubscriptionUrl);

        const webhookResponse = await axios.post(
            webhookSubscriptionUrl,
            null,
            {
                params: {
                    access_token: accessToken,
                    object: 'instagram',
                    callback_url: `https://a452-2401-4900-883a-dfc0-e4fe-dcce-d95e-c114.ngrok-free.app/instagram`,
                    fields: 'mentions,comments',
                    verify_token: process.env.VERIFY_TOKEN
                }
            }
        );

        console.log('Webhook subscription response:', webhookResponse.data);

        res.json({
            success: true,
            pageSubscription: pageResponse.data,
            webhookSubscription: webhookResponse.data,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Setup error:', {
            message: error.message,
            response: error.response?.data,
            stack: error.stack
        });
        
        res.status(500).json({ 
            error: 'Failed to setup subscriptions',
            details: error.response?.data || error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Instagram webhook endpoint
app.post('/instagram', function(req, res) {
    console.log('Received Instagram webhook:', req.body);
    
    try {
        // Store update
        received_updates.unshift({
            timestamp: new Date().toISOString(),
            data: req.body
        });

        if (req.body.object === 'instagram') {
            req.body.entry.forEach(entry => {
                if (entry.changes) {
                    entry.changes.forEach(change => {
                        console.log('Processing change:', change);
                        // Handle the change based on its field
                    });
                }
            });
        }

        res.sendStatus(200);
    } catch (error) {
        console.error('Error processing webhook:', error);
        res.sendStatus(200);  // Always return 200 for webhooks
    }
});

// Webhook verification endpoint
app.get('/instagram', function(req, res) {
    console.log('Verification request:', {
        mode: req.query['hub.mode'],
        token: req.query['hub.verify_token'],
        challenge: req.query['hub.challenge']
    });

    if (
        req.query['hub.mode'] === 'subscribe' &&
        req.query['hub.verify_token'] === process.env.VERIFY_TOKEN
    ) {
        console.log('✅ Webhook verified');
        res.send(req.query['hub.challenge']);
    } else {
        console.warn('❌ Verification failed');
        res.sendStatus(400);
    }
});

// Home page showing received updates
app.get('/', function(req, res) {
    res.send(`
        <h1>Instagram Webhook Status</h1>
        <p>Server is running and processing webhooks.</p>
        <h2>Last ${received_updates.length} Updates:</h2>
        <pre>${JSON.stringify(received_updates, null, 2)}</pre>
    `);
});

// Start server
app.listen(app.get('port'), () => {
    console.log(`\n🚀 Server is running on port ${app.get('port')}`);
    console.log('📝 Environment check:');
    console.log('- FACEBOOK_APP_SECRET:', process.env.FACEBOOK_APP_SECRET ? '✅ Set' : '❌ Missing');
    console.log('- VERIFY_TOKEN:', process.env.VERIFY_TOKEN ? '✅ Set' : '❌ Missing');
    console.log('\n📍 Available endpoints:');
    console.log('- GET  /status         - Check server status');
    console.log('- POST /setup          - Setup page subscriptions');
    console.log('- GET  /instagram      - Webhook verification');
    console.log('- POST /instagram      - Receive webhooks');
    console.log('- GET  /               - View received updates');
});

module.exports = app;