import { useState, useEffect } from "react";
import ReactDOM from 'react-dom';
import LiveBlog from "./components/Liveblog/Liveblog.jsx";

ReactDOM.render(
    <LiveBlog />,
    document.getElementById('liveblog')
);