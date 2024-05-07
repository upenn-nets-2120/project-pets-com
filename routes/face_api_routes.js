const fs = require('fs');
const pathPhoto = require('path');

var path = require('path');
const { ChromaClient } = require("chromadb");
const tf = require('@tensorflow/tfjs-node');
const faceapi = require('@vladmandic/face-api');

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
        let ids = [];

        matches.forEach((item, index) => {
            item.ids.forEach((id, idx) => {
            console.log(id)
        });
        console.log(matches[0].ids)

        
    });
    } catch (err) {
        console.error('Error during the face model or collection setup:', err);
        // Handle other actions like sending HTTP status if this is a server-side script
    }
}

var faceRoutes = {
    getActors
}
module.exports = faceRoutes;