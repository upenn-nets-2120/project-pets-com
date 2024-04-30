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
const { fromIni } = require("@aws-sdk/credential-provider-ini")

const dbsingleton = require('../models/db_access.js');
const config = require('../config.json'); // Load configuration
const bcrypt = require('bcrypt'); 
const helper = require('../routes/route_helper.js');
const { ConnectContactLens } = require("aws-sdk");
const {S3Client, PutObjectCommand, GetObjectCommand} = require("@aws-sdk/client-s3");

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
    if(userID == null || userID == undefined){
        try {
            const results = await db.send_sql(`SELECT user_id FROM users WHERE username = '${username}'`);
            //Is this the correct way to use results??
            const userID = results.user_id;
            req.session.user_id = results.user_id;
        } catch(error) {
            console.log(error)
            return res.status(500).json({error: 'Error querying database.'});    
        }

    }

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

    console.log("HREEREER!!!")

    // Step 1: Make sure the user is logged in.

    const username = req.params.username;

    if (!helper.isLoggedIn(req, username)) {
        return res.status(403).json( {error: 'Not logged in.'} );
    }

    const userID = req.session.user_id;
    console.log("Above query");

    // Step 2: Get feed. 

    const getFeedQuery = `SELECT p.post_id, u.username, p.title, p.image_id, p.captions
    FROM posts p JOIN users u ON p.author_id = u.user_id
    WHERE u.user_id IN (
        SELECT follower 
        FROM friends
        WHERE ${userID} = followed
    ) OR u.user_id = ${userID} `

    console.log(userID)
    console.log(getFeedQuery)

    try {
        console.log("HERE!")
        const results = await db.send_sql(getFeedQuery);
        console.log(results)
        console.log("SHOULD HAVE JUST PRINTED!!")
        const returner = results.map(async (inp) => ({
            "post_id": inp.post_id,
            "username": inp.username,
            "title": inp.title,
            "img_url": await getS3ImageURL("photos-pets-com", inp.image_id ),
            "captions": inp.captions
        }))
        console.log(returner)
        return res.status(200).json({results: returner});
    } catch(error) {
        console.log(error)
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


/* Here we construct an object that contains a field for each route
   we've defined, so we can call the routes from app.js. */

   async function putS3Object(bucket, object, key){
    const credentials = fromIni({
        accessKeyId:  process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        sessionToken: process.env.AUTH_TOKEN
    });
    const s3Client = new S3Client({region: "us-east-1",
    credentials: credentials});

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
        const results = await s3Client.send(command);
        const bodyContents = await streamToString(results.Body);
        return await bodyContents;
    } catch(error){
        console.log("Error getting object URL from s3", error);
        return ''
        //throw error;
    }
   }

   async function streamToString(stream) {
    const chunks = [];
    return new Promise((resolve, reject) => {
      stream.on("data", (chunk) => chunks.push(chunk));
      stream.on("error", reject);
      stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    });
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
    get_feed: getFeed
  };


module.exports = routes;

