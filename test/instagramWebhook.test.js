const request = require('supertest');
const app = require('../server');
const mongoose = require('mongoose');
const Comment = require('../models/commentStore');

describe('Instagram Webhook', () => {
  beforeAll(async () => {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/test', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  });

  afterAll(async () => {
    // Disconnect from MongoDB
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clear the database before each test
    await Comment.deleteMany({});
  });

  it('should handle a new comment event', async () => {
    const commentData = {
      object: 'instagram',
      entry: [
        {
          id: '1234567890',
          time: 1672531200,
          changes: [
            {
              field: 'comments',
              value: {
                id: '123',
                text: 'Test comment',
                from: {
                  username: 'testuser',
                },
                timestamp: 1672531200,
                media: {
                  id: '456',
                },
              },
            },
          ],
        },
      ],
    };

    const response = await request(app)
      .post('/webhook')
      .send(commentData)
      .expect(200);

    expect(response.text).toBe('EVENT_RECEIVED');

    // Check if the comment is stored in the database
    const comment = await Comment.findOne({ id: '123' });
    expect(comment).toBeDefined();
    expect(comment.text).toBe('Test comment');
    expect(comment.username).toBe('testuser');
    expect(comment.mediaId).toBe('456');
  });
});
