import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import { useState } from "react";
import axios from "axios";
import config from "../../config.json";

export default function PostComponent({
  title = "Post title",
  user = "arnavchopra",
  description = "Lorem ipsum dolor sit amet consectetur adipisicing elit. Rem porro consequatur impedit dolor, soluta rerum mollitia ut eos fugiat! Amet nam voluptate quos delectus rem enim veritatis eius iste! Et.",
  image = "",
  post_id = -1,
  username = "",
  numlikes = 0,
  comments = [],
  liked = false,
  dark = false,
}: {
  title: string;
  user: string | undefined;
  description: string;
  image: string;
  post_id: number;
  username: string | undefined;
  numlikes: number | undefined;
  liked: boolean;
  comments: string[] | undefined;
  commentUsers: string[] | undefined;
  dark: boolean;
}) {
  const rootURL = config.serverRootURL;
  const [like, setLike] = useState(liked);
  const [com, setCom] = useState("");
  const light = ["bg-white", "bg-slate-50"];
  const dark2 = ["bg-black", "bg-gray-700"];
  const text = ["text-white", "text-black"];

  const changeLike = async () => {
    try {
      if (like) {
        setLike(false);
        await axios.post(`${rootURL}/${username}/unLike`, {
          post_id: post_id,
        });
      } else {
        setLike(true);
        await axios.post(`${rootURL}/${username}/addLike`, {
          post_id: post_id,
        });
      }
    } catch (error) {
      console.error("Error fetching feed data:", error);
    }
  };

  const addComment = async () => {
    try {
      await axios.post(`${rootURL}/${username}/addComment`, {
        post_id: post_id,
        comment: com,
      });
      setCom("");
    } catch (error) {
      console.error("Error fetching feed data:", error);
    }
  };

  return (
    <div
      className={`rounded-md w-full max-w-[1000px] space-y-2 p-3 ${
        dark ? dark2[1] : light[1]
      }`}
    >
      <div className={`${dark ? text[0] : text[1]}`}>
        <span className="font-semibold"> @{user} </span>
        posted
      </div>
      {title && title != "null" && (
        <div className={`text-2xl font-bold $${dark ? text[0] : text[1]}`}>
          {title}
        </div>
      )}
      {image && <img src={image} style={{ width: "300px", height: "200px" }} />}
      <div className={`${dark ? text[0] : text[1]}`}>{description}</div>
      <FavoriteBorderIcon
        className={`${
          like ? "text-red-500" : dark ? text[0] : text[1]
        } cursor-pointer`}
        onClick={() => changeLike()}
      />{" "}
      {numlikes ? <span> {numlikes}</span> : <span>0</span>}
      <div className={`${dark ? text[0] : text[1]}`}> Comments: </div>
      {comments?.map((inp) => (
        <div> {inp[1] + ":  " + inp[0]} </div>
      ))}
      <form>
        <textarea
          placeholder="Content"
          value={com}
          onChange={(e) => setCom(e.target.value)}
          className="border border-gray-300 p-2 rounded-md mb-2"
          rows={4}
          required
        ></textarea>
        <button
          type="button"
          className="px-4 py-2 rounded-md bg-indigo-500 outline-none font-bold text-white"
          onClick={addComment}
        >
          Create Comment
        </button>
      </form>
    </div>
  );
}
