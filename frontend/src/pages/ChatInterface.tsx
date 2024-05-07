import { useState, useEffect, useRef} from "react";
import axios from "axios";
import { useParams } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import config from "../../config.json";

axios.defaults.withCredentials = true;

interface Chat {
  chat_id : number;
  chat_name : string;
  inviter_id : number;
}

interface Friend {
  chat_id : number,
  user_id : number;
  username : string;
  firstName: string;
  lastName : string;
}

interface Message {
  sender : string;
  message: string;
  timestamp: number;
}
const x =new WebSocket(config.webSocketRootURL);
export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<string>("");
  const { username } = useParams();
  const [chats, setChats] = useState<Chat[]>([]);
  const [newChatName, setNewChatName] = useState<string>("");
  const [chatID, setChatID] = useState(-2);
  const [chatName, setChatName] = useState<string>("Welcome to Pennstagram");
  const [invite, setInvites] = useState<Chat[]>([]);
  const [friendsList, setFriendsList] = useState<Friend[]>([]);
  const [showInvitePopup, setShowInvitePopup] = useState(false); // State to manage popup visibility
  const [showCreatePopup, setShowCreatePopup] = useState(false); // State to manage popup visibility
  const socket = useRef(Object());
  const navigate = useNavigate();

  useEffect(() => {
    socket.current = new WebSocket(config.webSocketRootURL);
    socket.current.onopen = () => console.log("ws opened");
    socket.current.onclose = () => console.log("ws closed");

    const wsCurrent = socket.current;

    return () => {
        wsCurrent.close();
    };
}, []);

  const feed = () => {
    navigate("/" + username + "/home");
  };
  const friends = () => {
    navigate("/" + username + "/friends");
  };
  const profile = () => {
    navigate("/" + username + "/profile");
  };
const loadFriendsList = async () => {
  try {
    const response = await axios.get(`${config.serverRootURL}/${username}/friends`);
    setFriendsList(response.data.results);
  } catch (error) {
    console.error("Error loading friends list:", error);
  }
};

const loadChats = async () => {
  try {
    const response = await axios.get(`${config.serverRootURL}/${username}/get_chats`);
    setChats(response.data.results);
  } catch (error) {
    console.error("Error loading chats:", error);
  }
}

const loadInvites = async () => {
  try {
    const response = await axios.get(`${config.serverRootURL}/${username}/get_invites`);
    setInvites(response.data.results);
  } catch (error) {
    console.error("Error loading invites:", error);
  }
}

useEffect(() => {
  console.log("friend's list")
  loadFriendsList(); // Load friends list on component mount
}, []);

useEffect(() => {
  console.log("chats")
  loadChats();
}, []);

useEffect(() => {
  console.log("invites")
  loadInvites();
},[]);

//Open sockets after chats etc. have been loaded
useEffect(() => {
  console.log("sockets")
if (!socket.current) return;
socket.current.onopen =  () => {
  console.log('WebSocket connection established.');
  //send all of the users's chats
  if (chats.length == 0) {
    loadChats()
  }
  const message = {purpose: "init", chat_ids:chats.map(x=>(x.chat_id))} //return list of chats upon initialization
  socket.current.send(JSON.stringify(message));
}

socket.current.onmessage =  (event : any) => {
  console.log(event.data)
  const receivedEvent = JSON.parse(event.data);
  if (receivedEvent.purpose == "Chat") {
    console.log(messages)
    setMessages([...messages,{sender: receivedEvent.sender, message: receivedEvent.message, timestamp:receivedEvent.timestamp}]);
  } else if (receivedEvent.purpose == "Received Invite") {
    console.log(invite)
    setInvites([...invite,{chat_id: receivedEvent.chat_id, chat_name: receivedEvent.chat_name, inviter_id: receivedEvent.inviter_id}])
  } else if (receivedEvent.purpose == "Add to Chat Special") {
    console.log(chats)
    setChats([...chats,{chat_id: receivedEvent.chat_id, chat_name: receivedEvent.chat_name, inviter_id: -1}])
  }
}

socket.current.onerror = (event : any) => {
  console.log(event)
}
})


const MessageComponent = ({ sender, message }: { sender: string; message: string;}) => {
  return (
    <div className={`w-full flex ${(sender === "user" || sender === username) && "justify-end"}`}>
      <div className={`text-left max-w-[70%] p-3 rounded-md break-words ${(sender === "chatbot" || sender !== username) ? "bg-blue-100" : "bg-slate-200"}`}>
        <div className="text-sm">{message}</div>
        <div className="text-xs text-gray-500">{sender}</div>
      </div>
    </div>
  );
};

const open_invite_popup = () => {
  setShowInvitePopup(true);
};

const close_invite_popup = () => {
  setShowInvitePopup(false);
};

const InviteSelector = ({
  chat_id,
  friend_id,
  friend_username,
  friend_firstName,
  friend_lastName,
  callback
}: {
  chat_id : number,
  friend_id : number;
  friend_username : string;
  friend_firstName : string;
  friend_lastName : string;
  callback : Function;
}) => {
  return (
    <div className="rounded-md bg-slate-100 p-3 flex space-x-2 items-center flex-auto justify-between">
      <div className="font-semibold text-base">
        {friend_username}, {friend_firstName} {friend_lastName}
      </div>
      <div className="flex space-x-2">
        {(
          <button className="bg-blue-500 text-white px-3 py-1 rounded-md"
            onClick={()=>callback(friend_id,chat_id)}
          >
            Invite
          </button>
        )}
      </div>
    </div>
  );
};
  
  const ChatComponent = ({
    index,
    chat_id,
    chat_name,
    inviter_id,
    join = true,  // can be joined (an invite)
    leave = true, // can be left (a chat)
    enter = false, // can be entered <== do everything about the set up here
  }: {
    index : number;
    chat_id : number;
    chat_name : string;
    inviter_id : number;
    join: boolean | undefined;
    leave: boolean | undefined;
    enter: boolean | undefined;
  }) => {
    const chat_accept_invite = async () => {
      try {
        const response = await axios.post(
          `${config.serverRootURL}/${username}/chat_handle_invite`,
          {
            chat_id: chat_id,
            inviter_id: inviter_id,
            accept : true
          },
          { 
            withCredentials: true,
            headers: {
              'Content-Type': 'application/json' 
            }
          }
        );

        const inviteC = [...invite];
        const acceptedChat = inviteC.splice(index, 1);  //just remove
        const chatC = [...chats]
        chatC.push(acceptedChat[0]) // add to chats
        setInvites(inviteC);
        setChats(chatC);

        const added = response.data.addedChat;
        const message = {purpose: "Handle Accept Invite", chat_id:chat_id, chat_name:chat_name, inviter_id: inviter_id, chat_ids:[...chats].map(x=>(x.chat_id))}
        socket.current.send(JSON.stringify(message));
        if (added == 1) {
          //The Special Case
          const message = {purpose: "Handle Accept Invite Special", chat_id:chat_id, chat_name:chat_name, inviter_id: inviter_id, chat_ids:[...chats].map(x=>(x.chat_id))}
          socket.current.send(JSON.stringify(message));
        }
      } catch (error) {
        console.error("Error in chat_accept_invite:", error);
      } 
    }
    const chat_reject_invite = async () => {
      try {
        const response = await axios.post(
          `${config.serverRootURL}/${username}/chat_handle_invite`,
          {
            chat_id: chat_id,
            inviter_id: inviter_id,
            accept : false
          },
          { 
            withCredentials: true,
            headers: {
              'Content-Type': 'application/json' 
            }
          }
        );
        const inviteC = [...invite];
        inviteC.splice(index, 1);  //just remove
        setInvites(inviteC);
      } catch (error) {
        console.error("Error in chat_reject_invite:", error);
      } 
    }

    const chat_leave = async () => {
      try {
        const response = await axios.post(
          `${config.serverRootURL}/${username}/chat_leave`,
          {chat_id: chat_id,
          },
          { 
            withCredentials: true,
            headers: {
              'Content-Type': 'application/json' 
            }
          }
        );
        const chatC = [...chats];
        chatC.splice(index, 1);  //just remove
        setChats(chatC);
        const message = {purpose: "Leave Chat", chat_id:chat_id, chat_ids:[...chats].splice(index,1)} //return list of chats upon initialization
        socket.current.send(JSON.stringify(message));
      } catch (error) {
        console.error("Error in chat_leave:", error);
      } 
    };

  
    return (
      <div className="rounded-md bg-slate-100 p-3 flex space-x-2 items-center flex-auto justify-between">
        <div className="font-semibold text-base">
          {chat_name}
        </div>
        <div className="flex space-x-2">
          {join && (
            <button className="bg-blue-500 text-white px-3 py-1 rounded-md"
              onClick={chat_accept_invite}
            >
              Join
            </button>
          )}
          {join && (
            <button className="bg-red-500 text-white px-3 py-1 rounded-md"
              onClick={chat_reject_invite}
            >
              Decline
            </button>
          )}
          {leave && (
            <button className="bg-blue-500 text-white px-3 py-1 rounded-md"
              onClick={()=>{setChatID(chat_id);open_invite_popup()}}
            >
              Invite
            </button>
          )}
          {leave && (
            <button className="bg-red-500 text-white px-3 py-1 rounded-md"
             onClick={chat_leave}
            >
              Leave
            </button>
          )}
          {enter && (
            <button 
             onClick={()=>{getMessages(chat_id,chat_name)}}
            >
              ➡️
            </button>
          )}
        </div>
      </div>
    );
  };

  const chat_create = async () => {
    try {
      const response = await axios.post(
        `${config.serverRootURL}/${username}/chat_create`,
        {chat_name: newChatName, 
        },
        { 
          withCredentials: true,
          headers: {
            'Content-Type': 'application/json' 
          }
        }
      );
      return response.data.chat_id;
    } catch (error) {
      console.error("Error in chat_create:", error);
    } 
  }

  //helper function
  const chat_invite = async (_chat_id: number, _chat_name: string, _other_id : number) => {
    try {
      const message = {purpose: "Send Invite", chat_id:_chat_id, chat_name:_chat_name, person_id: _other_id, chat_ids:[...chats].map(x=>(x.chat_id))}
      socket.current.send(JSON.stringify(message));
      const response = await axios.post(
        `${config.serverRootURL}/${username}/chat_invite`,
        {chat_id: _chat_id,
          person_id: _other_id,
        },
        { 
          withCredentials: true,
          headers: {
            'Content-Type': 'application/json' 
          }
        }
      );
    } catch (error) {
      console.error("Error in chat_invite:", error);
    } 
  }

  const getMessages = async(_chat_id :number, _chat_name : string) => {
    try {
        setChatID(_chat_id);
        setChatName(_chat_name)
        if (_chat_id == -1) {
          setMessages([{
            sender: "chatbot",
            message: "Hi there! I can recommend you posts you would like, or people you might want to follow. Ask away!",
            timestamp: Date.now()
          }])
        } else {
          const response = await axios.post(
            `${config.serverRootURL}/${username}/get_messages`,
            {chat_id: _chat_id
            },
            { 
              withCredentials: true,
              headers: {
                'Content-Type': 'application/json' 
              }
            }
          );
          if (response.data.results.length > 0) {
            console.log(response.data.results)
            const newMessages = response.data.results.sort((a : Message,b: Message) => {
              if (a.timestamp < b.timestamp) {
                return -1;
              } else {
                return 1;
              }
            });
            console.log(newMessages)
            setMessages(newMessages);
          } else {
            setMessages([]);
          }
        }
      } catch (error) {
      console.error("Error in getMessages:", error);
    }
  }


  const sendMessage = async (_chat_id : number) => {
    if (username == null) {
      console.log("username cannot be null");
      return;
    }
    if (_chat_id >= 0) { //Human
      try {
        const now = Date.now()
        const message = {purpose: "Chat", chat_id:_chat_id, sender: username, message: input, timestamp: now, chat_ids:[...chats].map(x=>(x.chat_id))}
        socket.current.send(JSON.stringify(message));
        const response = await axios.post(`//localhost:8080/${username}/chat_message`, {
          chat_id: _chat_id,
          message: input,
          timestamp: now
        });
      } catch (error) {
        console.error("Error sending message:", error);
      }
    } else { //AI 
      if (_chat_id != -1) {
        return 
      }
      try {
        const now = Date.now()
        setMessages([...messages, { sender: username, message: input, timestamp: now}]);
        const response = await axios.post(`//localhost:8080/${username}/movies`, {
          question: input,
          context: messages,
        });
        console.log(response.data);
        setMessages([
          ...messages,
          { sender: username, message: input, timestamp: now},
          { sender: "chatbot", message: response.data.message, timestamp: now},
        ]);
      } catch (error) {
        console.error("Error sending message:", error);
      }
    }
  };

  return (
    <div className="w-screen h-screen flex flex-col items-center">
      <div className="w-full h-16 bg-slate-50 flex justify-center mb-2">
        <div className="text-2xl max-w-[1800px] w-full flex items-center">
          Pennstagram - {username} &nbsp;
          <button
            type="button"
            className="px-2 py-2 rounded-md bg-gray-500 outline-none text-white"
            onClick={profile}
          >
            Profile
          </button>
          &nbsp;
          <button
            type="button"
            className="px-2 py-2 rounded-md bg-gray-500 outline-none text-white"
            onClick={friends}
          >
            Friends
          </button>
          &nbsp;
          <button
            type="button"
            className="px-2 py-2 rounded-md bg-gray-500 outline-none text-white"
            onClick={feed}
          >
            Feed
          </button>
          &nbsp;
          <button
            type="button"
            className="px-2 py-2 rounded-md bg-gray-500 outline-none text-white"
          >
            Chat
          </button>
        </div>
      </div>

      <div className="flex w-full">
          {/* Add your chat selection options here */}
          <div className="font-bold text">
          <button 
            className="outline-none px-3 py-1 rounded-md text-bold bg-indigo-600 text-white"
            onClick={()=>setShowCreatePopup(true)}
          >
            Create Chat
          </button>
          <br></br>
          {`${username}'s Invite Requests`}
          <div className="space-y-2">
          {invite.map((x,index) => <ChatComponent index={index} chat_id={x.chat_id} chat_name={x.chat_name} inviter_id={x.inviter_id} join={true} leave = {false} enter = {false}></ChatComponent>)}
          </div>
          {`${username}'s Chats`}
          <div className="space-y-2">
          {chats.map((x,index) => <ChatComponent index={index} chat_id={x.chat_id} chat_name={x.chat_name} inviter_id={-1} join={false} leave = {true} enter = {true}></ChatComponent>)}
          </div>
          {`AI Chat`}
          <div className="space-y-2">
          <ChatComponent index={-1} chat_id={-1} chat_name={"AI Chat"} inviter_id={-1} join={false} leave={false} enter = {true}></ChatComponent>
          </div>
        </div>
        <div className="w-3/4 flex flex-col items-left ml-20">
        <div className="font-bold text-3xl">{chatName}</div>
          <div className="h-[40rem] w-[30rem] bg-slate-100 p-3">
            <div className="h-[90%] overflow-scroll">
              <div className="space-y-2">
                {messages.map((msg, index) => (
                  <MessageComponent key={index} sender={msg.sender} message={msg.message} />
                ))}
              </div>
            </div>
            <div className="w-full flex space-x-2 mt-4">
              <input
                className="w-full outline-none border-none px-3 py-1 rounded-md"
                placeholder="Ask something!"
                onChange={(e) => setInput(e.target.value)}
                value={input}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    sendMessage(chatID);
                    setInput("");
                  }
                }}
              />
              <button
                className="outline-none px-3 py-1 rounded-md text-bold bg-indigo-600 text-white"
                onClick={()=>{sendMessage(chatID)}}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
       {/* Invite Selector Popup */}
       {showInvitePopup && (
        <div className="fixed top-0 left-0 w-screen h-screen bg-black bg-opacity-50 flex justify-center items-center">
          <div className="bg-white p-4 rounded-md shadow-md">
            <div className="text-lg font-bold mb-4">Invite Friend</div>
            <button
              className="top-0 right-0 text-red-500"
              onClick={close_invite_popup}
            >
              X
            </button>
            {friendsList.map((friend, index) => (
              <div key={index} className="flex items-center space-x-2">
                <InviteSelector chat_id={chatID} friend_id={friend.user_id} friend_username={friend.username} friend_firstName={friend.firstName} friend_lastName={friend.lastName} callback={() => {
                  chat_invite(chatID, chatName, friend.user_id)}
                  }></InviteSelector>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* CreatePopup Selector Popup */}
      {showCreatePopup && (
        <div className="fixed top-0 left-0 w-screen h-screen bg-black bg-opacity-50 flex justify-center items-center">
          <div className="bg-white p-4 rounded-md shadow-md">
            <div className="text-lg font-bold mb-4">Create Chat</div>
            <button
              className="top-0 right-0 text-red-500"
              onClick={()=>setShowCreatePopup(false)}
            >
              X
            </button>
            <br></br>
            <input
                className="w-full outline-none border-none px-3 py-1 rounded-md"
                placeholder="Your new Chat Name here!"
                onChange={(e) => {setNewChatName(e.target.value)}}
                value={newChatName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setNewChatName("");
                  }
                }}
              />
            {friendsList.map((friend, index) => (
              <div key={index} className="flex items-center space-x-2">
                <InviteSelector chat_id={0} friend_id={friend.user_id} friend_username={friend.username} friend_firstName={friend.firstName} friend_lastName={friend.lastName} 
                callback={async () => {
                  const _chat_id = await chat_create();
                  chat_invite(_chat_id, newChatName, friend.user_id);
                }}></InviteSelector>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}