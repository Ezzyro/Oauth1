// commentStore.js
class CommentStore {
    constructor() {
        this.comments = [];
    }

    async add(comment) {
        this.comments.unshift(comment);
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