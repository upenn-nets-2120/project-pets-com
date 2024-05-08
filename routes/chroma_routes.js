const { OpenAI, ChatOpenAI } = require("@langchain/openai");
const { PromptTemplate } = require("@langchain/core/prompts");
const { OpenAIEmbeddings } = require("@langchain/openai");
const {DataSource} = require("typeorm");
const { Chroma } = require("@langchain/community/vectorstores/chroma");
const dbsingleton = require('../models/db_access.js');
const cd = require('../models/chroma_access.js');

const db = dbsingleton;

//GET /:username/search?=query
var search = async function(req, res) {
    //cd.embed_posts_database()
    

    // async function sendToEmbeddingAPI(posts) {
    //     try {
    //         const openai_ef = embedding_functions.OpenAIEmbeddingFunction(
    //             model_name="text-embedding-ada-002"
    //         )               
    //         students_embeddings = openai_ef([posts]) 
    //     } catch (error) {
    //         console.error('Failed to send data to the embedding API:', error);
    //     }
    // }

    // const datasource = new DataSource({
    //     type: "mysql",
    //     database: posts, 
    // });
    
    // //const postsText = posts.map(post => `${post.title}: ${post.captions}`).join('\n\n');
    // const vs = await getVectorStore();
    // const retriever = vs.asRetriever();
    // //const contentRetriever = simpleContentRetriever(postsText);
    // //const retriever = createRetrievalChain([retriever2]);

    // const context = req.body.context;
    // const question = req.body.question;

    // const prompt =
    // PromptTemplate.fromTemplate(` 
    //     Answer the question ${question} given the following context: ${context}. Posts is a database you have access to that holds data regarding posts on a social media site called Pennstagram.
    //     `);
    
    // const llm = new ChatOpenAI({
    //     model: 'gpt-3.5-turbo',
    //     temperature: 0,
    // });    
    // // TODO: replace with your language model

    // const postdb = await SqlDatabase.fromDataSourceParams({
    //     appDataSource: datasource,
    // });

    // const toolkit = new SqlToolkit(postdb, llm);
    // const executor = createSqlAgent(llm, toolkit);

    // const hybridRetriever = createRetrievalChain([
    //     { retriever: retriever },
    //     { retriever: executor } 
    // ]);

    // const ragChain = RunnableSequence.from([
    //     {
    //         context: hybridRetriever.pipe(formatDocumentsAsString),
    //         question: new RunnablePassthrough(),
    //       },
    //   prompt,
    //   llm,
    //   new StringOutputParser(),
    // ]);

    // result = await ragChain.invoke(req.body.question);
    // console.log(result);
    // res.status(200).json({message: result});
}

var chromaRoutes = {
    search,
}
module.exports = chromaRoutes