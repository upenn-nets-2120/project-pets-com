const dbaccess = require('./db_access');
const config = require('../config.json'); // Load configuration

function sendQueryOrCommand(db, query, params = []) {
    return new Promise((resolve, reject) => {
      db.query(query, params, (err, results) => {
        if (err) {
          reject(err);
        } else {
          resolve(results);
        }
      });
    });
  }

async function create_tables(db) {
  // These tables should already exist from prior homeworks.
  // We include them in case you need to recreate the database.

  // You'll need to define the names table.
  // var qa = db.create_tables('...');

  //TODO: Create actors table
  var q1 = db.create_tables('CREATE TABLE IF NOT EXISTS actors ( \
    actor_id VARCHAR(10) PRIMARY KEY, \
    actor_name VARCHAR(255), \
    birthYear int, \
    deathYear int, \
    nconst_short VARCHAR(10) \
    );')

  // TODO: create users table
  var q2 = db.create_tables('CREATE TABLE IF NOT EXISTS users ( \
    user_id int PRIMARY KEY NOT NULL AUTO_INCREMENT, \
    username VARCHAR(255), \
    hashed_password VARCHAR(255), \
    email VARCHAR(225), \
    affiliation VARCHAR(225), \
    birthday VARCHAR(225), \
    firstName VARCHAR(225), \
    lastName VARCHAR (225), \
    photo_id VARCHAR(225), \
    actor_id VARCHAR(10), \
    FOREIGN KEY (actor_id) REFERENCES actors(actor_id) \
    );')

  //TODO: Create friends table
  var q3 = db.create_tables('CREATE TABLE IF NOT EXISTS friends ( \
    followed int, \
    follower int, \
    FOREIGN KEY (followed) REFERENCES users(user_id), \
    FOREIGN KEY (follower) REFERENCES users(user_id) \
    );')

  //TODO: Create socialRank table (SQL Maybe)
  //TODO: Create postRank table (SQL Maybe)

  // TODO: create posts table
  var q4 = db.create_tables('CREATE TABLE IF NOT EXISTS posts ( \
    post_id int PRIMARY KEY NOT NULL AUTO_INCREMENT, \
    author_id int, \
    title VARCHAR (255), \
    image_id VARCHAR (225), \
    captions VARCHAR (225), \
    FOREIGN KEY (author_id) REFERENCES users(user_id) \
    );')    

  //TODO: Create comments table 
  var q5 = db.create_tables('CREATE TABLE IF NOT EXISTS comments ( \
    comment_id int PRIMARY KEY NOT NULL AUTO_INCREMENT, \
    post_id int, \
    commenter_id int, \
    comment VARCHAR (225), \
    FOREIGN KEY (post_id) REFERENCES posts(post_id), \
    FOREIGN KEY (commenter_id) REFERENCES users(user_id) \
    );')

  //TODO: Create hashtags table
  var q6 = db.create_tables('CREATE TABLE IF NOT EXISTS hashtags ( \
    hashtag VARCHAR(225), \
    post_id int, \
    comment_id int, \
    follower_id int, \
    FOREIGN KEY (post_id) REFERENCES posts(post_id), \
    FOREIGN KEY (comment_id) REFERENCES comments(comment_id), \
    FOREIGN KEY (follower_id) REFERENCES users(user_id) \
    );')

  //TODO: Create likes table
  var q7 = db.create_tables('CREATE TABLE IF NOT EXISTS likes ( \
    post_id int, \
    liker_id int, \
    FOREIGN KEY (post_id) REFERENCES posts(post_id), \
    FOREIGN KEY (liker_id) REFERENCES users(user_id) \
    );')

  //TODO: Create chats table
  var q8 = db.create_tables('CREATE TABLE IF NOT EXISTS chats ( \
    chat_id int PRIMARY KEY NOT NULL AUTO_INCREMENT, \
    chat_name VARCHAR(255) \
    );')

  //TODO: Create chatters table
  var q9 = db.create_tables('CREATE TABLE IF NOT EXISTS chatters ( \
    PRIMARY KEY (chat_id, user_id), \
    chat_id int, \
    user_id int, \
    FOREIGN KEY (user_id) REFERENCES users(user_id), \
    FOREIGN KEY (chat_id) REFERENCES chats(chat_id) \
    );')


  //TODO: Create invites table
  var q10 = db.create_tables('CREATE TABLE IF NOT EXISTS invites ( \
    PRIMARY KEY (chat_id, user_id, inviter_id),\
    chat_id int, \
    user_id int, \
    inviter_id int, \
    FOREIGN KEY (chat_id) REFERENCES chats(chat_id), \
    FOREIGN KEY (user_id) REFERENCES users(user_id), \
    FOREIGN KEY (inviter_id) REFERENCES users(user_id) \
    );')

  //TODO: Create messages table
  var q11 = db.create_tables('CREATE TABLE IF NOT EXISTS messages ( \
    message_id int PRIMARY KEY NOT NULL AUTO_INCREMENT, \
    chat_id int, \
    author_id int, \
    timestamp int, \
    message VARCHAR(255), \
    FOREIGN KEY (chat_id) REFERENCES chats(chat_id), \
    FOREIGN KEY (author_id) REFERENCES users(user_id)\
    );')
  //DO ONCE, DONE ALREADY
  //var q12 = db.send_sql("LOAD DATA LOCAL INFILE 'models/names.csv' INTO TABLE actors FIELDS TERMINATED BY ',' ENCLOSED BY '\"' LINES TERMINATED BY '\n' IGNORE 1 ROWS (actor_name, birthYear, deathYear, actor_id, nconst_short);");

  //var q13 = db.send_sql("ALTER TABLE users DROP FOREIGN KEY users_ibfk_1;")

  var q14 = db.create_tables('CREATE TABLE IF NOT EXISTS userActorLink ( \
    username VARCHAR(255) NOT NULL, \
    actor_id VARCHAR(10), \
    FOREIGN KEY (actor_id) REFERENCES actors(actor_id) \
    );')

  var q15 = db.create_tables('CREATE TABLE IF NOT EXISTS timestamp ( \
    user_id int PRIMARY KEY, \
    timestamp VARCHAR(255), \
    FOREIGN KEY (user_id) REFERENCES users(user_id) \
    );')
  
  var q16 = db.create_tables('CREATE TABLE IF NOT EXISTS recommendations ( \
    PRIMARY KEY (user_id, recommendation, strength), \
    user_id int, \
    recommendation int, \
    strength int, \
    FOREIGN KEY (user_id) REFERENCES users(user_id), \
    FOREIGN KEY (recommendation) REFERENCES users(user_id) \
    );')
  return await Promise.all([q1, q2, q3, q4, q5, q6, q7, q8, q9, q10, q11, q14, q15]);
}

// Database connection setup
const db = dbaccess.get_db_connection();
var result = create_tables(dbaccess).then(() => {console.log('Tables created'); dbaccess.close_db();}).catch((err) => console.log(err));

const PORT = config.serverPort;


