const routes = require('./routes.js');
const multer = require('multer');
const storage = multer.memoryStorage()
const upload = multer({storage: storage });

module.exports = {
    register_routes
}

function register_routes(app) {
    app.get('/hello', routes.get_helloworld);
    app.post('/login', routes.post_login);
    app.post('/register', routes.post_register); 
    app.post('/:username/updateProfile',routes.update_profile);
    app.get('/logout', routes.post_logout); 
    app.get('/:username/friends', routes.get_friends);
    app.get('/:username/recommendations', routes.get_friend_recs);
    app.post('/:username/createPost', upload.single('image'), routes.create_post); 
    app.get('/:username/feed', routes.get_feed); 
    app.post('/:username/movies', routes.get_movie);
    app.post('/:username/:chat_id/leave', routes.chat_leave);
    app.post('/:username/:chat_id/add', routes.chat_add);
    app.post('/:username/:chat_id/message',routes.chat_message);
    app.post('/:username/follow', routes.follow);
    app.post('/:username/unfollow',routes.unfollow);
    app.get('/:username/search',routes.search);
    app.get('/:username/getActors', upload.single('image'), routes.get_actors);

  }
  