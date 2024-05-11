README file that describes 1) the team number and team name, 2) the full names and SEAS login names of all team members, 3) a description of features implemented, 4) any extra credit claimed, 5) a list of source files included, 6) a declaration that all the code you are submitting was written by you, and 7) instructions for building an running your project. The instructions must be sufficiently detailed for us to set up and run your application.

## Team Number & Name

Number: g23
Name: Pets.com

## Full names & SEAS login names:

- Eda Orakci eorakci@seas.upenn.edu
- Owen Lester owlester@sas.upenn.edu
- Tommy Li yuangli@seas.upenn.edu
- Edward Liu edliu@wharton.upenn.edu

## Description of features implemented

Pennstagram is built on node.js and React with external endpoints to:

- AWS RDS Database for persistent data
- AWS S3 for images and other large files
- Spark for cloud & distributed computing of algorithms (Post adsorption)
- Kafka for connections to other social media apps & Twitter Feed
- ChromaDB for actor-image linking, natural language search & AI chatbot.
- Frontend-Backend are connected by REST API, as well as Websockets for the Chats page.

## Extra Credit

- Websocket for chats
- Light/Dark Mode
- Infinite Scroll
- User search with AI chat

## Source Files:

export AWS_ACCESS_KEY_ID=[AWS Access Key] \
export AWS_SECRET_ACCESS_KEY=[AWS Secret Key] \
export AUTH_TOKEN=[AWS Auth Token] \
export OPENAI_API_KEY=[OpenAI Key] \
export RDS_USER=admin \
export RDS_PWD=rds-password \
export PHOTOS_BUCKET_NAME=photos-pets-com \
export EMBEDDINGS_BUCKET_NAME=embeddings-pets-com
export USE_PERSISTENCE=TRUE \

## All code written by the team

## Instructions

NOTE:`npm install` where applicable

1. start AWS Session, Docker Session, Docker Terminal, go to project-pets-com: `docker exec -it nets2120 bash`
2. echo AWS credentials: `echo "[copied config]" > ~/.aws/credentials`
3. use source: `source .env`
4. start the tunnel (just like hw) in Terminal: \
   \
    `sh -i ~/.ssh/pets3.pem -4 -L 3306:petsdatabase.cxjczv6yitmm.us-east-1.rds.amazonaws.com:3306 ubuntu@[your-ec2-address]` \
   \
    `mysql --host=petsdatabase.cxjczv6yitmm.us-east-1.rds.amazonaws.com --user=admin --password=rds-password`
5. start ChromaDB: `chroma run --host 0.0.0.0 --path ./data/chromadb`
6. start backend: `npm start`
7. go to frontend folder, start frontend:  
   \
   `cd frontend`
   \
   `npm run dev --host`
8. Running Spark algorithm: in root directory, `python3 post_rank_algo.py`

9. ChromaDB instructions:

- Use `chroma run --host 0.0.0.0 --port 8000 --path ./data/chromadb' to run LLM Chat.`
  Note that it is possible to load entire mysql databases posts and users by running `embed_posts_database()` on routes/chroma_routes/search()
- Use `chroma run --host 0.0.0.0' for face API`
- Unzip files under data/chromadb. This is posts-actors db + faceAPI embeddings.
