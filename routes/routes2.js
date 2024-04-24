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
const { time } = require("highcharts");

// Database connection setup
const db = dbsingleton;

const PORT = config.serverPort;
var vectorStore = null;
  
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

   var routes = { 
    chat_leave: chat_leave,
    chat_add: chat_add,
    chat_message: chat_message,
    follow: follow, 
    unfollow: unfollow,
    search: search,
  };

module.exports = routes;

