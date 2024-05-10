import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import config from "../../config.json";
import PostComponent from "../components/PostComponent";
import CreatePostComponent from "../components/CreatePostComponent";
import { useNavigate } from "react-router-dom";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { Switch } from "@mui/material";
import InfiniteScroll from "react-infinite-scroll-component";
axios.defaults.withCredentials = true;

export default function Home({ dark, toggleDarkTheme }) {
  interface Feed {
    post_id: number;
    user: string | undefined;
    title: string;
    img_url: string;
    captions: string;
    username: string | undefined;
    numlikes: number | undefined;
    liked: boolean;
    comments: any;
  }

  const { username } = useParams();
  const rootURL = config.serverRootURL;
  const [feed, setFeed] = useState<Feed[]>([]);

  const light = ["bg-white", "bg-slate-50"];
  const dark2 = ["bg-black", "bg-gray-700"];
  const text = ["text-white", "text-black"];

  const navigate = useNavigate();

  const friends = () => {
    navigate("/" + username + "/friends");
  };

  const chat = () => {
    navigate("/" + username + "/chat");
  };
  const logout = async () => {
    try {
      await axios.get("/logout");
    } catch (error) {
      console.log(error);
    }
    navigate("/");
  };

  const profile = () => {
    navigate("/" + username + "/profile");
  };

  // TODO: add state variable for posts

  const fetchData = async (end: number) => {
    // TODO: fetch posts data and set appropriate state variables
    try {
      const feedResponse = await axios.get(
        `${rootURL}/${username}/${end}/feed`
      );

      if (feedResponse.status == 403) {
        navigate("/");
      }
      if (feedResponse.status == 200) {
        console.log(feedResponse.data.results);
        setFeed(feedResponse.data.results);
      }
    } catch (error) {
      console.error("Error fetching feed data:", error);
      //navigate("/");
    }
  };

  useEffect(() => {
    fetchData(30);
  }, []);

  return (
    <div
      className={` ${dark ? dark2[0] : light[0]}  ${dark ? text[0] : text[1]}`}
    >
      <div className="w-full h-16 border flex justify-center mb-2">
        <div className="text-2xl max-w-[1800px] w-full flex items-center">
          <div className={``}>Pennstagram - {username} &nbsp;</div>
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
          >
            Feed
          </button>
          &nbsp;
          <button
            type="button"
            className="px-2 py-2 rounded-md bg-gray-500 outline-none text-white"
            onClick={chat}
          >
            AI Chat
          </button>
          &nbsp;
          <button
            type="button"
            className="px-2 py-2 rounded-md bg-gray-500 outline-none text-white"
            onClick={logout}
          >
            Logout
          </button>
          <Switch checked={dark} onChange={toggleDarkTheme} />
        </div>
      </div>

      <div className="h-full w-full mx-auto max-w-[1800px] flex flex-col items-center space-y-4">
        <CreatePostComponent updatePosts={() => fetchData(30)} dark={dark} />
        {feed && (
          <InfiniteScroll
            dataLength={feed.length} //This is important field to render the next data
            next={() => fetchData(feed.length + 30)}
            hasMore={true}
            loader={<h4>Loading...</h4>}
            endMessage={
              <p style={{ textAlign: "center" }}>
                <b>You are at the end</b>
              </p>
            }
            scrollThreshold={0.95}
          >
            {" "}
            {
              // TODO: map each post to a PostComponent
              feed.map((feed, index) => (
                <PostComponent
                  key={index}
                  title={feed.title}
                  user={feed.username}
                  description={feed.captions}
                  image={feed.img_url}
                  post_id={feed.post_id}
                  username={username}
                  numlikes={feed.numlikes}
                  liked={feed.liked}
                  comments={feed.comments}
                  commentUsers={[]}
                  dark={dark}
                />
              ))
            }
          </InfiniteScroll>
        )}
      </div>
    </div>
  );
}
