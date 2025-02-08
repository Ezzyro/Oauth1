require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = socketIo(server);
global.io = io;

// Import configurations
require('./config/passport');

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('Client connected');
    
    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// Import middleware
const errorHandler = require('./middleware/errorHandler');




// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

const webhookRouter = require('./routes/webhooks');
app.use('/', webhookRouter);
const instagramRoutes = require('./routes/instagram');
app.use('/instagram', instagramRoutes);

// Basic routes
app.get('/', (req, res) => {
    res.redirect('/login');
});

app.use('/webhook', express.raw({ type: 'application/json' }));

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

// Facebook authentication routes
app.get('/auth/facebook', passport.authenticate('facebook', {
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
}));

app.get('/auth/facebook/callback',
    passport.authenticate('facebook', { failureRedirect: '/login' }),
    (req, res) => {
        res.redirect('/profile');
    }
);

app.get('/profile', (req, res) => {
    if (!req.user) return res.redirect('/login');
    res.render('profile', { 
        user: req.user,
        tokens: {
            shortLived: req.user.accessToken,
            longLived: req.user.longLivedToken
        }
    });
});

app.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            console.error('Error during logout:', err);
            return res.redirect('/profile');
        }
        res.redirect('/login');
    });
});
app.get('/debug/page/:pageId', async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const { pageId } = req.params;
        const page = req.user.pages.find(p => p.id === pageId);

        if (!page) {
            return res.status(404).json({ error: 'Page not found' });
        }

        // Check page access token
        const debugResponse = await fetch(
            `https://graph.facebook.com/debug_token?input_token=${page.access_token}&access_token=${page.access_token}`
        );
        const debugData = await debugResponse.json();

        // Check page permissions
        const permissionsResponse = await fetch(
            `https://graph.facebook.com/v18.0/${pageId}/permissions?access_token=${page.access_token}`
        );
        const permissionsData = await permissionsResponse.json();

        // Check Instagram Business Account connection
        const instagramResponse = await fetch(
            `https://graph.facebook.com/v18.0/${pageId}?fields=instagram_business_account,connected_instagram_account&access_token=${page.access_token}`
        );
        const instagramData = await instagramResponse.json();

        res.json({
            page: {
                id: page.id,
                name: page.name,
                category: page.category
            },
            tokenDebug: debugData,
            permissions: permissionsData,
            instagramConnection: instagramData
        });
    } catch (error) {
        console.error('Debug error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Debug route to check all permissions
app.get('/debug/permissions', async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        // Check user token permissions
        const userDebugResponse = await fetch(
            `https://graph.facebook.com/debug_token?input_token=${req.user.accessToken}&access_token=${req.user.accessToken}`
        );
        const userDebugData = await userDebugResponse.json();

        // Get all permissions granted to the app
        const permissionsResponse = await fetch(
            `https://graph.facebook.com/v18.0/me/permissions?access_token=${req.user.accessToken}`
        );
        const permissionsData = await permissionsResponse.json();

        res.json({
            userToken: {
                tokenInfo: userDebugData,
                grantedPermissions: permissionsData
            },
            requiredPermissions: REQUIRED_PERMISSIONS,
            missingPermissions: REQUIRED_PERMISSIONS.filter(
                perm => !permissionsData.data?.find(p => p.permission === perm && p.status === 'granted')
            )
        });
    } catch (error) {
        console.error('Permissions debug error:', error);
        res.status(500).json({ error: error.message });
    }
});
// Error handling middleware
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
