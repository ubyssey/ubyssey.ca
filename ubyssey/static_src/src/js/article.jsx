import React from 'react'
import { createRoot } from 'react-dom/client';
import NavSearch from './components/NavSearch.jsx';
import { CookieDisclaimer } from './components/Cookies'

$(function () {
    const cookieContainer = document.getElementById('cookie-disclaimer')
    const cookieRoot = createRoot(cookieContainer);
    cookieRoot.render(<CookieDisclaimer />);

    const navSearchContainer = document.getElementById('nav-search')
    const navRoot = createRoot(navSearchContainer);
    navRoot.render(<NavSearch />);
});
