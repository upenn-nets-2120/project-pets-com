const OpenAI = require("@langchain/openai");
const DataSource = require("typeorm");
const { SqlDatabase } = require("langchain/sql_db");
const { createSqlAgent, SqlToolkit } = require("langchain/agents/toolkits/sql");

const { Chroma } = require("@langchain/community/vectorstores/chroma");
const { OpenAIEmbeddings } = require("@langchain/openai");
const { TextLoader } = require("langchain/document_loaders/fs/text");
const { DirectoryLoader } = require("langchain/document_loaders/fs/directory");
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const { Document } = require("langchain/document");
const { load } = require("cheerio");
const { ChromaClient } = require('chromadb')
const {OpenAIEmbeddingFunction} = require('chromadb');
const process = require('process');

let api_key = process.env.OPENAI_API_KEY;
const embedder = new OpenAIEmbeddingFunction({
    openai_api_key: api_key, 
    model: "text-embedding-3-small"
})
const sql = require('./db_access');

async function embed_posts_database() {
  try {
     const client = new ChromaClient({
       path: 'http://localhost:8000'
     });
      const posts = await sql.get_posts();  
      const users = await sql.get_users(); 
      const postCollection = await client.getOrCreateCollection({
        name: "posts-actors", 
        embeddingFunction: embedder
    })
     for (const post of posts) {
      console.log("Title:" + post.title + " Caption:" + post.captions + "By:" + post.username)
      const res = await postCollection.add({
        ids: post.post_id.toString(),
        documents: "Title:" + post.title + " Caption:" + post.captions + " By:" + post.username
      });
      console.log(res)
    }  
     for (const user of users) {
      console.log("Username:" + user.username + " First Name:" + user.firstName + " Last Name:" + user.lastName + " Affiliation:" + user.affiliation )
      const res = await postCollection.add({
        ids: user.user_id.toString() + "u",
        documents: "Username:" + user.username + " First Name:" + user.firstName + " Last Name:" + user.lastName + " Affiliation:" + user.affiliation 
      });
      console.log(res)
    }  
  } catch (error) {
      console.error('Error embedding posts:', error);
  }
}

async function embed_post(title, captions, author, id) {
  try {
     const client = new ChromaClient({
       path: 'http://localhost:8000'
     });
      const postCollection = await client.getOrCreateCollection({
        name: "posts-actors", 
        embeddingFunction: embedder
    })
      await postCollection.add({
        ids: id.toString(),
        documents: "Title:" + title + " Caption:" + captions + " By:" + author
  });
      console.log("Successful!") 
  } catch (error) {
      console.error('Error embedding posts:', error);
  }
}

async function embed_user(username, firstName, lastName, affiliation, id) {
  try {
     const client = new ChromaClient({
       path: 'http://localhost:8000'
     });
      const postCollection = await client.getOrCreateCollection({
        name: "posts-actors", 
        embeddingFunction: embedder
    })
      await postCollection.add({
        ids: id.toString() + "u",
        documents: "Username:" + username + " First Name:" + firstName + " Last Name:" + lastName + " Affiliation:" + affiliation 
      });
      console.log("Successful!") 
  } catch (error) {
      console.error('Error embedding posts:', error);
  }
}

module.exports = {
    get_connection,
    embed_posts_database,
    embed_post,
    embed_user
}

async function get_connection() {
    // Create vector store and index the docs
    const vectorStore = await Chroma.fromExistingCollection(new OpenAIEmbeddings(), {
    collectionName: "posts-actors",
    url: "http://localhost:8000", // Optional, will default to this value
    });

    console.log(vectorStore.collectionName);

    // Search for the most similar document
    const response = await vectorStore.similaritySearch("RENDITION", 1);
    return response;
}

async function get_collection() {
    const client = new ChromaClient({
        path: 'http://localhost:8000'
    });

  // Get all documents from the collection
//   const documents = await client.query('rendition');

  api_key = process.env.OPENAI_API_KEY;
  const emb_fn = new OpenAIEmbeddingFunction({
    openai_api_key: api_key, 
    model: "text-embedding-3-small"
  });

  const collections = await client.listCollections();

  console.log(collections);

//   const collection = client.collection('imdb_reviews');
  let collection = await client.getCollection({
    name: "posts-actors",
    embeddingFunction: emb_fn,
  });
  console.log(collection);
  var items = await collection.peek(); // returns a list of the first 10 items in the collection
  var count = await collection.count(); // returns the number of items in the collection

  console.log(count);

  return items
}

get_connection().then((res) => {
    console.log(res)
    get_collection().then((res) => {
        console.log(res)
    })
})

