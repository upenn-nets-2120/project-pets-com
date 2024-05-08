import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import config from "../../config.json";
import { useNavigate } from "react-router-dom";
axios.defaults.withCredentials = true;

interface Friend {
  user_id : number;
  username : string;
  firstName: string;
  lastName : string;
  timestamp : number | undefined;
}


export default function Friends() {
  const navigate = useNavigate();
  const { username } = useParams();
  const rootURL = config.serverRootURL;

  // TODO: add state variables for friends and recommendations

  const [friends, setFriends] = useState<Friend[]>([]);
  const [recommendations, setRecommendations] = useState<Friend[]>([]);

  const FriendComponent = ({
    index,
    person_id,
    person_username,
    firstName,
    lastName,
    time,
    add = true,
    remove = true,
  }: {
    index : number;
    person_id : number;
    person_username : string;
    firstName: string;
    lastName : string;
    time : number;
    add: boolean | undefined;
    remove: boolean | undefined;
  }) => {
    const follow = async () => {
      try {
        const response = await axios.post(
          `${config.serverRootURL}/${username}/follow`,
          {personID: person_id},
          { 
            withCredentials: true,
            headers: {
              'Content-Type': 'application/json' 
            }
          }
        );
        const updatedRecommendations = [...recommendations];
        const updatedFriends = [...friends];
        const newFriend = updatedRecommendations.splice(index, 1);
        updatedFriends.push(newFriend[0])
        setRecommendations(updatedRecommendations);
        setFriends(updatedFriends);
      } catch (error) {
        console.error("Error in follow:", error);
      } 
    };
  
    const unfollow = async () => {
      try {
        const response = await axios.post(
          `${config.serverRootURL}/${username}/unfollow`,
          {personID: person_id},
          { 
            withCredentials: true,
            headers: {
              'Content-Type': 'application/json' 
            }
          }
        );
        const updatedRecommendations = [...recommendations];
        const updatedFriends = [...friends];
        const newRec = updatedFriends.splice(index, 1);
        updatedRecommendations.push(newRec[0]);
        setRecommendations(updatedRecommendations);
        setFriends(updatedFriends);
      } catch (error) {
        console.error("Error in follow:", error);
      } 
    };

    function formatTimestamp(timestamp : number) {
      const secondsAgo = Math.floor((Date.now() - timestamp) / 1000);
      if (secondsAgo < 60) {
        return "Online";
      } else if (secondsAgo < 3600) {
        const minutes = Math.floor(secondsAgo / 60);
        return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
      } else if (secondsAgo < 86400) {
        const hours = Math.floor(secondsAgo / 3600);
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
      } else {
        const days = Math.floor(secondsAgo / 86400);
        return `${days} day${days > 1 ? 's' : ''} ago`;
      }
    }
  
    return (
      <div className="rounded-md bg-slate-100 p-3 flex space-x-2 items-center flex-auto justify-between">
        <div className="font-semibold text-base">
          {person_username}, {firstName} {lastName} 
          <span className="text-xs text-gray-500">{formatTimestamp(time)}</span>
        </div>
        <div className="flex space-x-2">
          {add && (
            <button className="bg-blue-500 text-white px-3 py-1 rounded-md"
              onClick={follow}
            >
              Add
            </button>
          )}
          
          {remove && (
            <button className="bg-red-500 text-white px-3 py-1 rounded-md"
             onClick={unfollow}
            >
              Remove
            </button>
          )}
        </div>
      </div>
    );
  };

  const feed = () => {
    navigate("/" + username + "/home");
  };

  const chat = () => {
    navigate("/" + username + "/chat");
  };

  const profile = () => {
    navigate("/" + username + "/profile");
  };


  useEffect(() => {
    const fetchData = async () => {
      try {
        // TODO: fetch the friends and recommendations data and set the appropriate state variables
        const friendsResp = await axios.get(
          `${rootURL}/${username}/friends`
        );
        var friendsResponse;
        var recommendationsResponse;

        if (friendsResp.data.results.length > 0) {
          friendsResponse = friendsResp.data.results;
        } else {
          friendsResponse = []
        }

        const recommendationsResp = await axios.get(
          `${rootURL}/${username}/recommendations`
        );
        if (recommendationsResp.data.results.length > 0) {
          recommendationsResponse = recommendationsResp.data.results;
        } else {
          recommendationsResponse = []
        }
        console.log(recommendationsResponse)

        setFriends(friendsResponse);
        setRecommendations(recommendationsResponse);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
  }, []);

  return (
    <div>
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
            onClick={chat}
          >
            Chat
          </button>
        </div>
      </div>
      <div className="h-full w-full mx-auto max-w-[1800px] flex space-x-4 p-3">
        <div className="font-bold text-2xl">
          {`${username}'s friends`}
          <div className="space-y-2">
            {
              // TODO: map each friend of the user to a FriendComponent
              friends.map((friend, index) => {if (friend.timestamp) {return (
                <FriendComponent
                  index={index}
                  person_id={friend.user_id}
                  person_username={friend.username}
                  firstName={friend.firstName}
                  lastName={friend.lastName}
                  time={friend.timestamp}
                  add={false}
                  remove={true}
                />
              )}
            else {
              return (
                <FriendComponent
                  index={index}
                  person_id={friend.user_id}
                  person_username={friend.username}
                  firstName={friend.firstName}
                  lastName={friend.lastName}
                  time={1704067200000}
                  add={false}
                  remove={true}
                />
              )
            }})
            }
          </div>
        </div>
        <div className="font-bold text-2xl">
          {`${username}'s recommended friends`}
          <div className="space-y-2">
            {
              // TODO: map each recommendation of the user to a FriendComponent
              recommendations.map((recommendation, index) => {
                if (recommendation.timestamp) {return (
                <FriendComponent
                  index={index}
                  person_id={recommendation.user_id}
                  person_username={recommendation.username}
                  firstName={recommendation.firstName}
                  lastName={recommendation.lastName}
                  time={recommendation.timestamp}
                  add={true}
                  remove={false}
                />
              )}
            else {
              return (
                <FriendComponent
                  index={index}
                  person_id={recommendation.user_id}
                  person_username={recommendation.username}
                  firstName={recommendation.firstName}
                  lastName={recommendation.lastName}
                  time={1704067200000}
                  add={true}
                  remove={false}
                />
              )
            }})
            }
          </div>
        </div>
      </div>
    </div>
  );
}
