import React,  { useState, useEffect } from 'react'
import {
    BrowserRouter as Router,
    Link,
    useLocation,
    useSearchParams,
    useNavigate,
} from "react-router-dom";
// import ReactDOM from 'react-dom';
import axios from "axios";
const BP_PHABLET_SIZE = 759;

function useQuery() {
    const { search } = useLocation();
  
    // Ensure `search` is always defined (default to empty string if not present)
    return React.useMemo(() => {
      try {
        return new URLSearchParams(search || "");
      } catch (error) {
        console.error("Failed to parse query params:", error);
        return new URLSearchParams(); // Return an empty URLSearchParams object on failure
      }
    }, [search]);
  }
  
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= BP_PHABLET_SIZE);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= BP_PHABLET_SIZE);
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
    const [currentMonth, setCurrentMonth] = React.useState("");

    // Add state to track the start date of the calendar
    const [start, setStart] = useState(getInitialStartDate());

    function getInitialStartDate() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let start = new Date(today.getTime() - 10 * d);
        while (start.getDay() !== 1) {
            start = new Date(start.getTime() + d);
        }

        return start;
    }

    function getEvents(){
        
        const s = 1000
        const m = s * 60;
        const h = m * 60;
        const d = h * 24;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let end = new Date(start.getTime() + 29*d)

        axios
        .get(
            '/api/events/?limit=300' //If needed you can increase or decrease the limit to include more or lesser events or add more query parmaters
        )
        .then((response) => {
            const res = response.data.results;

            for (let i=0; i<res.length; i++) {
                res[i].start_time = changeTimezone(new Date(res[i].start_time), "America/Vancouver");
                res[i].end_time = changeTimezone(new Date(res[i].end_time), "America/Vancouver");
            }

            setEvents(res);
        })
        .catch((err) => console.log(err));
    }
    React.useEffect(()=>{
        getEvents();
    },[]);
    return (
        <Router>
            <div class="events-flex">
                <div class="events-calendar">
                    <header class="events">
                        <div class="u-container">
                            <div class="logo-area">
                                <a class="home-link" href="/" title="Go to The Ubyssey Homepage">
                                <div class="top-logo ubyssey_small_logo light-logo" style={{'background-image': "url('https://ubyssey.ca/static/ubyssey/images/ubyssey-logo-small.e935f233a50c.svg')"}} alt="Ubyssey Logo"></div>
                                <div class="top-logo ubyssey_small_logo dark-logo"  style={{'background-image': "url('https://ubyssey.ca/static/ubyssey/images/ubyssey-logo%201.f3b3c0235809.svg')"}} alt="Ubyssey Logo"></div>
                                </a>
                            </div>
                        </div>

                        <h1 class="title">Events around campus</h1>

                        <EventsOptions />
                    </header>

                    <div id="calendar-rows">
                        <EventsCalendar events={events} start={start} setStart={setStart}/>
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

function EventsOptions() {
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
        navigate(`?category=${newCategory}`);
    };

    return (
        <>
            <div className="events-calendar--categories">
                {isMobile ? (
                    <select
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
                                <Link to={`?category=${cat.value}`}>{cat.label}</Link>
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

function EventsCalendar({events, start, setStart}) {

    const [numberOfWeeks, setNumberOfWeeks] = React.useState(4);
    const [isMonthToggled, setIsMonthToggled] = React.useState(false);
    let query = useQuery();
    const s = 1000
    const m = s * 60;
    const h = m * 60;
    const d = h * 24;
    // const history = useHistory();
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
                var cur = new Date(cur.getTime() + d);
                week['days'].push(day);
            }
            calendar.push(week);
        }

        function placeEvents(calendar, event) {
            var cur = new Date(event.start_time);
            cur.setHours(0,0,0,0);
            event.displayTime = displayTime(event.start_time);
            if (event.end_time.getTime() - event.start_time.getTime() >= d-h) {
                event.displayTime = "";
            }
            while(cur < new Date(event.end_time)) {
                const delta = Math.floor((cur.getTime() - start.getTime()) / d);
                if (delta > 0 && delta < (7*(numberOfWeeks))) {
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
        if (event.host != null && event.host != "") {
            if (!(hosts.includes(event.host))) {
                hosts.push(event.host);
            }
        }
        return hosts;
    }

    function toggleCategory(that, searchParams, setSearchParams) {

        var hidden = [];
        if (searchParams.has("hidden")) {
            hidden = searchParams.get("hidden").split(" ");
        }
        hidden = hidden.filter((i) => i!="");
        
        if (hidden.includes(that.id)) {
            hidden.pop(hidden.indexOf(that.id));
        } else {
            hidden.push(that.id);
        }
        
        if (hidden.length == 0) {
            searchParams.delete("hidden");
        } else {
            searchParams.set("hidden", hidden.join(" "));
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
    
    const calculateNewStart = (direction, start) => {
        // Set the start date to the first day of the current month
        let newStart = new Date(start);

        // console.log("Start date is :"+start)
        if(newStart.getDate() !== 1){
        while (newStart.getDay() !== 1) {
            newStart = new Date(newStart.getTime() + d);
        }
        newStart.setDate(1);
        newStart.setMonth(newStart.getMonth()+1)
        }
        // Adjust the month based on the direction
        const currentMonth = newStart.getMonth();
        console.log(direction);
        if (direction === 'next') {
            // console.log("Current month is" + newStart);
            newStart.setMonth(currentMonth + 1);
            // console.log("Current month is after update" +newStart);        
        } else {
            newStart.setMonth(currentMonth - 1);
        }    
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

        // Update the URL programmatically using history.push
        navigate(`?month=${newMonth}&year=${newYear}`);

        // Set the new start date and other logic
        console.log("Navigating to", newMonth, newYear);
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
    
    var category = "all";
    var highlight = "category";
    if (query.get("category") != null){
        category = query.get("category");
        highlight = "host";
    }
    var eventHash = "";
    if (query.get("event") != null){
        eventHash = query.get("event");
    }

    let [searchParams, setSearchParams] = useSearchParams();

    var hidden = [];
    if (searchParams.has("hidden")) {
        hidden = searchParams.get("hidden").split(" ");
    }

    var displayedEvents = events.filter((e) => (e.category===category || category==="all"));
    var legend = ["Sports", "Entertainment", "Community", "Seminar"];
    if (category != "all") {
        legend = displayedEvents.reduce(getHosts, []);
    }
    displayedEvents = displayedEvents.filter((e) => !hidden.includes(slugify(e[highlight])));
    var calendar = arrangeCalendar(displayedEvents);
    React.useEffect(()=>{
        colourIn(legend);
    });
    
    const isPhablet = useIsMobile();
    const [isDarkMode, setIsDarkMode] = useState(false);

    useEffect(() => {
        // Check if the page has the "dark" theme applied
        const theme = document.documentElement.getAttribute('color-css-theme');
        setIsDarkMode(theme === 'dark');
    }, []);

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
                to={`?month=${calculateNewStart('previous', start).month}&year=${calculateNewStart('previous', start).year}`}
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
            <span className="month-label">{calendar[0]?.month}</span>
            <Link
                to={`?month=${calculateNewStart('next', start).month}&year=${calculateNewStart('next', start).year}`}
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
            <Link 
                to={`?month=${calculateNewStart('previous', start).month}&year=${calculateNewStart('previous', start).year}`}                
                className="arrow-button up-arrow" 
                title="Previous month"
                onClick={(e) => {
                    e.preventDefault();
                    handleMonthNavigation('previous');
                }}
            >
                <svg width="32px" height="32px" viewBox="0 0 32 32">
                <path d="M18.221,7.206l9.585,9.585c0.879,0.879,0.879,2.317,0,3.195l-0.8,0.801c-0.877,0.878-2.316,0.878-3.194,0l-7.315-7.315l-7.315,7.315c-0.878,0.878-2.317,0.878-3.194,0l-0.8-0.801c-0.879-0.878-0.879-2.316,0-3.195l9.587-9.585c0.471-0.472,1.103-0.682,1.723-0.647C17.115,6.524,17.748,6.734,18.221,7.206z" fill={isDarkMode ? "#FFFFFF" : "#000000"} />
                </svg>
            </Link>
            <Link 
                to={`?month=${calculateNewStart('next', start).month}&year=${calculateNewStart('next', start).year}`}                
                className="arrow-button down-arrow" 
                title="Next month"
                onClick={(e) => {
                    e.preventDefault();
                    handleMonthNavigation('next');
                }}
            >
                <svg width="32px" height="32px" viewBox="0 0 32 32">
                <path d="M18.221,7.206l9.585,9.585c0.879,0.879,0.879,2.317,0,3.195l-0.8,0.801c-0.877,0.878-2.316,0.878-3.194,0l-7.315-7.315l-7.315,7.315c-0.878,0.878-2.317,0.878-3.194,0l-0.8-0.801c-0.879-0.878-0.879-2.316,0-3.195l9.587-9.585c0.471-0.472,1.103-0.682,1.723-0.647C17.115,6.524,17.748,6.734,18.221,7.206z" fill={isDarkMode ? "#FFFFFF" : "#000000"} />
                </svg>
            </Link>
            </>
        )}
        </div>

        <div class="events-calendar--rows">{calendar.map((week, week_index) => 

            <div className={"events-calendar--row" + (week.this_week ? " enlarged" : "")}>
                {week_index===0 && !isPhablet &&
                    <h2 class="events-calendar--month">
                        <span className="full">{week.month}</span>
                        <span className="short">{week.month_short}</span>
                    </h2>
                }

                {week.days.map((day, day_index) => 
                    <>
                        {(day.day === 1 && week_index !== 0 && !(isMonthToggled && isPhablet)) && (
                            <h2 className="events-calendar--month">
                                <span className="full">{week.month}</span>
                                <span className="short">{week.month_short}</span>
                            </h2>
                        )}
                        
                        {/* Hide days in first week until day.day === 1 for mobile phone */}
                        {!(isMonthToggled && week_index === 0 && day.day > 7 && isPhablet) && 
                          !(week_index >= 4 && isPhablet && day.day < 7 && isMonthToggled) && (
                            <div className={"day " + day.phase}>
                                <button onClick={(e) => e.target.parentElement.parentElement.classList.toggle('enlarged')} className="events-calendar--number">
                                    <span className="events-calendar--number-dayOfWeek">{day.day_of_week} </span>{day.day}.
                                </button>
                                <ul>
                                    {day.events.map((event) => (
                                        <li className={(eventHash == event.hash && "selected") + " " + eventsTags(event)}>
                                            <Link
                                                title={event.title.replace("<br>", ", ")}
                                                className="calendar-item"
                                                to={"?event=" + event.hash}
                                                event-url={event.event_url}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    searchParams.set("event", event.hash);
                                                    setSearchParams(searchParams);
                                                }}
                                                dangerouslySetInnerHTML={{
                                                    __html: "<b>" + event.displayTime + "</b> " + event.title,
                                                }}
                                            ></Link>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </>
                )}

            </div>
        )}</div>

        <div class="legend">
            <ul>{legend.map((key, i) =>
                <li key={i} className={slugify(key)}>
                    <button id={slugify(key)} className={"legend-button" + (hidden.includes(slugify(key)) ? " inactive" : "")}
                    onClick={(e) => toggleCategory(e.target, searchParams, setSearchParams)} title={key}>{key}</button>
                </li>
            )}</ul>
        </div>
        </>
    );
}

function EventInfo({events}) {
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
                document.getElementsByTagName("title")[0].innerHTML = event.title;
                break;
            }
        }
    }

    React.useEffect(()=>{
        console.log(document.getElementById('event-dialog'));
        if(document.getElementById('event-dialog')) {
            document.getElementById('event-dialog').showModal();
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }
    })

    function exitEvent(searchParams, setSearchParams) {
        searchParams.delete("event");
        setSearchParams(searchParams);
    }

    return (
        <div class="events-info-container">
        {event && 
        <>
            {screen.width <= 759 ?
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
                    {__html: (event.host!=null ? "<b>" + (event.description ? event.host : "Hosted by " + event.host) + "</b> " : "") + event.description.replace(/(?:\r\n|\r|\n)/g, '<br>')}
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