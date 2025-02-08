// routes/auth.js
const express = require('express');
const passport = require('passport');
const { REQUIRED_PERMISSIONS } = require('../config/facebook');
const router = express.Router();

router.get('/facebook', passport.authenticate('facebook', {
    scope: REQUIRED_PERMISSIONS
}));

router.get('/facebook/callback',
    passport.authenticate('facebook', { 
        failureRedirect: '/login',
        failureMessage: true
    }),
    (req, res) => {
        res.redirect('/profile');
    }
);

router.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            console.error('Error during logout:', err);
            return res.redirect('/profile');
        }
        res.redirect('/login');
    });
});

module.exports = router;