const WebSocket = require('ws');

const connections = new Map()
/*
//connections schema
//key: user_id
//value: websocket connection (STATUS: ALIVE/DEAD), timesout automatically after 60s
//value: chat_ids [] (chat_id, chat_name)
*/
const websocket = async (ws, req) => {
    if (req.session == null || req.session.user_id == null) {
        console.error("Websocket 403: Not signed in")
        ws.close()
        return
    }
    ws.on('message', function(message) {
        const userID = req.session.user_id
        //case 0: initialization / getting chats
        console.log("Websocket 200:", message)
        const msg = JSON.parse(message)

        connections.set(userID,{websocket:ws, chat_ids:msg.chat_ids})
        if (msg.purpose == "init") {
            connections.set(userID,{websocket:ws, chat_ids:msg.chat_ids})
        }
        //case 1: sending messages
        else if (msg.purpose == "Chat") {
            connections.forEach((connection,user_id) => {
                if (connection.chat_ids.includes(msg.chat_id)) { //if chat_id in a user's chat_id
                    connection.websocket.send(JSON.stringify(msg))
                }
            })
        }
        //case 2: sending invites --> notify/alert receiver of invite
        else if (msg.purpose == "Send Invite") {
            connections.forEach((connection,user_id) => {
                if (user_id == msg.person_id) { 
                    connection.websocket.send(JSON.stringify({purpose:"Received Invite", chat_id:msg.chat_id, chat_name:msg.chat_name, inviter_id:userID}))
                }
            })
            connections.set(userID,{websocket:ws, chat_ids:msg.chat_ids})
        }
        //case 3: handling accepted invite
        else if (msg.purpose == "Handle Accept Invite") {
            connections.forEach((connection,user_id) => {
                if (user_id == userID) { 
                    if (!connection.chat_ids.includes(msg.chat_id)) {
                        connection.chat_ids.push(msg.chat_id)
                    }
                }
            })
        }
        //case 4: leave chat
        else if (msg.purpose == "Leave Chat") {
            connections.forEach((connection,user_id) => {
                if (user_id == userID) { 
                    if (!connection.chat_ids.includes(msg.chat_id)) {
                        connection.chat_ids.splice(connection.chat_ids.indexOf(msg.chat_id),1)
                    }
                }
            })
        }
        //case 5: receiving/handling invites --> SPECIAL CASE: accept & first to join case: accept inviter too
        else if (msg.purpose == "Handle Accept Invite Special") {
            connections.forEach((connection,user_id) => {
                if (user_id == msg.inviter_id) { //if chat_id in a user's chat_id
                    connection.websocket.send(JSON.stringify({purpose:"Add to Chat Special", chat_id:msg.chat_id, chat_name:msg.chat_name}))
                }
            })
        }
    });    
    };

//DEBUGGING: connections for dead websockets every 5 seconds
// const interval = setInterval(async function() {
//     // method to be executed;
//     //for each connection, check if its alive
//     console.log("websockets says hi")
//     connections.forEach((conn,user_id) => {
//         console.log(`user_id:${user_id}  chat_ids:${conn.chat_ids}`)
//     })
//     }, 5000);
    
var routes = {
    websocket:websocket
}
module.exports = routes;