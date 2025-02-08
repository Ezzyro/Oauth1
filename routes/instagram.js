// routes/instagram.js
const express = require('express');

const router = express.Router();

router.get('/comments', (req, res) => {
    const comments = commentStore.getAll();
    res.json(comments);
});

module.exports = router;
