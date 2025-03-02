import React,  { useState, useEffect } from 'react'
import {
    BrowserRouter as Router,
    Link,
    useLocation,
    useSearchParams,
    useNavigate,
} from "react-router-dom";
// import ReactDOM from 'react-dom';
import Throbber from '../../../images/throbber.svg';
import axios from 'axios';

const BP_DESKTOP_SIZE = 1199;

function useQuery() {
    const { search } = useLocation();
  
    // Ensure `search` is always defined (default to empty string if not present)
    return React.useMemo(() => {
      try {
        return new URLSearchParams(search || "");
      } catch (error) {
        return new URLSearchParams(); // Return an empty URLSearchParams object on failure
      }
    }, [search]);
  }
  
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= BP_DESKTOP_SIZE);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= BP_DESKTOP_SIZE);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return isMobile;
}

function getDateString(date) {
    var str = String(date.getFullYear()) + "-";
    if (String(date.getMonth()+1).length < 2) {
        str = str + "0" + String(date.getMonth()+1) + "-";
    } else {
        str = str + String(date.getMonth()+1) + "-";
    }
    if (String(date.getDate()).length < 2) {
        str = str + "0" + String(date.getDate());
    } else {
        str = str + String(date.getDate());
    }
    return str;
}

export function QueryEventsCalendar() {
    const d = 24 * 60 * 60 * 1000;
    const [events, setEvents] = React.useState([]);
    let fullUrl = window.location.href;
    const decodedUrl = decodeURIComponent(fullUrl);
    const queryString = decodedUrl.split('?')[1]; // Get the part after the "?"
    const urlParams = new URLSearchParams(queryString);
    const [numberOfWeeks, setNumberOfWeeks] = useState(calculateNumberOfWeeks());
    const [start, setStart] = useState(getInitialStartDate());
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [isMonthToggled, setIsMonthToggled] = React.useState(urlParams.has("month"));
    const [isLoading, setIsLoading] = React.useState(true);

    function getDate(month, year) {
        let newStartDate = new Date(year, month - 1, 1); // Month is 0-indexed

        // Ensure the new start date begins on the Monday of that week
        while (newStartDate.getDay() !== 1) {
            newStartDate = new Date(newStartDate.getTime() - 24 * 60 * 60 * 1000);
        }    
        return newStartDate;
    }

    function calculateNumberOfWeeks() {
        if(urlParams.has("month") && urlParams.has("year")){
            const month = parseInt(urlParams.get("month"));
            const year = parseInt(urlParams.get("year"));
            const date = new Date(year, month - 1, 1);
            if (
                (date.getDay() === 6 && new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate() === 31) || 
                (date.getDay() === 0 && new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate() > 29)
            ) {
                return 6;
            } else {
                return 5;
            }
        }
        else{
            return 4;
        }
    }

    function getInitialStartDate() {
        if(urlParams.has("month") && urlParams.has("year")){
            const month = parseInt(urlParams.get("month"));
            const year = parseInt(urlParams.get("year"));
            return getDate(month, year);
        } else{
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            let start = new Date(today.getTime() - 10 * d);
            while (start.getDay() !== 1) {
                start = new Date(start.getTime() + d);
            }
            return start;
        }
    }
    const calculateNewStart = (direction, start) => {
        // Set the start date to the first day of the current month
        let newStart = new Date(start);

        // Adjust the month based on the direction
        if (direction === 'next') {
            newStart = new Date(newStart.getTime() + (40*d));
        } else {
            if (newStart.getDate() == 1) {
                newStart = new Date(newStart.getTime() - (2*d));
            }
        }
        newStart.setDate(1);
        // Extract the new month and year after the adjustment
        const adjustedYear = newStart.getFullYear();
        const adjustedMonth = (newStart.getMonth() + 1).toString().padStart(2, '0'); // Ensure month is two digits (01-12)

        return {
            year: adjustedYear,
            month: adjustedMonth,
        };
    };    

    // Function to update the start date to the week of the first day of the previous or next month
    const handleMonthNavigation = (direction) => {

        let newStart, newMonth, newYear;
        newStart = calculateNewStart(direction, start);
        newMonth = newStart.month;
        newYear = newStart.year;    

        const searchParams = new URLSearchParams(window.location.search);
        searchParams.set('month', newMonth);
        searchParams.set('year', newYear);
        window.history.pushState(null, '', `?${searchParams.toString()}`);

        // Set the new start date and other logic
        let newStartDate = new Date(newYear, newMonth - 1, 1); // Month is 0-indexed

        if (
            (newStartDate.getDay() === 6 && new Date(newStartDate.getFullYear(), newStartDate.getMonth() + 1, 0).getDate() === 31) || 
            (newStartDate.getDay() === 0 && new Date(newStartDate.getFullYear(), newStartDate.getMonth() + 1, 0).getDate() > 29)
        ) {
            setNumberOfWeeks(6);
        } else {
            setNumberOfWeeks(5);
        }

        // Ensure the new start date begins on the Monday of that week
        while (newStartDate.getDay() !== 1) {
            newStartDate = new Date(newStartDate.getTime() - 24 * 60 * 60 * 1000);
        }

        // Update the start state
        setStart(newStartDate);
        setIsMonthToggled(true);
    };

    const startDate = () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let start = new Date(today.getTime() - 10 * d);
        while (start.getDay() !== 1) {
            start = new Date(start.getTime() + d);
        }
        return start;
    };

    function getEvents(){
        
        const s = 1000
        const m = s * 60;
        const h = m * 60;
        const d = h * 24;

        var apiStart = new Date(start.getTime() - d*25);
        apiStart.setDate(1);

        var apiEnd = new Date(apiStart.getTime() + d*120);
        apiEnd.setDate(1);
        console.log(String(apiStart) + " " + String(apiEnd));
        axios
        .get(
            '/api/events/?limit=1000&start_time__gte=' + apiStart.toISOString() + "&end_time__lte=" + apiEnd.toISOString() //2024-10-15T11:00:00-07:00 If needed you can increase or decrease the limit to include more or lesser events or add more query parmaters
        )
        .then((response) => {
            const res = response.data.results;

            for (let i=0; i<res.length; i++) {
                res[i].start_time = changeTimezone(new Date(res[i].start_time), "America/Vancouver");
                res[i].end_time = changeTimezone(new Date(res[i].end_time), "America/Vancouver");
            }

            setEvents(res);
            setIsLoading(false);
        })
        .catch((err) => console.log(err));
    }
    React.useEffect(()=>{
        getEvents();
        const theme = document.documentElement.getAttribute('color-css-theme');
        setIsDarkMode(theme === 'dark');
    },[start]);

    const toggleDarkMode = () => {
        setIsDarkMode(prevMode => !prevMode); // Toggle dark mode state
    };

    return (
        <Router>
            <div class="events-flex">
                <div class="events-calendar">
                    <header class="events">
                        <div class="u-container">
                            <div class="logo-area">
                                <a class="home-link" href="/" title="Go to The Ubyssey Homepage">
                                <div class="top-logo ubyssey_small_logo light-logo" style={{'background-image': "url('https://ubyssey.ca/static/ubyssey/images/logos/ubyssey-logo-blue-light.e935f233a50c.svg')"}} alt="Ubyssey Logo"></div>
                                <div class="top-logo ubyssey_small_logo dark-logo"  style={{'background-image': "url('https://ubyssey.ca/static/ubyssey/images/logos/ubyssey-logo-blue-dark.f3b3c0235809.svg')"}} alt="Ubyssey Logo"></div>
                                </a>
                            </div>
                        </div>
                        <div class="darkmode-toggle">
                            <button 
                                className="theme-toggle dark-mode-switcher" 
                                id="theme-toggle" 
                                onClick={toggleDarkMode} 
                                title="Toggles light & dark" 
                                aria-label="auto" 
                                aria-live="polite"
                            >
                                <svg class="sun-and-moon" aria-hidden="true" width="1.75em" height="1.75em" viewBox="0 0 24 24">
                                    <mask class="moon" id="moon-mask{{id}}">
                                        <rect x="0" y="0" width="100%" height="100%" fill="white" />
                                        <circle cx="24" cy="10" r="6" fill="black" />
                                    </mask>
                                    <circle class="sun" cx="12" cy="12" r="6" mask="url(#moon-mask{{id}})" fill="currentColor" />
                                    <g class="sun-beams" stroke="currentColor">
                                        <line x1="12" y1="1" x2="12" y2="3" />
                                        <line x1="12" y1="21" x2="12" y2="23" />
                                        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                                        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                                        <line x1="1" y1="12" x2="3" y2="12" />
                                        <line x1="21" y1="12" x2="23" y2="12" />
                                        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                                        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                                    </g>
                                </svg>                            
                            </button>
                        </div>
                        <h1 class="title">Events around campus</h1>

                        <EventsOptions isDarkMode={isDarkMode}  setIsMobile={setIsDarkMode} getInitialStartDate={startDate} handleMonthNavigation={handleMonthNavigation} setIsMonthToggled={setIsMonthToggled} isMonthToggled={isMonthToggled} setStart={setStart}/>
                    </header>

                    <div id="calendar-rows">
                        <EventsCalendar events={events} start={start} setStart={setStart} numberOfWeeks={numberOfWeeks} setNumberOfWeeks={setNumberOfWeeks} isDarkMode={isDarkMode} setIsMobile={setIsDarkMode} getInitialStartDate={startDate} handleMonthNavigation={handleMonthNavigation} setIsMonthToggled={setIsMonthToggled} isMonthToggled={isMonthToggled} isLoading={isLoading}/>
                    </div>
                </div>
            
            <EventInfo events={events}/>
        </div>
        </Router>
    );
}

function capitalize(s)
{
    return s[0].toUpperCase() + s.slice(1);
}

function slugify(str) {
    if (str == null) {
        return "null";
    }
    // Thanks https://dev.to/bybydev/how-to-slugify-a-string-in-javascript-4o9n
    str = str.replace(/^\s+|\s+$/g, ''); // trim leading/trailing white space
    str = str.toLowerCase(); // convert string to lowercase
    str = str.replace(/[^a-z0-9 -]/g, '') // remove any non-alphanumeric characters
             .replace(/\s+/g, '-') // replace spaces with hyphens
             .replace(/-+/g, '-'); // remove consecutive hyphens
    return str;
}

function changeTimezone(date, ianatz) {

    var invdate = new Date(date.toLocaleString('en-US', {
      timeZone: ianatz
    }));
  
    var diff = date.getTime() - invdate.getTime();
    return new Date(date.getTime() - diff);
  }

function displayTime(time) {
    var p = "AM"
    if (time.getHours() >= 12) {
        p = "PM"
    }

    var display = String(time.getHours() % 12)
    if (display == "0") {
        display = "12";
    }

    if (time.getMinutes() != 0) {
        display = display + ":" + String(time.getMinutes());
    }

    display = display + p;

    return display;
}

function displayMonthDay(date) {
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return months[date.getMonth()] + " " + String(date.getDate());
}

function displayEventTime(start, end) {
    //event.start_time|date:"F j" != event.end_time|date:"F j" and day.day|stringformat:"i" != event.start_time|date:"j" %}<b>Ongoing</b>{% elif event.start_time|time == 'midnight' %}{% else %}<b>{{event.start_time|time:"fA"}}</b>{% endif %} {event.title|safe}
    const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const shortenedMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const s = 1000
    const m = s * 60;
    const h = m * 60;
    const d = h * 24;
    
    start = new Date(start);
    end = new Date(end);

    if (start == end) {
        return displayMonthDay(start) + ", " + displayTime(start);
    } else if (d >= end.getTime() - start.getTime()) {
        if (start.getHours() == 0) {
            return displayMonthDay(start);
        } else {
            return displayMonthDay(start) + ", " + displayTime(start) + " - " + displayTime(end);
        }
    } else if (end.getHours() == start.getHours()) {
        return displayMonthDay(start) + " - " + displayMonthDay(end);
    } else {
        return displayMonthDay(start) + ", " + displayTime(start) + " - " + displayMonthDay(end) + ", " + displayTime(end)
    }
}

function eventsTags(event) {
    var tags = [];
    if (event.host != null && event.host != "") {
        tags.push(slugify(event.host));
    }
    tags.push(slugify(event.category));

    return tags.join(" ");
}

function EventsOptions({getInitialStartDate, handleMonthNavigation, setIsMonthToggled, isDarkMode, isMonthToggled, setStart}) { 
    let [searchParams, setSearchParams] = useSearchParams();
    let query = useQuery();
    const navigate = useNavigate();
    const isMobile = useIsMobile();

    var category = query.get("category") || "all";

    var highlight = "category";

    var ical = {
        'url': 'https://ubyssey.ca/events/ical/',
        'title': "Ubyssey's Events Around Campus iCal Feed"
    };

    var rss = {
        'url': 'https://ubyssey.ca/events/rss/',
        'title': "Ubyssey's Events Around Campus rss Feed"
    };

    var meta = {
        'title': "Events Around Campus Calendar",
        'description': "Events Around Campus collected by The Ubyssey",
        'url': 'https://ubyssey.ca/events/',
    };

    if (category !== "all") {
        highlight = "host";

        ical = {
            'url': `https://ubyssey.ca/events/ical/?category=${category}`,
            'title': `Ubyssey's ${capitalize(category)} Around Campus iCal Feed`
        };

        rss = {
            'url': `https://ubyssey.ca/events/rss/?category=${category}`,
            'title': `Ubyssey's ${capitalize(category)} Around Campus rss Feed`
        };

        meta = {
            'title': `${capitalize(category)} Around Campus Calendar`,
            'description': `${capitalize(category)} Around Campus collected by The Ubyssey`,
            'url': `https://ubyssey.ca/events/?category=${category}`,
        };
    }

    const categories = [
        { id: 0, value: 'all', label: 'All', },
        { id: 1, value: 'sports', label: 'Sports' },
        { id: 2, value: 'entertainment', label: 'Entertainment' },
        { id: 3, value: 'community', label: 'Community' },
        { id: 4, value: 'seminar', label: 'Seminar' }
    ];

    const handleCategoryChange = (e) => {
        const newCategory = e.target.value;
        const searchParams = new URLSearchParams(window.location.search);
        searchParams.set('category', newCategory);
        navigate(`?${searchParams.toString()}`);
    };
    return (
        <>
            <div className="events-calendar--categories">
            <div className="events-calendar--navigation">
        {isMobile ? (
            <>
            </>
        ) : (
            <>
                <Link
                    to={() => {
                        const searchParams = new URLSearchParams(window.location.search);
                        return `?${searchParams.toString()}`;
                    }}
                    className="arrow-button up-arrow"
                    title="Previous month"
                    onClick={(e) => {
                        e.preventDefault();
                        handleMonthNavigation('previous');
                    }}
                >
                    <svg width="32px" height="32px" viewBox="0 0 32 32">
                        <path
                            d="M18.221,7.206l9.585,9.585c0.879,0.879,0.879,2.317,0,3.195l-0.8,0.801c-0.877,0.878-2.316,0.878-3.194,0l-7.315-7.315l-7.315,7.315c-0.878,0.878-2.317,0.878-3.194,0l-0.8-0.801c-0.879-0.878-0.879-2.316,0-3.195l9.587-9.585c0.471-0.472,1.103-0.682,1.723-0.647C17.115,6.524,17.748,6.734,18.221,7.206z"
                            fill={isDarkMode ? "#FFFFFF" : "#000000"}
                        />
                    </svg>
                </Link>
                <Link
                    to={() => {
                        const searchParams = new URLSearchParams(window.location.search);
                        return `?${searchParams.toString()}`;
                    }}
                    className="arrow-button down-arrow"
                    title="Next month"
                    onClick={(e) => {
                        e.preventDefault();
                        handleMonthNavigation('next');
                    }}
                >
                    <svg width="32px" height="32px" viewBox="0 0 32 32">
                        <path
                            d="M18.221,7.206l9.585,9.585c0.879,0.879,0.879,2.317,0,3.195l-0.8,0.801c-0.877,0.878-2.316,0.878-3.194,0l-7.315-7.315l-7.315,7.315c-0.878,0.878-2.317,0.878-3.194,0l-0.8-0.801c-0.879-0.878-0.879-2.316,0-3.195l9.587-9.585c0.471-0.472,1.103-0.682,1.723-0.647C17.115,6.524,17.748,6.734,18.221,7.206z"
                            fill={isDarkMode ? "#FFFFFF" : "#000000"}
                        />
                    </svg>
                </Link>
                <Link
                    to={() => {
                        const searchParams = new URLSearchParams(window.location.search);
                        return `?${searchParams.toString()}`;
                    }}
                    className="today-button"
                    title="Today"
                    onClick={(e) => {
                        e.preventDefault();
                        const searchParams = new URLSearchParams(window.location.search);
                        searchParams.delete('month');
                        searchParams.delete('year');
                        navigate(`?${searchParams.toString()}`);
                        setStart(getInitialStartDate());
                        setIsMonthToggled(false);
                    }}
                >
                    Today
                </Link>
            </>
        )}
        </div>
                {isMobile ? (
                    <select
                        className = "category-select"
                        onChange={handleCategoryChange}
                        value={category}
                    >
                        {categories.map(cat => (
                            <option key={cat.id} value={cat.value}>{cat.label}</option>
                        ))}
                    </select>
                ) : (
                    <ul>
                        {categories.map(cat => (
                            <li key={cat.value} className={category === cat.value ? "selected" : ""}>
                                <Link to={`?category=${cat.value}`}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        if(cat.value=="all") {
                                            searchParams.delete("category");
                                        } else {
                                            searchParams.set("category", cat.value);
                                        }
                                        setSearchParams(searchParams);
                                    }}
                                >{cat.label}</Link>
                            </li>
                        ))}
                    </ul>
                )}
                <a className="alt-icon" href={ical.url} title={ical.title}><ion-icon name="calendar"></ion-icon></a>
                <a className="alt-icon" href={rss.url} title={rss.title}><ion-icon name="logo-rss"></ion-icon></a>
            </div>
            <p className="mobile-alt">
                <a href={ical.url}><ion-icon name="calendar"></ion-icon> iCal File</a>
                <a href={rss.url}><ion-icon name="logo-rss"></ion-icon> Rss Feed</a>
            </p>
        </>
    );
}

function EventsCalendar({events, start, setStart, numberOfWeeks, setNumberOfWeeks, isDarkMode, setIsDarkMode, getInitialStartDate, handleMonthNavigation, setIsMonthToggled, isMonthToggled, isLoading}) {

    let query = useQuery();
    const s = 1000
    const m = s * 60;
    const h = m * 60;
    const d = h * 24;
    const navigate = useNavigate();

    function arrangeCalendar(events) {
        const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const shortenedMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const s = 1000
        const m = s * 60;
        const h = m * 60;
        const d = h * 24;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        var cur = new Date(start);

        var calendar = [];
        for(let i=0; i<numberOfWeeks; i++) {
            var week = {
                'month': months[cur.getMonth()],
                'month_short': shortenedMonths[cur.getMonth()],
                'days': [],
                'this_week': false,
            };
            for(let a=0; a<7; a++) {
                var day = {
                    'day': cur.getDate(),
                    'phase': 'today',
                    'day_of_week': weekDays[cur.getDay()],
                    'events': [],
                };
                if (cur.toLocaleDateString() == today.toLocaleDateString()) {
                    day['phase'] = 'today';
                    week['this_week'] = true;
                } else if (cur < today) {
                    day['phase'] = 'past';
                } else {
                    day['phase'] = 'future';
                }

                if (cur.getDate() == 1) {
                    week['month'] = months[cur.getMonth()];
                    week['month_short'] = shortenedMonths[cur.getMonth()];
                }
                var cur = new Date(cur.getTime() + (h * 25));
                cur.setHours(0, 0, 0, 0);
                week['days'].push(day);
            }
            calendar.push(week);
        }

        function placeEvents(calendar, event) {
            var cur = new Date(event.start_time);
            cur.setHours(0,0,0,0);
            event.displayTime = displayTime(event.start_time);
            if (event.end_time.getTime() - event.start_time.getTime() >= d-h || event.start_time.getHours() == 0) {
                event.displayTime = "";
            }

            while(cur < new Date(event.end_time) || cur.valueOf() == event.start_time.valueOf()) {
                var delta = Math.floor((cur.getTime() - start.getTime()) / d);
                if (getDateString(new Date(start.getTime() + (d*delta))) != getDateString(cur)) {
                    delta = delta + 1;
                }
                if (delta >= 0 && delta < (7*(numberOfWeeks))) {
                    calendar[Math.floor(delta/7)]['days'][delta % 7]['events'].push(event);
                }
                cur = new Date(cur.getTime() + d);
                event = JSON.parse(JSON.stringify(event));
                event.displayTime = "Ongoing";
            }
            return calendar;
        }
        calendar = events.reduce(placeEvents, calendar);
        return calendar;
    }

    function getHosts(hosts, event) {
        if (event.host != null && event.host != "" && event.start_time >= start.getTime() && event.start_time < start.getTime() + (d * 7 * numberOfWeeks)) {
            if (!(hosts.includes(event.host))) {
                hosts.push(event.host);
            }
        }
        hosts.sort();
        return hosts;
    }

    function toggleCategory(that, searchParams, setSearchParams) {

        var selected = [];
        var selectType = "include";

        if (searchParams.has("hidden")) {
            selectType = "hidden";
        }

        if (searchParams.has(selectType)) {
            selected = searchParams.get(selectType).split(" ");
        }
        selected = selected.filter((i) => i!="");
        
        if (selected.includes(that.id)) {
            selected.splice(selected.indexOf(that.id), 1);
        } else {
            selected.push(that.id);
        }
        
        if (selected.length == 0) {
            searchParams.delete(selectType);
        } else {
            searchParams.set(selectType, selected.join(" "));
        }
        setSearchParams(searchParams);
    }

    function colourIn(legend) {
        $('div.day li').removeAttr("style");
        for (let i=0; i<legend.length; i++) {
            let r = 200 + Math.floor(50 * Math.cos(i/legend.length * 2 * Math.PI));
            let g = 200 + Math.floor(50 * Math.sin(i/legend.length * 2 * Math.PI));
            let b = 200 + Math.floor(50 * Math.cos(i/legend.length * 2 * Math.PI + Math.PI));
            let colour = "rgb(" + [String(r), String(g), String(b)].join(",") + ")";

            $('.' + slugify(legend[i])).css("--highlight", colour);
            $('div.day li.' + slugify(legend[i])).css("color", "black");
        }
    }
    

    
    var category = "all";
    var highlight = "category";
    if (query.get("category") != null && query.get("category") != "all"){
        category = query.get("category");
        highlight = "host";
    }
    var eventHash = "";
    if (query.get("event") != null){
        eventHash = query.get("event");
    }

    let [searchParams, setSearchParams] = useSearchParams();

    var displayedEvents = events.filter((e) => (e.category===category || category==="all"));
    var legend = ["Sports", "Entertainment", "Community", "Seminar"];
    if (category != "all") {
        legend = displayedEvents.reduce(getHosts, []);
    }

    var selected = [];
    if (searchParams.has("hidden")) {
        selected = searchParams.get("hidden").split(" ");
        displayedEvents = displayedEvents.filter((e) => !selected.includes(slugify(e[highlight])));
    } else if (searchParams.has("include")) {
        selected = searchParams.get("include").split(" ");
        displayedEvents = displayedEvents.filter((e) => selected.includes(slugify(e[highlight])));
    }

    var calendar = arrangeCalendar(displayedEvents);
    React.useEffect(()=>{
        colourIn(legend);
    });
    
    const isPhablet = useIsMobile();
    return (
        <>
        <div class="events-calendar--days-of-week">
            <h2 class="day">Mon</h2>
            <h2 class="day">Tue</h2>
            <h2 class="day">Wed</h2>
            <h2 class="day">Thu</h2>
            <h2 class="day">Fri</h2>
            <h2 class="day">Sat</h2>
            <h2 class="day">Sun</h2>
        </div>
        
        <div className="events-calendar--navigation">
        {isPhablet ? (
            <>
                <Link
                    to={() => {
                        const searchParams = new URLSearchParams(window.location.search);
                        return `?${searchParams.toString()}`;
                    }}
                    className="arrow-button left-arrow"
                    title="Previous month"
                    onClick={(e) => {
                        e.preventDefault();
                        handleMonthNavigation('previous');
                    }}
                >
                    <svg width="32px" height="32px" viewBox="0 0 32 32">
                        <path
                            d="M18.221,7.206l9.585,9.585c0.879,0.879,0.879,2.317,0,3.195l-0.8,0.801c-0.877,0.878-2.316,0.878-3.194,0l-7.315-7.315l-7.315,7.315c-0.878,0.878-2.317,0.878-3.194,0l-0.8-0.801c-0.879-0.878-0.879-2.316,0-3.195l9.587-9.585c0.471-0.472,1.103-0.682,1.723-0.647C17.115,6.524,17.748,6.734,18.221,7.206z"
                            fill={isDarkMode ? "#FFFFFF" : "#000000"}
                        />
                    </svg>
                </Link>
                {isMonthToggled && 
                    <Link
                        to={() => {
                            const searchParams = new URLSearchParams(window.location.search);
                            return `?${searchParams.toString()}`;
                        }}
                        className="today-button"
                        title="Today"
                        onClick={(e) => {
                            e.preventDefault();
                            const searchParams = new URLSearchParams(window.location.search);
                            searchParams.delete('month');
                            searchParams.delete('year');
                            navigate(`?${searchParams.toString()}`);
                            setStart(getInitialStartDate());
                            setIsMonthToggled(false);
                        }}
                    >
                        Jump to Today
                    </Link>
                }
                <Link
                    to={() => {
                        const searchParams = new URLSearchParams(window.location.search);
                        return `?${searchParams.toString()}`;
                    }}
                    className="arrow-button right-arrow"
                    title="Next month"
                    onClick={(e) => {
                        e.preventDefault();
                        handleMonthNavigation('next');
                    }}
                >
                    <svg width="32px" height="32px" viewBox="0 0 32 32">
                        <path
                            d="M18.221,7.206l9.585,9.585c0.879,0.879,0.879,2.317,0,3.195l-0.8,0.801c-0.877,0.878-2.316,0.878-3.194,0l-7.315-7.315l-7.315,7.315c-0.878,0.878-2.317,0.878-3.194,0l-0.8-0.801c-0.879-0.878-0.879-2.316,0-3.195l9.587-9.585c0.471-0.472,1.103-0.682,1.723-0.647C17.115,6.524,17.748,6.734,18.221,7.206z"
                            fill={isDarkMode ? "#FFFFFF" : "#000000"}
                        />
                    </svg>
                </Link>

            </>
        ) : (
            <>
            </>
        )}
        </div>

        {isPhablet && isLoading &&                           
            <div className="loader-container">
                <LoaderComponent width={50}/>
            </div>}

        {calendar.map((week, week_index) => (
            <div className={"events-calendar--row" + (week.this_week ? " enlarged" : "")}>
                {week_index === 0 && (
                    <h2 className="events-calendar--month">
                        <span className="full">{week.month}</span>
                        <span className="short">{week.month_short}</span>
                    </h2>
                )}
                {week.days.map((day, day_index) => {
                    const loaderWeek = Math.floor((numberOfWeeks - 1) / 2);
                    const isMiddleDay = !isPhablet? week_index === loaderWeek && day_index === Math.floor(week.days.length / 2)
                                                    : week_index === 0 && day_index === 0;
                    if (isPhablet && ((!isMonthToggled && day.phase == "past") || (isMonthToggled && week_index === 0 && day.day > 7) || (isMonthToggled && week_index > 1 && day.day < 8))) {
                        return (<></>);
                    }

                    return (
                        <>
                       {(week_index !== 0 && day.day == 1) &&
                            <h2 className="events-calendar--month">
                            <span className="full">{week.month}</span>
                            <span className="short">{week.month_short}</span>
                            </h2>
                        }

                        <div key={day_index} className={"day " + day.phase}>
                            {isMiddleDay && isLoading && !isPhablet &&
                            <div className="loader-container">
                                    <LoaderComponent width={60}/>
                            </div>}
                            <button
                                onClick={(e) =>
                                    e.target.parentElement.parentElement.classList.toggle("enlarged")
                                }
                                className="events-calendar--number"
                            >
                                <span className="events-calendar--number-dayOfWeek">{day.day_of_week} </span>
                                {day.day}.
                            </button>
                            <ul>
                                {day.events.map((event) => (
                                    <li
                                        key={event.hash}
                                        className={(eventHash === event.hash ? "selected " : "") + eventsTags(event)}
                                    >
                                        <Link
                                            title={event.title.replace("<br>", ", ")}
                                            className="calendar-item"
                                            to={"?event=" + event.hash}
                                            event-url={event.event_url}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                const searchParams = new URLSearchParams(window.location.search);
                                                searchParams.set("event", event.hash);
                                                setSearchParams(searchParams);
                                            }}
                                            dangerouslySetInnerHTML={{
                                                __html:
                                                    "<b>" +
                                                    event.displayTime +
                                                    "</b> " +
                                                    (event.host && event.category === "seminar"
                                                        ? event.host
                                                            .replace("UBC ", "")
                                                            .split("for ")
                                                            .slice(-1)[0]
                                                            .split("of ")
                                                            .slice(-1)[0] + ":<br>"
                                                        : "") +
                                                    event.title,
                                            }}
                                        ></Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        </>
                    );
                })}
            </div>
        ))}

        <div class="legend">
            <ul>
                <li class="selection-toggle">
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            if (!searchParams.has("include")) {
                                searchParams.delete("hidden");
                                searchParams.append("include", "");
                            } else {
                                searchParams.delete("include");
                            }
                            setSearchParams(searchParams);
                        }}>
                        {searchParams.has("include") ? "Show all" : "Hide all"}
                    </button>
                </li>
                {legend.map((key, i) =>
                <li key={i} className={"legend-item " + slugify(key)}>
                    <button id={slugify(key)} className={"legend-button" + (selected.includes(slugify(key)) == !searchParams.has("include") ? " inactive" : "")}
                    onClick={(e) => {console.log(e); toggleCategory(e.target, searchParams, setSearchParams);}} title={key}
                    dangerouslySetInnerHTML={
                        {__html: key}
                     }></button>
                </li>
            )}</ul>
        </div>
        </>
    );
}

function EventInfo({events}) {
    const [widthMode, setWidthMode] = React.useState(window.innerWidth <= 1199);
    let [searchParams, setSearchParams] = useSearchParams();
    let query = useQuery();
    var event = false;
    if (query.get("event") != null){
        let eventHash = query.get("event");
        for (let i=0; i<events.length; i++) {
            if (events[i].hash == eventHash) {
                event = events[i];
                if (event.description == null) {
                    event.description = "";
                }
                document.getElementsByTagName("title")[0].innerHTML = event.title.replace("<br>", "- ") +  " - Ubyssey Events Around Campus";
                break;
            }
        }
    }

    React.useLayoutEffect(()=> {

        window.addEventListener('resize', ()=> {
            setWidthMode(window.innerWidth <= 1199);
        });
    }, []);

    React.useEffect(()=>{
        if(document.getElementById('event-dialog')) {
            document.getElementById('event-dialog').showModal();
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }
    });

    function exitEvent(searchParams, setSearchParams) {
        searchParams.delete("event");
        setSearchParams(searchParams);
    }

    return (
        <div class="events-info-container">
        {event && 
        <>
            {widthMode ?
            <>
                <dialog id="event-dialog" open="" aria-modal="true">
                    <div className="events-info-shadow" onClick={() => exitEvent(searchParams, setSearchParams)}></div>
                    <button onClick={() => exitEvent(searchParams, setSearchParams)}><ion-icon name="close"></ion-icon></button>
                    <EventInfoBox event={event}/>                
                </dialog>
            </>
            :
                <div class="events-info-container--div">
                    <EventInfoBox event={event}/>
                </div>
            }
        </>
        }
        </div>
    );
}

function EventInfoBox({event}) {
    function shortenUrl(url) {
        var a = document.createElement("a");
        a.href= url;
        return a.host;
    }
    return (
        <div class="events-info">
        <h2 class="event-info--time">
            {displayEventTime(event.start_time, event.end_time)}
        </h2>
        <div class={"events-info--content " + eventsTags(event)}>
                <h2><a id="selected-title" href={event.event_url} target="blank" dangerouslySetInnerHTML={
                   {__html: event.title} 
                }></a></h2>
                {event.location != "" && <p><b>Location:</b> {event.location}</p>}
                <p dangerouslySetInnerHTML={
                    {__html: (event.host!=null ? "<b>" + (event.description ? event.host : "From " + event.host) + "</b> " : "") + event.description.replace(/(?:\r\n|\r|\n)/g, '<br>')}
                }>
                </p>
                <p>
                    <a href={event.event_url.replace("__AND__", "&")} target="blank" id="source_link">{shortenUrl(event.event_url)}</a>
                    {document.getElementById('calendar').getAttribute("authenticated")=="True" && 
                    <a href={"/admin/snippets/events/event/edit/" + event.id} id="edit_link">edit</a>
                    }
                </p>
        </div>
    </div>
    );
}

function LoaderComponent({ width }) {
    return (
        <div className="loader">
            <Throbber />
        </div>
    );
}