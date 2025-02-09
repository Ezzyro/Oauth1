const fs = require('fs').promises;
const path = require('path');

const dataFilePath = path.join(__dirname, 'commentStoreData.json');

class CommentStore {
    constructor() {
        this.comments = [];
        this.loadComments();
    }

    async loadComments() {
        try {
            const data = await fs.readFile(dataFilePath, 'utf8');
            this.comments = JSON.parse(data);
            console.log('Comments loaded from file:', this.comments);
        } catch (error) {
            console.log('Error loading comments from file (likely non-existent):', error.message);
            this.comments = []; // Initialize to empty array if file doesn't exist or is invalid
        }
    }

    async saveComments() {
        try {
            await fs.writeFile(dataFilePath, JSON.stringify(this.comments, null, 2), 'utf8');
            console.log('Comments saved to file:', this.comments);
        } catch (error) {
            console.error('Error saving comments to file:', error);
        }
    }

    async add(comment) {
        this.comments.unshift(comment);
        await this.saveComments(); // Save comments after adding
        if (global.io) {
            global.io.emit('newComment', comment);
        }
        return comment;
    }

    async getAll() {
        return this.comments;
    }
}

module.exports = new CommentStore();
