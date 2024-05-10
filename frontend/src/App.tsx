import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useState } from "react";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Signup from "./pages/Signup";
import Friends from "./pages/Friends";
import ChatInterface from "./pages/ChatInterface";
import Profile from "./pages/Profile";

function App() {
  const [dark, setDark] = useState(false);
  const toggleDarkTheme = () => {
    setDark(!dark);
  };
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          path="/:username/home"
          element={<Home dark={dark} toggleDarkTheme={toggleDarkTheme} />}
        />
        <Route path="/:username/friends" element={<Friends />} />
        <Route path="/:username/chat" element={<ChatInterface />} />
        <Route path="/:username/profile" element={<Profile />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
