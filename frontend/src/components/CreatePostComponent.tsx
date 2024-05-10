import React, { useState } from "react";
import axios from "axios";
import config from "../../config.json";
import { useParams } from "react-router-dom";
axios.defaults.withCredentials = true;

function CreatePostComponent({ updatePosts, dark }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const { username } = useParams();
  const [file, setFile] = useState(null);
  const [fileURL, setFileURL] = useState("");

  const light = ["bg-white", "bg-slate-50"];
  const dark2 = ["bg-black", "bg-gray-700"];
  const text = ["text-white", "text-black"];

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setFile(file);
    setFileURL(URL.createObjectURL(e.target.files[0]));
    //console.log(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      //console.log(username);
      const formData = new FormData();
      formData.append("title", title);
      formData.append("captions", content);
      if (file) {
        formData.append("image", file);
      }
      const response = await axios.post(
        `${config.serverRootURL}/${username}/createPost`,
        formData,
        {
          withCredentials: true,
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );
      console.log(response);
      if (response.status === 201 || response.status === 200) {
        // Clear input fields
        setTitle("");
        setContent("");
        setFile(null);
        // Update posts
        updatePosts();
      }
    } catch (error) {
      console.error("Error creating post:", error);
    }
  };

  return (
    <div className={` flex justify-center ${dark ? text[0] : text[1]}`}>
      <form>
        <div
          className={`rounded-md ${
            dark ? dark2[1] : light[1]
          } p-6 space-y-2 w-full`}
        >
          <div
            className={`font-bold flex w-full justify-center text-2xl mb-4 ${
              dark ? text[0] : text[1]
            }`}
          >
            Create Post
          </div>
          <div className="flex space-x-4 items-center justify-between">
            <label htmlFor="title" className="font-semibold">
              Title
            </label>
            <input
              id="title"
              type="text"
              className="outline-none bg-white rounded-md border border-slate-100 p-2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="flex space-x-4 items-center justify-between">
            <label htmlFor="content" className="font-semibold">
              Photo
            </label>
            <input type="file" accept="image/*" onChange={handleFileChange} />
          </div>

          <div className="flex space-x-4 items-center justify-between">
            <label htmlFor="content" className="font-semibold">
              Caption
            </label>
            {/* <input id="content" type="text" className='outline-none bg-white rounded-md border border-slate-100 p-2'
            value={content} onChange={(e) => setContent(e.target.value)} /> */}
            <textarea
              placeholder="Content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="border border-gray-300 p-2 rounded-md mb-2"
              rows={4}
              required
            ></textarea>
          </div>
          {file && <img src={fileURL} width={"300px"} height={"500px"} />}

          <div className="w-full flex justify-center">
            <button
              type="button"
              className="px-4 py-2 rounded-md bg-indigo-500 outline-none font-bold text-white"
              onClick={handleSubmit}
            >
              Create Post
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default CreatePostComponent;
