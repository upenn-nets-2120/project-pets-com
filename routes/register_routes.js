const routes = require('./routes.js');
const multer = require('multer');
const storage = multer.memoryStorage()
const upload = multer({storage: storage });
const otherRoutes= require('./comment_like_routes.js')
const faceRoutes= require('./face_api_routes.js')
const chromaRoutes= require('./chroma_routes.js')
const websocketRoutes = require('./websocket_routes.js')
module.exports = {
    register_routes
}

function register_routes(app) {
    app.use(routes.set_time); // for friends
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
    app.get('/:username/get_chats', routes.get_chats); 
    app.get('/:username/get_invites', routes.get_invites); 
    app.post('/:username/get_messages', routes.get_messages); 
    app.post('/:username/chat_create', routes.chat_create);
    app.post('/:username/chat_handle_invite', routes.chat_handle_invite);
    app.post('/:username/chat_leave', routes.chat_leave);
    app.post('/:username/chat_invite', routes.chat_invite);
    app.post('/:username/chat_message',routes.chat_message);
    app.post('/:username/follow', routes.follow);
    app.post('/:username/unfollow',routes.unfollow);
    app.post('/:username/addLike', otherRoutes.addLike)
    app.post('/:username/addComment', otherRoutes.addComment)
    app.get('/:username/:post_id/getLike', otherRoutes.getLike)
    app.get('/:username/:post_id/getComments', otherRoutes.getComments)
    app.post('/:username/unLike', otherRoutes.unLike )
    app.get('/topHashtags', otherRoutes.topHashtags)
    app.get('/:username/getHashtags', otherRoutes.getHashtags)
    app.post('/:username/changeHashtags', otherRoutes.changeHashtags)
    app.post('/:username/getActors', upload.single('image'), faceRoutes.getActors); 
    app.post('/:username/linkActor', faceRoutes.linkActor); 
    app.get('/:username/getLinks', faceRoutes.getLinks); 
    app.ws('/', websocketRoutes.websocket); //everything about user and web sockets
    app.post('/:username/search', chromaRoutes.search);
  }
  