import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import config from "../../config.json";
//import PostComponent from "../components/PostComponent";
//import CreatePostComponent from "../components/CreatePostComponent";
import { useNavigate } from "react-router-dom";
axios.defaults.withCredentials = true;

export default function Profile() {
  const navigate = useNavigate();
  const rootURL = config.serverRootURL;

  const { username } = useParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [file, setFile] = useState(null);
  const [fileURL, setFileURL] = useState("");
  const [links, setLinks] = useState([]);

  const [actors, setActors] = useState<Actor[]>([]);

  interface Actor {
    actor_name: string;
    actor_id: string;
    clicked: boolean;
  }

  //const [email, setEmail] = useState("");
  //const [affiliation, setAffiliation] = useState("");
  //const [birthday, setBirthday] = useState("");
  //const [firstName, setFirstName] = useState("");
  //const [lastName, setLastName] = useState("");

  const friends = () => {
    navigate("/" + username + "/friends");
  };

  const chat = () => {
    navigate("/" + username + "/chat");
  };

  const feed = () => {
    navigate("/" + username + "/home");
  };

  const fetchData = async () => {
    try {
      const linkResponse = await axios.get(
        `${config.serverRootURL}/${username}/getLinks`
      );

      if (linkResponse.status == 200) {
        setLinks(linkResponse.data.results);
      }
    } catch (error) {
      console.error("Error fetching feed data:", error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleFileChange = (e : any) => {
    const file = e.target.files[0];
    setFile(file);
    setFileURL(URL.createObjectURL(e.target.files[0]));
    //console.log(file);
  };

  const handleActorClick = async (index : any) => {
    setActors((prevActors) =>
      prevActors.map((actor, i) =>
        i === index ? { ...actor, clicked: !actor.clicked } : actor
      )
    );
    const clickedActor = actors[index];
    await axios.post(`${config.serverRootURL}/${username}/linkActor`, {
      actor_id: clickedActor.actor_id,
      username: username,
    });
  };

  // TODO: handleSubmit
  const handleSubmit = async (e : any) => {
    // TODO: make sure passwords match
    e.preventDefault();

    if (password !== confirmPassword) {
      console.log("Passwords don't match!");
      alert("Registration failed.");
      return;
    }

    // TODO: send registration request to backend
    try {
      const formData = new FormData();
      if (file) {
        formData.append("image", file);
      }

      const response = await axios.post(
        `${rootURL}/${username}/updateProfile`,
        {
          password,
        }
      );

      console.log("Authenticated");

      const similarActors = await axios.post(
        `${config.serverRootURL}/${username}/getActors`,
        formData,
        {
          withCredentials: true,
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      const actorsWithClicked = similarActors.data.results.map((actor : any) => ({
        ...actor,
        clicked: false,
      }));
      setActors(actorsWithClicked);

      //console.log(similarActors.data);

      if (response.status === 200) {
        alert("Profile Change Successful");
        setFile(null);
        setFileURL("");
        //navigate("/" + username + "/home");
      } else {
        console.log(response.status);
        alert("Registration failed.");
      }
    } catch (error) {
      console.log(error);
      alert("Registration failed.");
    }
  };

  return (
    <div className="w-screen h-screen">
      <div className="w-full h-16 bg-slate-50 flex justify-center mb-2">
        <div className="text-2xl max-w-[1800px] w-full flex items-center">
          Pennstagram - {username} &nbsp;
          <button
            type="button"
            className="px-2 py-2 rounded-md bg-gray-500 outline-none text-white"
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
            onClick={chat}
          >
            Chat
          </button>
        </div>
      </div>
      <div className="h-full w-full mx-auto max-w-[1800px] flex flex-col items-center space-y-4">
        <form onSubmit={handleSubmit}>
          <div className="rounded-md bg-slate-50 p-6 space-y-2 w-full">
            <div className="font-bold flex w-full justify-center text-2xl mb-4">
              Update Profile
            </div>
            <div className="flex space-x-4 items-center justify-between">
              <label htmlFor="username" className="font-semibold">
                Username
              </label>
              <input
                id="username"
                type="text"
                className="outline-none bg-white rounded-md border border-slate-100 p-2"
                value={username}
              />
            </div>
            <div className="flex space-x-4 items-center justify-between">
              <label htmlFor="content" className="font-semibold">
                Photo
              </label>
              <input type="file" accept="image/*" onChange={handleFileChange} />
            </div>
            <div className="flex space-x-4 items-center justify-between">
              <label htmlFor="password" className="font-semibold">
                Password
              </label>
              <input
                id="password"
                type="password"
                className="outline-none bg-white rounded-md border border-slate-100 p-2"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="flex space-x-4 items-center justify-between">
              <label htmlFor="confirmPassword" className="font-semibold">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                className="outline-none bg-white rounded-md border border-slate-100 p-2"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <div className="w-full flex justify-center">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  handleSubmit(e);
                }}
                type="submit"
                className="px-4 py-2 rounded-md bg-indigo-500 outline-none font-bold text-white"
              >
                Update Profile
              </button>
            </div>
          </div>
        </form>
        <div className="w-full flex flex-wrap justify-center"></div>
        <div className="flex flex-wrap justify-center">
          {actors.length > 1 &&
            actors.map((actor, index) => (
              <button
                key={index}
                className={`px-4 py-2 rounded-md outline-none font-bold text-white m-2 ${
                  actor.clicked ? "bg-indigo-500" : "bg-gray-500"
                }`}
                onClick={() => handleActorClick(index)}
              >
                {actor.actor_name}
              </button>
            ))}
        </div>
        <div className="w-full flex flex-wrap justify-center">
          <div className="flex items-center space-x-4">
            {links.length === 0 ? (
              <p
                style={{
                  fontSize: "20px",
                  fontWeight: "bold",
                  color: "#4A90E2",
                }}
              >
                No links yet! Add profile photo to link your favorite actors!
              </p>
            ) : (
              <>
                <p
                  style={{
                    fontSize: "20px",
                    fontWeight: "bold",
                    color: "#4A90E2",
                  }}
                >
                  LINKS
                </p>
                {links.map((link, index) => (
                  <div
                    key={index}
                    className="flex items-center space-x-2 border rounded-md p-2 m-2"
                  >
                    <p className="font-semibold">{link.actor_name}</p>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
