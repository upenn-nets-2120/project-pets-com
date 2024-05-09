const fs = require('fs');
const pathPhoto = require('path');

var path = require('path');
const { ChromaClient } = require("chromadb");
const tf = require('@tensorflow/tfjs-node');
const faceapi = require('@vladmandic/face-api');
const dbsingleton = require('../models/db_access.js');
const db = dbsingleton;


const uploadDirectory = pathPhoto.join(__dirname, '..', 'uploads');
let optionsSSDMobileNet;

async function initializeFaceModels() {
    console.log("Initializing FaceAPI...");
  
    await tf.ready();
    await faceapi.nets.ssdMobilenetv1.loadFromDisk('model');
    optionsSSDMobileNet = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5, maxResults: 1 });
    await faceapi.nets.faceLandmark68Net.loadFromDisk('model');
    await faceapi.nets.faceRecognitionNet.loadFromDisk('model');
  
    return;
}

/**
 * Compute the face embeddings within an image file
 * 
 * @param {*} imageFile 
 * @returns List of detected faces' embeddings
 */
async function getEmbeddings(imageFile) {
    const buffer = fs.readFileSync(imageFile);
    const tensor = tf.node.decodeImage(buffer, 3);
  
    const faces = await faceapi.detectAllFaces(tensor, optionsSSDMobileNet)
      .withFaceLandmarks()
      .withFaceDescriptors();
    tf.dispose(tensor);
  
    // For each face, get the descriptor and convert to a standard array
    return faces.map((face) => getArray(face.descriptor));
};

async function findTopKMatches(collection, image, k) {
    var ret = [];
  
    var queryEmbeddings = await getEmbeddings(image);
    for (var queryEmbedding of queryEmbeddings) {
      var results = await collection.query({
        queryEmbeddings: queryEmbedding,
        // By default embeddings aren't returned -- if you want
        // them you need to uncomment this line
        // include: ['embeddings', 'documents', 'metadatas'],
        nResults: k
      });
  
      ret.push(results);
    }
    return ret;
}

/**
 * Helper function, converts "descriptor" Int32Array to JavaScript array
 * @param {Int32Array} array 
 * @returns JavaScript array
 */
const getArray = (array) => {
    var ret = [];
    for (var i = 0; i < array.length; i++) {
      ret.push(array[i]);
    }
    return ret;
}
  

var getActors = async function(req, res) {
    const image = req.file;

    if (!image) {
        return res.status(400).send('No file uploaded');
    }

    try {
        if (!fs.existsSync(uploadDirectory)) {
            fs.mkdirSync(uploadDirectory, { recursive: true });
        }

        const destinationPath = pathPhoto.join(uploadDirectory, 'profile.jpg');

        fs.writeFile(destinationPath, image.buffer, (err) => {
            if (err) {
                console.error('Error writing file:', err);
                res.status(500).send('Error writing file');
            }
        });

        const client = new ChromaClient();

        await initializeFaceModels();
        console.info("Face models initialized.");

        const collection = await client.getOrCreateCollection({
            name: "face-api",
            embeddingFunction: null, // Ensure this is intended to be null
            metadata: { "hnsw:space": "l2" } // L2 space (squared L2 distance)
        });

        console.log(collection)

        console.info("Collection ready for search.");
        const search = '/nets2120/project-pets-com/uploads/profile.jpg';
        console.log(`\nTop-k indexed matches to ${search}:`);

        // Assuming findTopKMatches is properly defined and ready to use
        const matches = await findTopKMatches(collection, search, 5);

        matches.forEach((item, index) => {
            item.ids.forEach((id, idx) => {
            console.log(id)
            });
        });

        const matchesIds = matches[0].ids
        const GetNconsts = matchesIds[0].map(item => item.replace('.jpg-1', ''));
        const formattedIds = GetNconsts.map(id => `'${id}'`).join(',');


        if(formattedIds.length > 0){

        const getFromActorsQuery = `
        SELECT actor_name, actor_id 
        FROM actors 
        WHERE actors.actor_id IN (${formattedIds})
      `;
       const results = await db.send_sql(getFromActorsQuery);

       return res.status(200).json({ results: results });
        }
        return;

    } catch (error) {
        console.log(error)
        return res.status(500).json({error: 'Error querying database.', error});
    };
}

var linkActor = async function(req, res) {
    const username = req.body.username;
    const actorID = req.body.actor_id;

    const findDuplicate = `SELECT * FROM userActorLink WHERE username = '${username}' AND actor_id = '${actorID}'`;
    const insertUserLink = `INSERT INTO userActorLink (username, actor_id) VALUES ('${username}', '${actorID}')`;
    try { 
        const duplicate = await db.send_sql(findDuplicate);
        if (duplicate.length > 0){
            return res.status(201).json({success: "Actors already linked to user."});
        }
        await db.insert_items(insertUserLink);
        console.log("Actors linked to user!") 
        return res.status(201).json({success: "Actors linked to user."});
    } catch (error) {
        return res.status(500).json({error: 'Error querying database.', error});
    }
}

var getLinks = async function(req, res) {
    const username = req.params.username;
    console.log(username)
    const findLinks = `SELECT DISTINCT actors.actor_name
    FROM userActorLink
    JOIN actors ON userActorLink.actor_id = actors.actor_id
    WHERE userActorLink.username = '${username}';`;

    try { 
        const links = await db.send_sql(findLinks);
        console.log(links) 
        if (links.length < 1) {
            return res.status(404).json({error: 'No links here!'});
        }
        return res.status(200).json({results: links});
    } catch (error) {
        return res.status(500).json({error: 'Error querying database.', error});
    }
}

var faceRoutes = {
    getActors, 
    linkActor, 
    getLinks
}
module.exports = faceRoutes;