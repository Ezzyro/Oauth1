// controllers/instagramController.js
const fetch = require('node-fetch');
const instagramService = require('../services/instagramService');

const instagramController = {
    async subscribeToComments(req, res) {
        if (!req.user || !req.user.pages) {
            return res.status(401).json({ error: 'Not authenticated or no pages available' });
        }

        try {
            const results = [];
            
            // Subscribe to comments for each Instagram business account
            for (const page of req.user.pages) {
                if (page.instagram_account) {
                    const subscriptionResponse = await instagramService.subscribeToComments(page.access_token, page.instagram_account.id, 'v18.0');
                    results.push({
                        instagram_id: page.instagram_account.id,
                        success: subscriptionResponse.success === true,
                        data: subscriptionResponse
                    });
                }
            }

            res.json({
                message: 'Subscription requests processed',
                results
            });
        } catch (error) {
            console.error('Error subscribing to comments:', error);
            res.status(500).json({ error: error.message });
        }
    },

    // Add method to store comments in MongoDB
    async storeComment(comment) {
        try {
            const Comment = require('../models/Comment');
            const newComment = new Comment(comment);
            await newComment.save();
            return newComment;
        } catch (error) {
            console.error('Error storing comment:', error);
            throw error;
        }
    }
};

module.exports = instagramController;
