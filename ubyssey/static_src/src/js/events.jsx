import { createRoot } from 'react-dom/client';
import { QueryEventsCalendar } from './components/Events/calendar.jsx';

createRoot(document.getElementById("calendar")).render(
    <QueryEventsCalendar />
);