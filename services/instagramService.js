const axios = require('axios');

const subscribeToComments = async (accessToken, pageId, apiVersion) => {
  try {
    const response = await axios.post(
      `https://graph.facebook.com/v${apiVersion}/${pageId}/subscribed_apps`,
      {
        subscribed_fields: ['comments'],
        access_token: accessToken,
      }
    );
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Error subscribing to comments:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

module.exports = {
  subscribeToComments,
};
