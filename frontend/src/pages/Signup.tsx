import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import config from "../../config.json";
axios.defaults.withCredentials = true;

export default function Signup() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState("");
  const [affiliation, setAffiliation] = useState("");
  const [birthday, setBirthday] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [hashtags, setHashtags] = useState([""]);
  const [topHashtags, setTopHashtags] = useState([]);

  const fetchData = async () => {
    try {
      const hashResponse = await axios.get(`${rootURL}/topHashtags`);

      if (hashResponse.status == 200) {
        console.log(hashResponse.data.results.map((inp) => inp.hashtag));
        setTopHashtags(hashResponse.data.results.map((inp) => inp.hashtag));
      }
    } catch (error) {
      console.error("Error fetching feed data:", error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // TODO: set appropriate state variables

  const rootURL = config.serverRootURL;

  const handleSubmit = async () => {
    // TODO: make sure passwords match

    if (password !== confirmPassword) {
      console.log("Passwords don't match!");
      alert("Registration failed.");
      return;
    }

    // TODO: send registration request to backend
    try {
      const response = await axios.post(`${rootURL}/register`, {
        username,
        password,
        email,
        affiliation,
        birthday,
        firstName,
        lastName,
        hashtags,
      });

      if (response.status === 200) {
        navigate("/" + username + "/home");
      } else {
        alert("Registration failed.");
      }
    } catch (error) {
      console.log(error);
      alert("Registration failed.");
    }
  };

  const changeHashTags = (changer: string, index: number) => {
    let a = hashtags;
    a[index] = changer;
    setHashtags([...a]);
  };

  const addHashTag = () => {
    setHashtags((prevHash) => [...prevHash, ""]);
  };

  return (
    <div className=" flex items-center justify-center">
      <form onSubmit={handleSubmit}>
        <div className="rounded-md bg-slate-50 p-6 space-y-2 w-full">
          <div className="font-bold flex w-full justify-center text-2xl mb-4">
            Sign Up to Pennstagram
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
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="flex space-x-4 items-center justify-between">
            <label htmlFor="firstName" className="font-semibold">
              First Name
            </label>
            <input
              id="firstName"
              type="text"
              className="outline-none bg-white rounded-md border border-slate-100 p-2"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
          <div className="flex space-x-4 items-center justify-between">
            <label htmlFor="lastName" className="font-semibold">
              Last Name
            </label>
            <input
              id="lastName"
              type="text"
              className="outline-none bg-white rounded-md border border-slate-100 p-2"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
          <div className="flex space-x-4 items-center justify-between">
            <label htmlFor="email" className="font-semibold">
              Email
            </label>
            <input
              id="email"
              type="text"
              className="outline-none bg-white rounded-md border border-slate-100 p-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex space-x-4 items-center justify-between">
            <label htmlFor="birthday" className="font-semibold">
              Birthday
            </label>
            <input
              id="birthday"
              type="text"
              className="outline-none bg-white rounded-md border border-slate-100 p-2"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
            />
          </div>
          <div className="flex space-x-4 items-center justify-between">
            <label htmlFor="affiliation" className="font-semibold">
              Affiliation
            </label>
            <input
              id="affiliation"
              type="text"
              className="outline-none bg-white rounded-md border border-slate-100 p-2"
              value={affiliation}
              onChange={(e) => setAffiliation(e.target.value)}
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
          <div className="">
            <div className="font-semibold text-center ">Hashtags</div>
            <div className="flex flex-row gap-8">
              <div className="flex flex-col gap-4">
                {topHashtags.map((inp) => (
                  <div> {inp} </div>
                ))}
              </div>
              <div className="flex flex-col gap-8">
                {hashtags.map((inp, index) => (
                  <input
                    type="text"
                    value={inp}
                    className="outline-none bg-white rounded-md border border-slate-100 p-2"
                    onChange={(e) => changeHashTags(e.target.value, index)}
                  />
                ))}
                <div
                  className="cursor-pointer border"
                  onClick={() => addHashTag()}
                >
                  Add Hashtag
                </div>
              </div>
            </div>
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
              Sign up
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
