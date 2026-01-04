import { useState, useEffect } from "react";
import ReactDOM from 'react-dom';
import LiveBlogFeed from "./components/Liveblog/LiveblogFeed.jsx";

ReactDOM.render(
    <LiveBlogFeed />,
    document.getElementById('liveblog-feed')
);