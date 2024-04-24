const routes = require('./routes.js');

module.exports = {
    register_routes
}

function register_routes(app) {
    app.post('/:username/:chat_id/leave', routes.chat_leave);
    app.post('/:username/:chat_id/add', routes.chat_add);
    app.post('/:username/:chat_id/message',routes.chat_message);
    app.post('/:username/follow', routes.follow);
    app.post('/:username/unfollow',routes.unfollow);
    app.get('/:username/search',routes.search);
  }
  