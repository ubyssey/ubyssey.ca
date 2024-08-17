import React from 'react'
import { QueryEventsCalendar, QueryEventsOption } from './components/Events/calendar.jsx';
import ReactDOM from 'react-dom';

ReactDOM.createRoot(document.getElementById("calendar-header")).render(
    <QueryEventsOption />
);

ReactDOM.createRoot(document.getElementById("calendar-rows")).render(
    <QueryEventsCalendar />
);