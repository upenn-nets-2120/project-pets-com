const { OpenAI, ChatOpenAI } = require("@langchain/openai");
const { PromptTemplate } = require("@langchain/core/prompts");
const {SqlDatabase} = require("langchain/sql_db")
const {DataSource} = require("typeorm")
// const { ChatPromptTemplate } = require("@langchain/core/prompts");
// const { StringOutputParser } = require("@langchain/core/output_parsers");
// const { CheerioWebBaseLoader } = require("langchain/document_loaders/web/cheerio");
// const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
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
const { fromIni } = require("@aws-sdk/credential-provider-ini")
const dbsingleton = require('../models/db_access.js');
const config = require('../config.json'); // Load configuration
const bcrypt = require('bcrypt'); 
const helper = require('../routes/route_helper.js');
const { ConnectContactLens } = require("aws-sdk");
const {S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand} = require("@aws-sdk/client-s3");
const multer = require('multer');
const crypto = require('crypto')
const {getSignedUrl} = require('@aws-sdk/s3-request-presigner')
const kafka = require('./kafka_routes.js')
const cd = require('../models/chroma_access.js');

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
    const hashtags = req.body.hashtags

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
        INSERT INTO users (username, hashed_password, email, affiliation, birthday, firstName, lastName, photo_id) 
        VALUES ('${usernameToCreate}', '${hashedPassword}', '${email}', '${affiliation}', '${birthday}', '${firstName}', '${lastName}', NULL);
        `;

        try {
            //REGISTER TO DATABASE
            await db.insert_items(insertQuery);
            //SET VALID USER COOKIES
            const userIDQuery = `SELECT user_id FROM users WHERE username = '${usernameToCreate}';`;
            const result = await db.send_sql(userIDQuery);
            req.session.user_id = result[0].user_id; 
            req.session.username = usernameToCreate; 
            const TwitQuery = `INSERT INTO friends (followed, follower) VALUES (14, ${result[0].user_id}) `
            const FedQuery = `INSERT INTO friends (followed, follower) VALUES (15, ${result[0].user_id}) `
            await db.insert_items(TwitQuery);
            await db.insert_items(FedQuery);
            hashtags?.map(async (inp) => {
                if(inp != ""){ 
                    if(inp.includes("#")){
                        await db.insert_items(`INSERT INTO hashtags (hashtag, follower_id) VALUES ('${inp}', ${result[0].user_id} )`);
                    } else {
                        const adder = "#" + inp
                        await db.insert_items(`INSERT INTO hashtags (hashtag, follower_id) VALUES ('${adder}', ${result[0].user_id} )`);
                    }
                }
            })
            return res.status(200).json({ username: usernameToCreate });
        } catch(error) {
            console.log(error)
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
            console.log(error)
            return res.status(500).json({error: 'Error querying database.'});
        }
    } catch(error) {
        console.log(error)
        return res.status(500).json({error: 'Error querying database.'});
    }
};


// POST /updateProfile
var updateProfile = async function (req,res) {
    // TODO: update profile with given parameters
    // Change Passwords
    // Change Hashtags
    // Change Linked Actors

    //Step 1: Check sign-in
    let username = req.params.username;
    if (username == null || !helper.isOK(username) || !helper.isLoggedIn(req, username)) {
        return res.status(403).json( {error: 'Not logged in.'} );
    }
    // Step 2: Make sure all fields are provided
    if (!req.body) {
        return res.status(400).json({error: 'One or more of the fields you entered was empty, please try again.'});
    }
    console.log(req.body.password)
    if (!req.body.password) { //add more later
        return res.status(400).json({error: 'One or more of the fields you entered was empty, please try again. lol loser'});
    }
    const password = req.body.password;
    // Step 3: Make sure forbidden characters are not used (to prevent SQL injection attacks).
    if (!helper.isOK(password)) { //add more later
        return res.status(400).json({error: 'Potential injection attack detected: please do not use forbidden characters.'});
    }

    // Step 4: Hash and salt the password! 
    helper.encryptPassword(password, async function(err, hashPassword) {
        if (err) {
            return res.status(500).json({error: 'Error querying database.', err});
        }
        const hashedPassword = hashPassword;

        // Step 5: Update Table
        const updatePasswordQuery = `UPDATE users SET hashed_password = '${hashedPassword}' WHERE username = '${username}';`;
        try {
            //REGISTER TO DATABASE
            console.log(updatePasswordQuery);
            await db.insert_items(updatePasswordQuery);
            return res.status(200).json({ message: "Profile Updated Successfully" });
        } catch(error) {
            console.log(error);
            return res.status(500).json({error: 'Error querying database.', error});
        }
    });
}
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
    const user_id = req.session.user_id;
    if (user_id == null || username == null || !helper.isOK(username) || !helper.isLoggedIn(req, username)) {
        return res.status(403).json( {error: 'Not logged in.'} );
    }
    // Step 2: Get their friends (not necessarily registered users)
    const getFriendsQuery =  `SELECT DISTINCT users.user_id, users.username, users.firstName, users.lastName, timestamp.timestamp FROM users JOIN friends ON users.user_id = friends.followed LEFT JOIN timestamp ON timestamp.user_id = users.user_id WHERE friends.follower = '${user_id}';`
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
    const user_id = req.session.user_id;
    if (user_id == null || username == null || !helper.isOK(username) || !helper.isLoggedIn(req, username)) {
        return res.status(403).json( {error: 'Not logged in.'} );
    }

    // Step 2: Get their recommendations (not necessarily registered users.)
    //Temporary measure, but we should ignore friends we've already added
    const getRecDebugQuery = `SELECT DISTINCT users.user_id, users.username, users.firstName, users.lastName, timestamp.timestamp
    FROM users LEFT JOIN timestamp ON users.user_id=timestamp.user_id
    WHERE users.user_id != ${user_id} 
    AND users.user_id NOT IN (
        SELECT followed 
        FROM friends 
        WHERE follower = ${user_id}
    );`;

    const getRecommendationsDebugQuery2 = `WITH following AS (SELECT followed
        FROM friends 
        WHERE follower = 13) 
        
        SELECT users.user_id, users.username, users.firstName, users.lastName, timestamp.timestamp FROM users LEFT JOIN timestamp ON users.user_id=timestamp.user_id JOIN 
        friends ON friends.followed=users.user_id JOIN following ON following.followed = friends.follower
         WHERE friends.followed NOT IN (SELECT followed FROM following) AND users.user_id != 13
       GROUP BY friends.followed
        ORDER BY COUNT(*) DESC;`

    const getRecommendationsQuery = `WITH following AS (SELECT followed
         FROM friends 
         WHERE follower = ${user_id}) 
         
         SELECT users.user_id, users.username, users.firstName, users.lastName, timestamp.timestamp FROM users LEFT JOIN timestamp ON users.user_id=timestamp.user_id JOIN 
         friends ON friends.followed=users.user_id JOIN following ON following.followed = friends.follower
          WHERE friends.followed NOT IN (SELECT followed FROM following) AND users.user_id != ${user_id}
        GROUP BY friends.followed
         ORDER BY COUNT(*) DESC;`
    
    try {
        const results = await db.send_sql(getRecommendationsQuery);
        return res.status(200).json({results: results});
    } catch(error) {
        console.log(error)
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
        const addedFriend = await db.insert_items(`INSERT IGNORE INTO friends VALUES (${personID},${userID});`);
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
        const removeFriend = await db.insert_items(`DELETE FROM friends WHERE (followed = ${personID} AND follower = ${userID});`);
        if (removeFriend == 0) {
            return res.status(201).json({message: "never friends"});
        }
        return res.status(200).json({message: "Friend unfollowed."});
    } catch (error) {
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
    
        if (!req.body.title) {
            return res.status(400).json({error: 'One or more of the fields you entered was empty, please try again.'});
        };

        // Step 3: Make sure forbidden characters are not used (to prevent SQL injection attacks).

        const title = req.body.title;
        const image = req.file;
        const captions = req.body.captions;

        // console.log(title)
        // console.log(image)
        // console.log(captions)

        //image URL has forbidden characters?
        if (!helper.isOK(title)) {
            return res.status(400).json({error: 'Potential injection attack detected: please do not use forbidden characters.'});
        }


        const userID = req.session.user_id;
        if(userID == null || userID == undefined){
            try {
                const results = await db.send_sql(`SELECT user_id FROM users WHERE username = '${username}'`);
                //Is this the correct way to use results??
                const userID = results.user_id;
                req.session.user_id = results.user_id;
            } catch(error) {
                // console.log(error)
                return res.status(500).json({error: 'Error querying database.'});    
            }

        }

        //image_id would require a unique title
        const randomImageName = (bytes= 32) => crypto.randomBytes(bytes).toString('hex')

        const image_id = randomImageName()


        // Step 4: Create post 


        var insertPostQuery =  `
            INSERT INTO posts (author_id, title, image_id, captions) 
            VALUES (${userID}, '${title}', '${image_id}', '${captions}');
            `;

        console.log("Above try!")
    
        try {
            kafka.sendMessage (username, "g23", userID, captions, 'text/html');

            if(!image && !captions){
                const insertPostQuery =  `
                INSERT INTO posts (author_id, title) 
                VALUES (${userID}, '${title}');
                `;
                await db.insert_items(insertPostQuery);
            } else if(!image){
                const insertPostQuery =  `
                     INSERT INTO posts (author_id, title, captions) 
                VALUES (${userID}, '${title}', '${captions}');
                `;
                await db.insert_items(insertPostQuery);
            } else if(!captions){
                const insertPostQuery =  `
            INSERT INTO posts (author_id, title, image_id) 
            VALUES (${userID}, '${title}', '${image_id}');
            `;
            await db.insert_items(insertPostQuery);
            const resp = await putS3Object("photos-pets-com", image, image_id);   
            } else {
                const insertPostQuery =  `
            INSERT INTO posts (author_id, title, image_id, captions) 
            VALUES (${userID}, '${title.replace(/'/g, "''")}', '${image_id}', '${captions.replace(/'/g, "''")}');
            `;
            await db.insert_items(insertPostQuery);

            console.log("s3 ing ...")
            const resp = await putS3Object("photos-pets-com", image, image_id);
            console.log("Returning ...")

            }

            if(captions){
                const regex = /#(\w+)/g;
                const matches = captions.match(regex)

                //Need to get PostID!!!
                const postIDQuery = `SELECT post_id FROM posts WHERE author_id = '${userID}' ${title ? ` AND title = '${title.replace(/'/g, "''")}'` : ''} ${captions ? `AND captions = '${captions.replace(/'/g, "''")}'` : ""};`;
                const result = await db.send_sql(postIDQuery);
                console.log(result)
                const post_id = result[0].post_id; 
                console.log("Results:" + result)
                cd.embed_post(title, captions, post_id);
                matches?.map(async match => {
                    const q = `INSERT INTO hashtags (hashtag, post_id, follower_id) VALUES ('${match}', ${post_id}, ${userID}) `
        
                    await db.send_sql( q)  
                     })

            }
            return res.status(201).json({message: "Post created."});
        } catch(error) {
            console.log(error);
            return res.status(500).json({error: 'Error querying database.', error});
        }

    };

    

// GET /feed
var getFeed = async function(req, res) {

    // console.log("HREEREER!!!")

    // Step 1: Make sure the user is logged in.

    const username = req.params.username;
    const end = req.params.end

    if (!helper.isLoggedIn(req, username)) {
        return res.status(403).json( {error: 'Not logged in.'} );
    }

    const userID = req.session.user_id;
    // console.log("Above query");

    // Step 2: Get feed. 

    const getFeedQuery = `
    WITH posts AS (
    SELECT p.post_id, u.username, p.title, p.image_id, p.captions
    FROM posts p JOIN users u ON p.author_id = u.user_id
    WHERE u.user_id IN (
        SELECT followed
        FROM friends
        WHERE ${userID} = follower
    ) OR u.user_id = ${userID} ),

    numlikes AS (
        SELECT post_id, COUNT(*) AS numlikes
        FROM likes
        GROUP BY post_id 
    ),
    liked AS (
        SELECT post_id, true AS liked
        FROM likes
        WHERE liker_id = ${userID}
    ),
    commentList AS (
        SELECT comments.post_id,  CONCAT('[', GROUP_CONCAT( CONCAT ( '[ "', comments.comment , '", "', users.username, '"]')), ']' )AS comments
        FROM comments JOIN users ON comments.commenter_id = users.user_id
        GROUP BY post_id
    )

    SELECT posts.post_id, posts.username, posts.title, posts.image_id, posts.captions, numlikes.numlikes, liked.liked, commentList.comments
    FROM posts LEFT JOIN numlikes ON posts.post_id = numlikes.post_id
    LEFT JOIN liked ON posts.post_id = liked.post_id
    LEFT JOIN commentList ON commentList.post_id = posts.post_id
    ORDER BY posts.post_id DESC
    LIMIT ${end};`;

    // console.log(userID)
    // console.log(getFeedQuery)

    try {
        // console.log("HERE!")
        const results = await db.send_sql(getFeedQuery);
        // console.log(results)
        // console.log("SHOULD HAVE JUST PRINTED!!")
        console.log(results)
        const returner = await Promise.all(results.map(async (inp) => ({
            "post_id": inp.post_id,
            "username": inp.username,
            "title": inp.title,
            "img_url": inp.image_id ? await getS3ImageURL("photos-pets-com", inp.image_id) : null,
            "captions": inp.captions,
            "numlikes": inp.numlikes,
            "liked": (inp.liked == true),
            "comments": inp.comments ? JSON.parse(inp.comments?.replace(/""/g, '"')) : null,


        })));
        // console.log(returner)
        return res.status(200).json({results: returner});
    } catch(error) {
         console.log(error)
        return res.status(500).json({error: 'Error querying database.'});
    }
    
    // TODO: get the correct posts to show on current user's feed
}

var get_chats = async function (req,res) {
    let username = req.params.username;
    if (username == null || !helper.isOK(username) || !helper.isLoggedIn(req, username)) {
        return res.status(403).json( {error: 'Not logged in.'} );
    }
    const userID = req.session.user_id;
    try {
        const resp = await db.send_sql(`SELECT DISTINCT chats.chat_id, chats.chat_name FROM chats JOIN chatters ON chats.chat_id=chatters.chat_id WHERE chatters.user_id=${userID};`)
        if (resp.length == 0) {
            return res.status(200).json({results: []});
        }
        return res.status(200).json({results: resp});
    } catch (error) {
        console.log(error)
        return res.status(500).json({error: 'Error querying database.', error});
    }
}

var get_invites = async function (req,res) {
    let username = req.params.username;
    if (username == null || !helper.isOK(username) || !helper.isLoggedIn(req, username)) {
        return res.status(403).json( {error: 'Not logged in.'} );
    }
    const userID = req.session.user_id;
    try {
        const resp = await db.send_sql(`SELECT DISTINCT chats.chat_id, chats.chat_name, invites.inviter_id FROM chats JOIN invites ON chats.chat_id=invites.chat_id WHERE invites.user_id=${userID};`)
        const returner = resp.map((inp) => ({
            "chat_id": inp.chat_id,
            "chat_name": inp.chat_name,
            "inviter_id": inp.inviter_id
        }));
        return res.status(200).json({results: returner});
    } catch (error) {
        console.log(error)
        return res.status(500).json({error: 'Error querying database.', error});
    }
}

var get_messages = async function (req,res) {
    let username = req.params.username;
    if (username == null || req.body.chat_id == null || !helper.isOK(username) || !helper.isLoggedIn(req, username)) {
        return res.status(403).json( {error: 'Not logged in.'} );
    }
    const userID = req.session.user_id;
    const chatID = req.body.chat_id;
    try {
        const resp = await db.send_sql(`SELECT users.username, timestamp, message FROM messages JOIN users ON messages.author_id = users.user_id WHERE messages.chat_id=${chatID};`)
        const returner = resp.map((inp) => ({
            "sender": inp.username,
            "message": inp.message,
            "timestamp": inp.timestamp
        }));
        if (returner.length == 0) {
            return res.status(200).json({results: []});
        }
        return res.status(200).json({results: returner});
    } catch (error) {
        console.log(error)
        return res.status(500).json({error: 'Error querying database.', error});
    }
}

var chat_create = async function (req,res) {
    let username = req.params.username;
    if (username == null || !helper.isOK(username) || !helper.isLoggedIn(req, username)) {
        return res.status(403).json( {error: 'Not logged in.'} );
    }
    const chatName = req.body.chat_name;
    if (chatName == null || !helper.isOK(chatName) || chatName.trim().length == 0) {
        return res.status(400).json({error: 'Missing or incorrect fields'});
    }
    try {
        const resp = await db.send_sql(`INSERT INTO chats(chat_name) VALUES ('${chatName}');`)
        const resp2 = await db.send_sql(`SELECT LAST_INSERT_ID();`)
        console.log(resp2)
        return res.status(200).json({chat_id : resp2[0]['LAST_INSERT_ID()']})
    } catch (error) {
        console.log(error)
        return res.status(500).json({error: 'Error querying database.', error});
    }
}

var chat_handle_invite = async function (req,res) {
    let username = req.params.username;
    if (username == null || req.body.accept == null || !helper.isOK(username) || !helper.isLoggedIn(req, username)) {
        return res.status(403).json( {error: 'Not logged in.'} );
    }
    const userID = req.session.user_id;
    const chatID = req.body.chat_id;
    const inviterID = req.body.inviter_id;
    var flag = 0
    console.log(req.body)
    if (chatID == null || inviterID == null) {
        return res.status(400).json({error : 'Missing fields.'});
    }
    try {
        const resp = await db.send_sql(`SELECT COUNT (DISTINCT chat_id) FROM chatters WHERE chat_id=${chatID}`)
        if (req.body.accept == true) { //USER ACCEPTS INVITE
            // CHECK IF CHAT HAS BEEN POPULATED
            if (resp[0]['COUNT (DISTINCT chat_id)'] == 0) {
                //IF CHAT HAS NOT BEEN CREATED, ALSO ADD INVITER
                flag = 1
                const addInviter = await db.insert_items(`INSERT INTO chatters (chat_id, user_id) VALUES(${chatID}, ${inviterID});`)
            } 
            //ADD USER TO CHAT_ID
            const addUser = await db.insert_items(`INSERT INTO chatters (chat_id, user_id) VALUES(${chatID}, ${userID})`)
            //DISCARD invite
            await db.insert_items(`DELETE FROM invites WHERE inviter_id=${inviterID} AND chat_id=${chatID} AND user_id=${userID};`)
        } else {
            //DISCARD invite
            await db.insert_items(`DELETE FROM invites WHERE inviter_id=${inviterID} AND chat_id=${chatID} AND user_id=${userID};`)
            // CHECK IF CHAT HAS BEEN POPULATED
            if (resp[0]['COUNT (DISTINCT chat_id)'] == 0) {
                //DELETE chat
                const deletedrows = await db.insert_items(`DELETE FROM chats WHERE chat_id=${chatID};`)
            }
        }
        
        return res.status(200).json({message: 'Invite handled', addedChat:flag})
    } catch (error) {
        console.log(error)
        return res.status(500).json({error: 'Error querying database.', error});
    }
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
    const userID = req.session.user_id;
    try {
        //STEP 3: Check if chat_id exists
        //STEP 4: Remove user_id from chat_id, if possible
        const deletedrows = await db.insert_items(`DELETE FROM chatters WHERE (chat_id=${chatID} AND user_id=${userID});`);
        const resp = await db.send_sql(`SELECT COUNT (DISTINCT chat_id) FROM chatters WHERE chat_id=${chatID}`);
        if (resp[0]['COUNT (DISTINCT chat_id)'] == 0) {
            //IF CHAT IS NOW EMPTY, DELETE ALL INVITES, MESSAGES, CHATS
            const deleteinvites = await db.insert_items(`DELETE FROM invites WHERE chat_id=${chatID};`)
            const deletemessages = await db.insert_items(`DELETE FROM messages WHERE chat_id=${chatID};`)
            const deletechat = await db.insert_items(`DELETE FROM chats WHERE chat_id=${chatID};`)
        } 
        return res.status(200).json({message: "User Deleted."});
    } catch (error) {
        console.log(error)
        return res.status(500).json({error: 'Error querying database.', error});
    }
}

var chat_invite = async function (req,res) {
    let username = req.params.username;
    if (username == null || !helper.isOK(username) || !helper.isLoggedIn(req, username)) {
        return res.status(403).json( {error: 'Not logged in.'} );
    }
    //STEP 2: Check for chat_id input
    if (!req.body) {
        return res.status(400).json({error: 'One or more of the fields you entered was empty, please try again.'});
    }
    const userID = req.session.user_id; //you are the inviter
    const personID = req.body.person_id; //person being invited
    const chatID = req.body.chat_id;
    console.log(req.body)
    if (chatID == null || personID == null || userID == null) {
        return res.status(400).json({error : 'Missing fields.'});
    }
    try {
        const invitedPeople = await db.insert_items(`INSERT IGNORE INTO invites (chat_id, user_id, inviter_id) VALUES (${chatID}, ${personID}, ${userID});`);
        return res.status(200).json({message:"ok"})
    } catch (error) {
        console.log(error)
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

    if (!helper.isOK(message)) {
        return res.status(400).json({error: 'Potential injection attack detected: please do not use forbidden characters.'});
    }
    const userID = req.session.user_id;
    try {
        //STEP 43 Add user_id's message to chat_id, if possible
        const addedMessage = await db.insert_items(`INSERT INTO messages (chat_id, author_id, timestamp, message) VALUES (${chatID}, ${userID}, ${timestamp}, '${message}');`);
        return res.status(200).json({message: "Message Added."});
    } catch (error) {
        console.log(error)
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

//USE (Middleware) /set_time
var set_time = function (req,res,next) {
    if (req != null && req.session != null && req.session.user_id != null) {
        const userID = req.session.user_id
        const timestamp = Date.now();
        try {
            const response = db.insert_items(
                `INSERT INTO timestamp (user_id, timestamp) 
                VALUES (${userID}, ${timestamp}) 
                ON DUPLICATE KEY UPDATE 
                    timestamp = ${timestamp};`);
            console.log(`Registered timestamp ${username}`)
        } catch (error){
            //fail silently
        }
    }
    next(); //move on
}

/* Here we construct an object that contains a field for each route
   we've defined, so we can call the routes from app.js. */

   async function putS3Object(bucket, file, key){
    const credentials = fromIni({
        accessKeyId:  process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        sessionToken: process.env.AUTH_TOKEN
    });
    const s3Client = new S3Client({region: "us-east-1", credentials: credentials});

    const inputParams = {
        "Body": file.buffer,
        "Bucket": bucket,
        "Key": key,
        "ContentType": file.mimetype
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
    const credentials = fromIni({
        accessKeyId:  process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        sessionToken: process.env.AUTH_TOKEN
    });
    const s3Client = new S3Client({region: "us-east-1", credentials: credentials});

    const inputParams = {
        "Bucket": bucket,
        "Key": key
    }

    try{
        const command = new GetObjectCommand(inputParams);
        const url = await getSignedUrl(s3Client, command, {expiresIn: 3600})
        //console.log(results.Body)

        return url;
    } catch(error){
        console.log("Error getting object URL from s3", error);
        return ''
        //throw error;
    }
   }

   async function deleteS3ImageURL(bucket, key){
    const credentials = fromIni({
        accessKeyId:  process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        sessionToken: process.env.AUTH_TOKEN
    });
    const s3Client = new S3Client({region: "us-east-1", credentials: credentials});

    const inputParams = {
        "Bucket": bucket,
        "Key": key
    }

    try{
        const command = new DeleteObjectCommand(inputParams);
        await s3Client.send(command)
        //console.log(results.Body)
    } catch(error){
        console.log("Error getting object URL from s3", error);
        return ''
        //throw error;
    }
   }

   function simpleContentRetriever(postsText) {
    return {
        retrieve: async (query) => {
            return [{ text: postsText, score: 1 }]; // Assuming the retriever expects an array of results
        }
    };
    }

var routes = { 
    set_time : set_time,
    get_helloworld: getHelloWorld,
    post_login: postLogin,
    post_register: postRegister,
    update_profile: updateProfile,
    post_logout: postLogout, 
    get_friends: getFriends,
    get_friend_recs: getFriendRecs,
    create_post: createPost,
    get_feed: getFeed,
    get_chats: get_chats,
    get_invites: get_invites,
    get_messages: get_messages,
    chat_create: chat_create,
    chat_handle_invite: chat_handle_invite,
    chat_leave: chat_leave,
    chat_invite: chat_invite,
    chat_message: chat_message,
    follow: follow, 
    unfollow: unfollow,
    search: search
  };


module.exports = routes;

