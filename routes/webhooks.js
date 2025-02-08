// routes/webhooks.js
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const instagramController = require('../controllers/instagramController');
const commentStore = require('../models/commentStore');
const sortKeysRecursive = require('sort-keys-recursive');

// Webhook verification middleware
// routes/webhooks.js
router.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));

const rawBodyMiddleware = (req, res, next) => {
    let data = '';
    req.setEncoding('utf8');

    req.on('data', chunk => {
        data += chunk;
    });

    req.on('end', () => {
        req.rawBody = data;
        next();
    });
};


const verifyWebhook = (req, res, next) => {
    // Handle GET requests for webhook verification
    if (req.method === 'GET') {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        console.log('Verification request:', { mode, token, challenge });

        if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
            console.log('Webhook verified successfully');
            return res.status(200).send(challenge);
        } else {
            console.log('Webhook verification failed');
            return res.sendStatus(403);
        }
    }

    // Handle POST requests (actual webhook events)
    const signature = req.headers['x-hub-signature-256'];
    
    if (!signature) {
        console.error('No signature found in headers');
        return res.status(401).send('No signature');
    }

    try {
        const webhookSecret = process.env.WEBHOOK_SECRET;
        // Convert body to buffer if it isn't already
        const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
        
        const expectedSignature = 'sha256=' + 
            crypto.createHmac('sha256', webhookSecret)
                .update(buf)
                .digest('hex');

        console.log('Signature verification:', {
            received: signature,
            expected: expectedSignature
        });

        if (signature === expectedSignature) {
            // Parse the raw body for later use
            req.body = JSON.parse(buf.toString());
            next();
        } else {
            console.error('Invalid signature');
            return res.status(401).send('Invalid signature');
        }
    } catch (error) {
        console.error('Verification error:', error);
        return res.status(401).send('Verification failed');
    }
};

// Webhook verification endpoint
router.get('/webhook', verifyWebhook, (req, res) => {
    // This handles the verification challenge
    res.status(200).send(req.query['hub.challenge']);
});

// Webhook event handler
// routes/webhooks.js
router.post('/webhook', rawBodyMiddleware, (req, res) => {
    try {
        console.log('===== WEBHOOK DEBUG START =====');
        console.log('1. Request Headers:', {
            signature: req.headers['x-hub-signature-256'],
            contentType: req.headers['content-type']
        });

        const signature = req.headers['x-hub-signature-256'];
        const webhookSecret = process.env.WEBHOOK_SECRET;
        const rawBody = req.rawBody;

        console.log('2. Component Check:', {
            hasSignature: !!signature,
            hasSecret: !!webhookSecret,
            hasBody: !!rawBody,
            bodyLength: rawBody?.length,
            rawBody: rawBody // Log the raw body for debugging
        });

        if (!signature || !webhookSecret || !rawBody) {
            console.log('Missing required components');
            return res.status(401).send('Missing required components');
        }

        // Calculate expected signature using raw body
        const expectedSignature = 'sha256=' + 
            crypto.createHmac('sha256', webhookSecret)
                .update(rawBody)
                .digest('hex');

        console.log('3. Signature Comparison:', {
            received: signature,
            expected: expectedSignature,
            match: signature === expectedSignature
        });

        if (signature === expectedSignature) {
            // Parse the raw body
            const parsedBody = JSON.parse(rawBody);
            console.log('4. Parsed Webhook Payload:', parsedBody);

            const { object, entry } = parsedBody;
            
            if (object === 'instagram') {
                for (const event of entry) {
                    if (event.changes) {
                        for (const change of event.changes) {
                            if (change.field === 'comments') {
                                console.log('New comment:', change.value);
                            }
                        }
                    }
                }
                res.status(200).send('EVENT_RECEIVED');
            } else {
                res.sendStatus(404);
            }
        } else {
            console.log('Signature verification failed');
            res.status(401).send('Invalid signature');
        }

        console.log('===== WEBHOOK DEBUG END =====');

    } catch (error) {
        console.error('Webhook Error:', {
            message: error.message,
            stack: error.stack
        });
        res.status(500).send('Internal server error');
    }
});


// Comment handler
async function handleInstagramComment(commentData) {
    try {
        const comment = {
            id: commentData.id,
            text: commentData.text,
            username: commentData.username,
            timestamp: commentData.timestamp,
            mediaId: commentData.media.id
        };

        // Store in MongoDB
        const savedComment = await instagramController.storeComment(comment);

        // Emit event for real-time updates
        if (global.io) {
            global.io.emit('newComment', savedComment);
        }
    } catch (error) {
        console.error('Error handling comment:', error);
        throw error;
    }
}
// Add this debug endpoint
router.get('/webhook-debug', (req, res) => {
    const verifyToken = process.env.VERIFY_TOKEN;
    const webhookSecret = process.env.WEBHOOK_SECRET;
    
    res.json({
        verifyTokenSet: !!verifyToken,
        webhookSecretSet: !!webhookSecret,
        headers: req.headers,
        url: req.url
    });
});


const subscribeToWebhook = async (req, res) => {
    try {
        const response = await fetch(
            `https://graph.facebook.com/v18.0/${req.user.pages[0].instagram_account.id}/subscribed_apps`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    access_token: req.user.pages[0].access_token,
                    subscribed_fields: ['comments'],
                    callback_url: `${process.env.BASE_URL}/webhook`,
                    verify_token: process.env.VERIFY_TOKEN
                })
            }
        );

        const data = await response.json();
        console.log('Subscription response:', data);
        res.json(data);
    } catch (error) {
        console.error('Subscription error:', error);
        res.status(500).json({ error: error.message });
    }
};

router.get('/test-webhook-secret', (req, res) => {
    const testMessage = 'test_message';
    const secret = process.env.WEBHOOK_SECRET;
    
    try {
        const signature = crypto
            .createHmac('sha256', secret)
            .update(testMessage)
            .digest('hex');

        res.json({
            secretExists: !!secret,
            secretLength: secret?.length,
            testSignature: signature,
            testMessage: testMessage
        });
    } catch (error) {
        res.json({
            error: error.message,
            secretExists: !!secret,
            secretLength: secret?.length
        });
    }
});
router.post('/webhook-test', rawBodyMiddleware, (req, res) => {
    console.log('Test webhook received:', {
        rawBody: req.rawBody,
        signature: req.headers['x-hub-signature-256'],
        headers: req.headers
    });
    res.status(200).send('Test received');
});
router.post('/subscribe', subscribeToWebhook);
module.exports = router;
