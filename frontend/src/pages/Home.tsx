import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import config from "../../config.json";
import PostComponent from "../components/PostComponent";
import CreatePostComponent from "../components/CreatePostComponent";
import { useNavigate } from "react-router-dom";
axios.defaults.withCredentials = true;

export default function Home() {
  interface Feed {
    username: string;
    parent_post: number;
    title: string;
    content: string;
  }

  const { username } = useParams();
  const rootURL = config.serverRootURL;
  const [feed, setFeed] = useState<Feed[]>([]);

  const navigate = useNavigate();

  const friends = () => {
    navigate("/" + username + "/friends");
  };

  const chat = () => {
    navigate("/" + username + "/chat");
  };

  // TODO: add state variable for posts

  const fetchData = async () => {
    // TODO: fetch posts data and set appropriate state variables
    try {
      const feedResponse = await axios.get(`${rootURL}/${username}/feed`);
      setFeed(feedResponse.data);
    } catch (error) {
      console.error("Error fetching feed data:", error);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="w-screen h-screen">
      <div className="w-full h-16 bg-slate-50 flex justify-center mb-2">
        <div className="text-2xl max-w-[1800px] w-full flex items-center">
          Pennstagram - {username} &nbsp;
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
            onClick={chat}
          >
            Chat
          </button>
        </div>
      </div>

      <div className="h-full w-full mx-auto max-w-[1800px] flex flex-col items-center space-y-4">
        <CreatePostComponent updatePosts={fetchData} />
        {
          // TODO: map each post to a PostComponent
          feed.map((feed, index) => (
            <PostComponent
              key={index}
              title={feed.title}
              user={feed.username}
              description={feed.content}
            />
          ))
        }
      </div>
    </div>
  );
}
