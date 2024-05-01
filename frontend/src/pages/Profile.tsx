import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import config from "../../config.json";
import PostComponent from "../components/PostComponent";
import CreatePostComponent from "../components/CreatePostComponent";
import { useNavigate } from "react-router-dom";
axios.defaults.withCredentials = true;

export default function Profile() {
  const navigate = useNavigate();
  const rootURL = config.serverRootURL;

  const { username } = useParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState("");
  const [affiliation, setAffiliation] = useState("");
  const [birthday, setBirthday] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");


  const friends = () => {
    navigate("/" + username + "/friends");
  };

  const chat = () => {
    navigate("/" + username + "/chat");
  };

  const feed = () => {
    navigate("/" + username + "/home");
  }

  // TODO: handleSubmit
  const handleSubmit = async () => {
    // TODO: make sure passwords match

    if (password !== confirmPassword) {
      console.log("Passwords don't match!");
      alert("Registration failed.");
      return;
    }

    // TODO: send registration request to backend
    try {
      const response = await axios.post(`${rootURL}/${username}/updateProfile`, {
        password,
      });

      if (response.status === 200) {
        alert("Profile Change Successful")
        navigate("/" + username + "/home");
      } else {
        console.log(response.status)
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
    <div className="w-screen h-screen flex items-center justify-center">
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
                handleSubmit();
              }}
              type="submit"
              className="px-4 py-2 rounded-md bg-indigo-500 outline-none font-bold text-white"
            >
              Update Profile
            </button>
          </div>
        </div>
      </form>
    </div>
    </div>
  );
}
