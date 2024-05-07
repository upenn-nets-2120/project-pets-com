import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import { useEffect, useState } from "react";
import axios from "axios";
import config from "../../config.json";

export default function PostComponent({
  title = "Post title",
  user = "arnavchopra",
  description = "Lorem ipsum dolor sit amet consectetur adipisicing elit. Rem porro consequatur impedit dolor, soluta rerum mollitia ut eos fugiat! Amet nam voluptate quos delectus rem enim veritatis eius iste! Et.",
  image = "",
  post_id = -1,
  username = "",
}: {
  title: string;
  user: string | undefined;
  description: string;
  image: string;
  post_id: number;
  username: string | undefined;
}) {
  const rootURL = config.serverRootURL;
  const [like, setLike] = useState(false);
  const [comments, setComments] = useState([]);
  const [com, setCom] = useState("");

  const fetchData = async () => {
    // TODO: fetch posts data and set appropriate state variables
    try {
      const likeResponse = await axios.get(
        `${rootURL}/${username}/${post_id}/getLike`
      );
      setLike(likeResponse.data.results);

      const commentsResponse = await axios.get(
        `${rootURL}/${username}/${post_id}/getComments`
      );
      setComments(commentsResponse.data.results.map((inp : any) => inp.comment));
    } catch (error) {
      console.error("Error fetching feed data:", error);
      //navigate("/");
    }
  };

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

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="rounded-md bg-slate-50 w-full max-w-[1000px] space-y-2 p-3">
      <div className=" text-slate-800">
        <span className="font-semibold"> @{user} </span>
        posted
      </div>
      <div className="text-2xl font-bold">{title}</div>
      {image && <img src={image} style={{ width: "300px", height: "200px" }} />}
      <div className="">{description}</div>
      <button
        className={`${like ? "text-red-500" : "text-black"}`}
        onClick={changeLike}
      >♡</button>
      <div> Comments: </div>
      {comments?.map((inp) => (
        <div> {inp} </div>
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
