const { OpenAI, ChatOpenAI } = require("@langchain/openai");
const { PromptTemplate } = require("@langchain/core/prompts");
const { ChatPromptTemplate } = require("@langchain/core/prompts");
const { StringOutputParser } = require("@langchain/core/output_parsers");
const { CheerioWebBaseLoader } = require("langchain/document_loaders/web/cheerio");

const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const { OpenAIEmbeddings } = require("@langchain/openai");
const { MemoryVectorStore } = require("langchain/vectorstores/memory");
const { createStuffDocumentsChain } = require("langchain/chains/combine_documents");
const { Document } = require("@langchain/core/documents");
const { createRetrievalChain } = require("langchain/chains/retrieval");
const { formatDocumentsAsString } = require("langchain/util/document");
const {
    RunnableSequence,
    RunnablePassthrough,
  } = require("@langchain/core/runnables");
const { Chroma } = require("@langchain/community/vectorstores/chroma");

const dbsingleton = require('../models/db_access.js');
const config = require('../config.json'); // Load configuration
const bcrypt = require('bcrypt'); 
const helper = require('../routes/route_helper.js');
const { ConnectContactLens } = require("aws-sdk");
const {S3Client, PutObjectCommand} = require("@aws-sdk/client-s3");

//const { errorUtil } = require("zod/lib/helpers/errorUtil.js");

// Database connection setup
const db = dbsingleton;

const PORT = config.serverPort;
var vectorStore = null;

var getHelloWorld = function(req, res) {
    res.status(200).send({message: "Hello, world!"});
}


var getVectorStore = async function(req) {
    if (vectorStore == null) {
        vectorStore = await Chroma.fromExistingCollection(new OpenAIEmbeddings(), {
            collectionName: "imdb_reviews2",
            url: "http://localhost:8000", // Optional, will default to this value
            });
    }
    return vectorStore;
}


// POST /register 
var postRegister = async function(req, res) {
    // TODO: register a user with given body parameters

    // Step 1: Make sure all fields are provided

    if (!req.body) {
        return res.status(400).json({error: 'One or more of the fields you entered was empty, please try again.'});
    }

    if (!req.body.username || !req.body.password || !req.body.email || !req.body.affiliation || !req.body.birthday || !req.body.firstName || !req.body.lastName) {
        return res.status(400).json({error: 'One or more of the fields you entered was empty, please try again.'});
    }

    const usernameToCreate = req.body.username;
    const password = req.body.password;
    const email = req.body.email;
    const affiliation = req.body.affiliation;
    const birthday = req.body.birthday;
    const firstName = req.body.firstName;
    const lastName = req.body.lastName;

    // Step 2: Make sure forbidden characters are not used (to prevent SQL injection attacks).

    // Question -- It seems to me that emails must include @, and birthdays might include / Change function or not check?

    if (!helper.isOK(usernameToCreate) || !helper.isOK(password) || !helper.isOK(firstName) || !helper.isOK(lastName) || !helper.isOK(affiliation)) {
        return res.status(400).json({error: 'Potential injection attack detected: please do not use forbidden characters.'});
    }

    // Step 3: Make sure account doesn't already exist

    const checkUsernameQuery = `SELECT * FROM users WHERE username = '${usernameToCreate}'`;

    try {
        const results = await db.send_sql(checkUsernameQuery);
        
        if (results.length > 0) {
            return res.status(409).json({error: "An account with this username already exists, please try again."});
        } else {
            console.log("All good! You can proceed.")
        }
    } catch (error) {
        return res.status(500).json({error: 'Error querying database.', error});
    }

    // Step 4: Hash and salt the password! 

    helper.encryptPassword(password, async function(err, hashPassword) {
        if (err) {
            return res.status(500).json({error: 'Error querying database.', err});
        }
        const hashedPassword = hashPassword;

        // Step 5: Add to table

        const insertQuery = `
        INSERT INTO users (username, hashed_password, email, affiliation, birthday, firstName, lastName, photo_id, actor_id) 
        VALUES ('${usernameToCreate}', '${hashedPassword}', '${email}', '${affiliation}', '${birthday}', '${firstName}', '${lastName}', NULL, NULL);
        `;

        try {
            await db.insert_items(insertQuery);
            return res.status(200).json({ username: usernameToCreate });
        } catch(error) {
            return res.status(500).json({error: 'Error querying database.', error});
        }
    });
};


// POST /login
var postLogin = async function(req, res) {
    // TODO: check username and password and login

    //Step 1:  Make sure all fields are provided

    if (!req.body) {
        return res.status(400).json({error: 'One or more of the fields you entered was empty, please try again.'});
    };

    if (!req.body.username || !req.body.password) {
        return res.status(400).json({error: 'One or more of the fields you entered was empty, please try again.'});
    };

    const usernameGiven = req.body.username;
    const passwordGiven = req.body.password;

    // Step 2: Make sure forbidden characters are not used (to prevent SQL injection attacks).

    if (!helper.isOK(usernameGiven) || !helper.isOK(passwordGiven)) {
        return res.status(400).json({error: 'Potential injection attack detected: please do not use forbidden characters.'});
    }

    // Step 3: Use bcrypt to compare passwords. 

    const passwordRetrieveQuery = `SELECT hashed_password, user_id FROM users WHERE username = '${usernameGiven}';`;

    try {
        const result = await db.send_sql(passwordRetrieveQuery);
        if (result.length === 0) {
            return res.status(401).json({error: 'Username and/or password are invalid.'});
        }
        const actualPassword = result[0].hashed_password;
        try {
            const match = await bcrypt.compare(passwordGiven, actualPassword);
            if (match) {
                req.session.user_id = result[0].user_id; 
                req.session.username = usernameGiven; 
                return res.status(200).json({ username: usernameGiven });
            }
            else {
                return res.status(401).json({error: 'Username and/or password are invalid.'});
            }
        } catch(error) {
            return res.status(500).json({error: 'Error querying database.'});
        }
    } catch(error) {
        return res.status(500).json({error: 'Error querying database.'});
    }
};


// GET /logout
var postLogout = function(req, res) {
  // TODO: fill in log out logic to disable session info
  if (req.session.username == null){
    return res.status(400).json({error: 'No one is logged in.'});
  }
  req.session.username = null;
  req.session.user_id = null;
  return res.status(200).json( {message: "You were successfully logged out."} );
};


// GET /friends
var getFriends = async function(req, res) {
    // TODO: get all friends of current user

    // Step 1: Make sure the user is logged in.

    const username = req.params.username;

    if (username == null || !helper.isOK(username) || !helper.isLoggedIn(req, username)) {
        return res.status(403).json( {error: 'Not logged in.'} );
    }

    // Step 2: Get their friends (not necessarily registered users)

    const getFriendsQuery = `SELECT DISTINCT friends.followed AS followed, 
    followed_names.primaryName AS primaryName
    FROM users
    JOIN names ON users.linked_nconst = names.nconst
    JOIN friends ON friends.follower = names.nconst
    JOIN names AS followed_names ON friends.followed = followed_names.nconst
    WHERE users.username = '${username}';`;

    try {
        const results = await db.send_sql(getFriendsQuery);
        return res.status(200).json({results: results});
    } catch(error) {
        return res.status(500).json({error: 'Error querying database.'});
    }
}


// GET /recommendations
var getFriendRecs = async function(req, res) {
    // TODO: get all friend recommendations of current user

    // Step 1: Make sure the user is logged in.

    const username = req.params.username;

    if (username == null || !helper.isOK(username) || !helper.isLoggedIn(req, username)) {
        return res.status(403).json( {error: 'Not logged in.'} );
    }

    // Step 2: Get their recommendations (not necessarily registered users.)

    const getRecommendationsQuery = `SELECT DISTINCT recommended.nconst AS recommendation, 
    recommended.primaryName AS primaryName
    FROM users
    JOIN names ON users.linked_nconst = names.nconst
    JOIN recommendations ON recommendations.person = names.nconst
    JOIN names AS recommended ON recommendations.recommendation = recommended.nconst
    WHERE users.username = '${username}';`;
    
    try {
        const results = await db.send_sql(getRecommendationsQuery);
        return res.status(200).json({results: results});
    } catch(error) {
        return res.status(500).json({error: 'Error querying database.', error});
    }
}


// POST /createPost
var createPost = async function(req, res) {

    // Step 1: Make sure the user is logged in.

    let username = req.params.username;

    if (username == null || !helper.isOK(username) || !helper.isLoggedIn(req, username)) {
        return res.status(403).json( {error: 'Not logged in.'} );
    }

    // Step 2: Make sure all fields are provided.

    if (!req.body) {
        return res.status(400).json({error: 'One or more of the fields you entered was empty, please try again.'});
    };


    if (!req.body.title || !req.body.image || !req.body.captions) {
        return res.status(400).json({error: 'One or more of the fields you entered was empty, please try again.'});
    };

    const title = req.body.title;
    const image = req.body.image;
    const captions = req.body.captions;

    // Step 3: Make sure forbidden characters are not used (to prevent SQL injection attacks).

    //image URL has forbidden characters?
    if (!helper.isOK(title) || !helper.isOK(captions)) {
        return res.status(400).json({error: 'Potential injection attack detected: please do not use forbidden characters.'});
    }


    const userID = req.session.user_id;

    //image_id would require a unique title
    const image_id = userID+"-"+title.replace(" ", "")

    const checkTitleQuery = `
    SELECT image_id
    FROM posts
    WHERE image_id = '${image_id}'
    `

    //Checks if image id already exists

    try {
        const results = await db.send_sql(checkTitleQuery);
        
        if (results.length > 0) {
            return res.status(409).json({error: "A post with a title posted by you has been made"});
        } else {
            console.log("All good! You can proceed.")
        }
    } catch (error) {
        console.log(error)
        return res.status(500).json({error: 'Error querying database.'});
    }

    // Step 4: Create post 


    var insertPostQuery =  `
        INSERT INTO posts (author_id, title, image_id, captions) 
        VALUES (${userID}, '${title}', '${image_id}', '${captions}');
        `;

    console.log("Above try!")

    try {
        await db.insert_items(insertPostQuery);
        console.log("s3 ing ...")
        const resp = await putS3Object("photos-pets-com", image, image_id);
        console.log("Returning ...")
        return res.status(201).json({message: "Post created."});
    } catch(error) {
        console.log(error);
        return res.status(500).json({error: 'Error querying database.', error});
    }

}

// GET /feed
var getFeed = async function(req, res) {

    // Step 1: Make sure the user is logged in.

    const username = req.params.username;

    if (!helper.isLoggedIn(req, username)) {
        return res.status(403).json( {error: 'Not logged in.'} );
    }

    const userID = req.session.user_id;

    // Step 2: Get feed. 

    const getFeedQuery = `SELECT DISTINCT friendN.primaryName AS username, 
    feed.parent_post AS parent_post,
    feed.title AS title,       
    feed.content AS content
    FROM posts
    JOIN users ON users.user_id = posts.author_id
    JOIN friends ON friends.follower = users.linked_nconst
    JOIN names AS friendN ON friendN.nconst = friends.followed
    JOIN users AS friendU ON friendU.linked_nconst = friendN.nconst
    JOIN posts AS feed ON feed.author_id = friendU.user_id
    WHERE posts.author_id = '${userID}'
    UNION
    SELECT DISTINCT names.primaryName AS username, 
    posts.parent_post AS parent_post,
    posts.title AS title,       
    posts.content AS content
	FROM posts
    JOIN users ON users.user_id = posts.author_id
    JOIN names ON names.nconst = users.linked_nconst
    WHERE posts.author_id = '${userID}';`;

    try {
        const results = await db.send_sql(getFeedQuery);
        return res.status(200).json({results: results});
    } catch(error) {
        return res.status(500).json({error: 'Error querying database.'});
    }
    
    // TODO: get the correct posts to show on current user's feed
}


var getMovie = async function(req, res) {
    const vs = await getVectorStore();
    const retriever = vs.asRetriever();

    const context = req.body.context;
    const question = req.body.question;

    const prompt =
    PromptTemplate.fromTemplate(` 
        Answer the question ${question} given the following context: ${context}
        `);
    
    const llm = new ChatOpenAI({
        model: 'gpt-3.5-turbo',
        temperature: 0,
    }); // TODO: replace with your language model

    const ragChain = RunnableSequence.from([
        {
            context: retriever.pipe(formatDocumentsAsString),
            question: new RunnablePassthrough(),
          },
      prompt,
      llm,
      new StringOutputParser(),
    ]);

    result = await ragChain.invoke(req.body.question);
    console.log(result);
    res.status(200).json({message: result});
}

var chat_leave = async function (req,res) {
    //STEP 1: Make sure user is logged in
    let username = req.params.username;
    if (username == null || !helper.isOK(username) || !helper.isLoggedIn(req, username)) {
        return res.status(403).json( {error: 'Not logged in.'} );
    }
    //STEP 2: Check for chat_id input
    if (!req.body || !req.body.chat_id) {
        return res.status(400).json({error: 'One or more of the fields you entered was empty, please try again.'});
    }
    const chatID = req.body.chat_id;
    if (!helper.isOK(chatID)) {
        return res.status(400).json({error: 'Potential injection attack detected: please do not use forbidden characters.'});
    }
    const userID = req.session.user_id;
    try {
        //STEP 3: Check if chat_id exists
        //STEP 4: Remove user_id from chat_id, if possible
        const deletedrows = await db.insert_items(`DELETE FROM Chats WHERE (user_id == ${userID} AND chat_id == ${chatID});`);
        if (deletedrows == 0) {
            return res.status(201).json({message: "user not found in chat"});
        }
        return res.status(200).json({message: "User Deleted."});
    } catch (error) {
        return res.status(500).json({error: 'Error querying database.', error});
    }
}


//POST /:username/:chat_id/add
var chat_add = async function (req,res) {
    //STEP 1: Make sure user is logged in
    let username = req.params.username;
    if (username == null || !helper.isOK(username) || !helper.isLoggedIn(req, username)) {
        return res.status(403).json( {error: 'Not logged in.'} );
    }
    //STEP 2: Check for chat_id input
    if (!req.body || !req.body.chat_id) {
        return res.status(400).json({error: 'One or more of the fields you entered was empty, please try again.'});
    }
    const chatID = req.body.chat_id;
    if (!helper.isOK(chatID)) {
        return res.status(400).json({error: 'Potential injection attack detected: please do not use forbidden characters.'});
    }
    const userID = req.session.user_id;
    try {
        //STEP 3: Check if chat_id exists
        const chats = await db.send_sql(`SELECT DISTINCT(chat_name) FROM Chats WHERE chat_id == ${chatID};`);
        const chatName = chats[0]["DISTINCT(chat_name)"];
        if (length(chatName) == 0) {
            return res.status(201).json({message: "chat does not exist"});
        }
        //STEP 4: Add user_id to chat_id, if possible
        const addedPeople = await db.insert_items(`INSERT IGNORE INTO Chats VALUES (${chatID}, ${chatName}, ${userID});`);
        if (addedPeople == 0) {
            return res.status(201).json({message: "user already exists in chat"});
        }
        return res.status(200).json({message: "User Added."});
    } catch (error) {
        return res.status(500).json({error: 'Error querying database.', error});
    }
}


//POST /:username/:chat_id/message
var chat_message = async function (req,res) {
    //STEP 1: Make sure user is logged in
    let username = req.params.username;
    if (username == null || !helper.isOK(username) || !helper.isLoggedIn(req, username)) {
        return res.status(403).json( {error: 'Not logged in.'} );
    }
    //STEP 2: Check for chat_id, content input
    if (!req.body || !req.body.chat_id ||!req.body.timestamp || !req.body.message) {
        return res.status(400).json({error: 'One or more of the fields you entered was empty, please try again.'});
    }
    const chatID = req.body.chat_id;
    const timestamp = req.body.timestamp;
    const message = req.body.message;

    if (!helper.isOK(chatID) || !helper.isOK(message)) {
        return res.status(400).json({error: 'Potential injection attack detected: please do not use forbidden characters.'});
    }
    const userID = req.session.user_id;
    try {
        //STEP 3: Check if chat_id exists
        const chats = await db.send_sql(`SELECT DISTINCT(chat_name) FROM Chats WHERE chat_id == ${chatID};`);
        const chatName = chats[0]["DISTINCT(chat_name)"];
        if (length(chatName) == 0) {
            return res.status(201).json({message: "chat does not exist"});
        }
        //STEP 4: Add user_id's message to chat_id, if possible
        const addedMessage = await db.insert_items(`INSERT INTO Messages VALUES (${chatID}, ${userID}, ${timestamp}, ${message});`);
        return res.status(200).json({message: "Message Added."});

    } catch (error) {
        return res.status(500).json({error: 'Error querying database.', error});
    }
}


//POST /:username/follow?=person
var follow = async function (req,res) {
    //STEP 1: Make sure user is logged in
    let username = req.params.username;
    if (username == null || !helper.isOK(username) || !helper.isLoggedIn(req, username)) {
        return res.status(403).json( {error: 'Not logged in.'} );
    }
    //STEP 2: Check for input
    if (!req.body || !req.body.personID) {
        return res.status(400).json({error: 'One or more of the fields you entered was empty, please try again.'});
    }
    const personID = req.body.personID;
    if (!helper.isOK(personID)) {
        return res.status(400).json({error: 'Potential injection attack detected: please do not use forbidden characters.'});
    }
    const userID = req.session.user_id;
    try {
        //STEP 3: Follow
        const addedFriend = await db.insert_items(`INSERT IGNORE INTO Friends VALUES (${personID},${userID});`);
        if (addedFriend == 0) {
            return res.status(201).json({message: "already friends"});
        }
        return res.status(200).json({message: "Friend followed."});
    } catch (error) {
        return res.status(500).json({error: 'Error querying database.', error});
    }
}

//POST /:username/unfollow?=person
var unfollow = async function (req,res) {
    //STEP 1: Make sure user is logged in
    let username = req.params.username;
    if (username == null || !helper.isOK(username) || !helper.isLoggedIn(req, username)) {
        return res.status(403).json( {error: 'Not logged in.'} );
    }
    //STEP 2: Check for input
    if (!req.body || !req.body.personID) {
        return res.status(400).json({error: 'One or more of the fields you entered was empty, please try again.'});
    }
    const personID = req.body.personID;
    if (!helper.isOK(personID)) {
        return res.status(400).json({error: 'Potential injection attack detected: please do not use forbidden characters.'});
    }
    const userID = req.session.user_id;
    try {
        //STEP 3: Unfollow
        const removeFriend = await db.insert_items(`DELETE FROM Friends WHERE (followed = ${personID} AND follower = ${userID});`);
        if (removeFriend == 0) {
            return res.status(201).json({message: "never friends"});
        }
        return res.status(200).json({message: "Friend unfollowed."});
    } catch (error) {
        return res.status(500).json({error: 'Error querying database.', error});
    }
}

//GET /:username/search?=query
var search = async function (req,res) {
    //STEP 1: Make sure user is logged in
    let username = req.params.username;
    if (username == null || !helper.isOK(username) || !helper.isLoggedIn(req, username)) {
        return res.status(403).json( {error: 'Not logged in.'} );
    }
    //STEP 2: Check for input
    if (!req.body || !req.body.query) {
        return res.status(400).json({error: 'One or more of the fields you entered was empty, please try again.'});
    }
    const query = req.body.query;
    if (!helper.isOK(query)) {
        return res.status(400).json({error: 'Potential injection attack detected: please do not use forbidden characters.'});
    }
    try {
        //STEP 3: Search & Return user
        //TODO: Unimplemented
    } catch (error) {
        return res.status(500).json({error: 'Error querying database.', error});
    }
}

/* Here we construct an object that contains a field for each route
   we've defined, so we can call the routes from app.js. */

   async function putS3Object(bucket, object, key){
    const s3Client = new S3Client({region: "us-east-1"});

    const inputParams = {
        "Body": object,
        "Bucket": bucket,
        "Key": key
    }

    const command = new PutObjectCommand(inputParams);
    try{
        const response = await s3Client.send(command)
    } catch(error){
        console.log("Error putting object in s3", error);
        throw error;
    }
   }

   async function getS3ImageURL(bucket, key){
    const s3Client = new S3Client({region: "us-east-1"});

    const inputParams = {
        "Bucket": bucket,
        "Key": key
    }

    try{
        const p = s3Client.getSignedUrlPromise('getObject', inputParams);
        return p;
    } catch(error){
        console.log("Error getting object URL from s3", error);
        throw error;
    }
   }


var routes = { 
    get_helloworld: getHelloWorld,
    post_login: postLogin,
    post_register: postRegister,
    post_logout: postLogout, 
    get_friends: getFriends,
    get_friend_recs: getFriendRecs,
    get_movie: getMovie,
    create_post: createPost,
    get_feed: getFeed,
    chat_leave: chat_leave,
    chat_add: chat_add,
    chat_message: chat_message,
    follow: follow, 
    unfollow: unfollow,
    search: search
  };


module.exports = routes;

