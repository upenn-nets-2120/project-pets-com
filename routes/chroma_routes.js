const { OpenAI, ChatOpenAI } = require("@langchain/openai");
const { PromptTemplate } = require("@langchain/core/prompts");
const { OpenAIEmbeddings } = require("@langchain/openai");
const {DataSource} = require("typeorm");
const { Chroma } = require("@langchain/community/vectorstores/chroma");
const dbsingleton = require('../models/db_access.js');
const cd = require('../models/chroma_access.js');
const helper = require('../routes/route_helper.js');
const {
    RunnableSequence,
    RunnablePassthrough,
  } = require("@langchain/core/runnables");
const { formatDocumentsAsString } = require("langchain/util/document");
const { StringOutputParser } = require("@langchain/core/output_parsers");
const { createStuffDocumentsChain } = require("langchain/chains/combine_documents");
const { MemoryVectorStore } = require("langchain/vectorstores/memory");
const { ChromaClient } = require('chromadb')
const process = require('process');
const {OpenAIEmbeddingFunction} = require('chromadb');
const { CollectionsBookmarkRounded } = require("@mui/icons-material");


const db = dbsingleton;
var vectorStore = null;

var getVectorStore = async function(req) {
    if (vectorStore == null) {
        vectorStore = await Chroma.fromExistingCollection(new OpenAIEmbeddings(), {
            collectionName: "posts-actors",
            url: "http://localhost:8000", // Optional, will default to this value
            });
    }
    return vectorStore;
}

//GET /:username/search?=query
var search = async function(req, res) {

    let username = req.params.username;
    if (username == null || !helper.isOK(username) || !helper.isLoggedIn(req, username)) {
        return res.status(403).json( {error: 'Not logged in.'} );
    }
    if (!req.body || !req.body.question) {
        return res.status(400).json({error: 'One or more of the fields you entered was empty, please try again.'});
    }
    const question = req.body.question;
    // if (!helper.isOK(question)) {
    //     return res.status(400).json({error: 'Potential injection attack detected: please do not use forbidden characters.'});
    // }

    cd.embed_posts_database();

    const vs = await getVectorStore();
    const retriever = vs.asRetriever();
    const context = req.body.context;
    console.log(context,question)
    const response = await vs.similaritySearch(question);
    const contextI = formatDocumentsAsString(response);
    console.log(contextI);

    const prompt = PromptTemplate.fromTemplate(` 
        This is a question: ${question}. You have access to a) user information and b) post information about social media site Pennstagram. Pennstagram is a real social media site and you are a friendly helper chat bot.
        Interact with the user while always including in your answers either the title, caption and author of a post. Or, the username, affiliation, first name, and last name of a user. You cannot return both, you must pick the most relevant one. 
        You have the info: ${contextI}.
    `);

    console.log(prompt);
    
    const llm = new ChatOpenAI({
        model: 'gpt-3.5-turbo',
        temperature: 0,
    }); 

    const ragChain = RunnableSequence.from([
        {
            context: retriever.pipe(formatDocumentsAsString),
            question: new RunnablePassthrough(),
          },
      prompt,
      llm,
      new StringOutputParser(),
    ]);

    const result = await ragChain.invoke(req.body.question);


    console.log(result);
    console.log(response);
    res.status(200).json({message: result});
 }

var chromaRoutes = {
    search,
}
module.exports = chromaRoutes