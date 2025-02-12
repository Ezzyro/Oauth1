const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const axios = require('axios');
const commentStore = require('../models/commentStore');

// Middleware to capture raw body
router.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));
const repliedComments = new Set();
let isProcessing = false;



async function replyToComment(commentId, message, accessToken) {
    try {
        const response = await axios.post(
            `https://graph.facebook.com/v22.0/${commentId}/replies`,
            null,
            {
                params: {
                    message: message,
                    access_token: accessToken
                }
            }
        );
        console.log('Reply posted successfully:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error posting reply:', error.response?.data || error);
        throw error;
    }
}

async function sendDirectMessage(userId, message, accessToken) {
    try {
        const response = await axios.post(
            'https://graph.instagram.com/v21.0/me/messages',
            {
                recipient: {
                    id: userId
                },
                message: {
                    text: message
                }
            },
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        console.log('Direct message sent successfully:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error sending direct message:', error.response?.data || error);
        throw error;
    }
}

// GET endpoint for webhook verification
router.get('/webhook', (req, res) => {
    try {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        console.log('Verification request received:', { mode, token });

        if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
            console.log('Webhook verified successfully');
            return res.status(200).send(challenge);
        }

        console.warn('Webhook verification failed');
        return res.sendStatus(403);
    } catch (error) {
        console.error('Error during verification:', error);
        return res.sendStatus(500);
    }
});

// Function to get media details from Instagram API
async function getMediaDetails(mediaId, accessToken) {
    try {
        const response = await axios.get(
            `https://graph.instagram.com/${mediaId}`,
            {
                params: {
                    fields: 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,username,comments_count,like_count',
                    access_token: accessToken
                }
            }
        );
        return response.data;
    } catch (error) {
        console.error('Error fetching media details:', error.response?.data || error);
        throw error;
    }
}

// POST endpoint for receiving webhook events
router.post('/webhook', async (req, res) => {
    try {
        console.log('Raw webhook event received:', req.body);

        if (req.body.object === 'instagram') {
            const entry = req.body.entry[0];

            // Handle messaging events
            if (entry.messaging) {
                console.log('Received messaging event:', entry.messaging);
                const messagingEvent = entry.messaging[0];
                const senderId = messagingEvent.sender.id;
                const recipientId = messagingEvent.recipient.id;

                // Handle incoming messages
                if (messagingEvent.message && !messagingEvent.message.quick_reply) {
                    try {
                        await sendQuickReply(
                            recipientId,
                            senderId,
                            process.env.INSTAGRAM_ACCESS_TOKEN
                        );
                    } catch (error) {
                        console.error('Error sending quick reply:', error);
                    }
                }

                // Handle quick reply responses
                if (messagingEvent.message && messagingEvent.message.quick_reply) {
                    const payload = messagingEvent.message.quick_reply.payload;
                    console.log('Quick reply payload received:', payload);
                    // Handle different payloads here
                }
            }

            // Handle changes events
            if (entry.changes && Array.isArray(entry.changes)) {
                for (const change of entry.changes) {
                    console.log('Processing change:', change);

                    if (change.field === 'comments') {
                        try {
                            const commentId = change.value.id;
                            const commentText = change.value.text;
                            const userID = change.value.from.id; // Get the user's Instagram ID
                            const username = change.value.from.username;

                            // Skip if this is our own reply
                            if (username === "yourbrainbooster") {
                                console.log('Skipping our own reply');
                                continue;
                            }

                            // Check if we've already handled this comment
                            if (repliedComments.has(commentId)) {
                                console.log('Already replied to this comment:', commentId);
                                continue;
                            }

                            console.log('New comment received:', {
                                id: commentId,
                                text: commentText,
                                userId: userID
                            });

                            try {
                                // Send a direct message to the user
                                await sendDirectMessage(
                                    userID,
                                    "Hey there thanks for the comment",
                                    process.env.INSTAGRAM_ACCESS_TOKEN
                                );
                                console.log('Direct message sent to user:', userID);

                                // Reply to the comment
                                const replyResponse = await replyToComment(
                                    commentId,
                                    "Hey please check your dm",
                                    process.env.ACCESS_TOKEN
                                );
                                console.log('Reply sent successfully:', replyResponse);

                                repliedComments.add(commentId);

                                setTimeout(() => {
                                    repliedComments.delete(commentId);
                                }, 24 * 60 * 60 * 1000);

                            } catch (replyError) {
                                if (replyError.response?.data?.error?.code === 100) {
                                    console.log('Skipping reply to a reply');
                                } else {
                                    console.error('Error handling response:', replyError.response?.data);
                                }
                            }
                        } catch (error) {
                            console.error('Error handling comment:', error);
                        }
                    }
                    if (change.field === 'media') {
                        try {
                            const mediaId = change.value.id;
                            const mediaDetails = await getMediaDetails(mediaId, process.env.INSTAGRAM_ACCESS_TOKEN);

                            console.log('Complete media details:', {
                                id: mediaDetails.id,
                                caption: mediaDetails.caption,
                                mediaType: mediaDetails.media_type,
                                mediaUrl: mediaDetails.media_url,
                                thumbnailUrl: mediaDetails.thumbnail_url,
                                permalink: mediaDetails.permalink,
                                timestamp: mediaDetails.timestamp,
                                username: mediaDetails.username,
                                commentsCount: mediaDetails.comments_count,
                                likeCount: mediaDetails.like_count
                            });

                            // Handle different media types
                            switch (mediaDetails.media_type) {
                                case 'IMAGE':
                                    console.log('Processing image post');
                                    // Add your image handling logic here
                                    break;
                                case 'VIDEO':
                                    console.log('Processing video post');
                                    // Add your video handling logic here
                                    break;
                                case 'CAROUSEL_ALBUM':
                                    console.log('Processing carousel post');
                                    // Add your carousel handling logic here
                                    break;
                                default:
                                    console.log('Unknown media type:', mediaDetails.media_type);
                            }
                        } catch (error) {
                            console.error('Error processing media:', error);
                        }
                    }
                }
            }

            res.status(200).send('EVENT_RECEIVED');
        } else {
            res.sendStatus(404);
        }
    } catch (error) {
        console.error('Error processing webhook:', error);
        res.sendStatus(500);
    }
});
router.post('/setup-page-subscription', async (req, res) => {
    try {
        const { pageId, accessToken } = req.body;
        
        if (!pageId || !accessToken) {
            return res.status(400).json({ 
                error: 'Missing required parameters: pageId and accessToken' 
            });
        }

        console.log('Setting up page subscription for page:', pageId);

        const response = await axios.post(
            `https://graph.facebook.com/v18.0/${pageId}/subscribed_apps`,
            null,
            {
                params: {
                    access_token: accessToken,
                    subscribed_fields: 'feed,messages,messaging_postbacks'
                }
            }
        );

        console.log('Subscription response:', response.data);
        res.json(response.data);
    } catch (error) {
        console.error('Error setting up page subscription:', error.response?.data || error);
        res.status(500).json({ 
            error: 'Failed to setup page subscription',
            details: error.response?.data || error.message
        });
    }
});

module.exports = router;