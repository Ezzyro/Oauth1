// config/facebook.js
const FACEBOOK_CONFIG = {
    clientID: process.env.FACEBOOK_APP_ID || '1075738087575726',
    clientSecret: process.env.FACEBOOK_APP_SECRET || 'c84a108b21a4fd3c4a39a797784d0130',
    callbackURL: process.env.FACEBOOK_CALLBACK_URL || 'https://9470-2401-4900-883b-45ba-5a6-b237-745-ff43.ngrok-free.app/auth/facebook/callback',
    profileFields: ['id', 'displayName', 'email']
};

const REQUIRED_PERMISSIONS = [
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
];

module.exports = {
    FACEBOOK_CONFIG,
    REQUIRED_PERMISSIONS
};