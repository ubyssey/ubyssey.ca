import React from 'react'
import {
    BrowserRouter as Router,
    Link,
    useLocation
} from "react-router-dom";
import ReactDOM from 'react-dom';
import axios from "axios";

export function QueryEventsCalendar() {
    const [events, setEvents] = React.useState([]);
    function getEvents(){
        axios
        .get(
            `/api/events/`
        )
        .then((response) => {
            const res = response.data.results;
            console.log(res);
            setEvents(res);
        });
    }
    React.useEffect(()=>{
        getEvents();
    },[])
    return (
        <Router>
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
                <EventsCalendar events={events} />
            </div>
 
        </Router>
    );
}

function useQuery() {
    const { search } = useLocation();
  
    return React.useMemo(() => new URLSearchParams(search), [search]);
}  

function capitalize(s)
{
    return s[0].toUpperCase() + s.slice(1);
}

function slugify(str) {
    // Thanks https://dev.to/bybydev/how-to-slugify-a-string-in-javascript-4o9n
    str = str.replace(/^\s+|\s+$/g, ''); // trim leading/trailing white space
    str = str.toLowerCase(); // convert string to lowercase
    str = str.replace(/[^a-z0-9 -]/g, '') // remove any non-alphanumeric characters
             .replace(/\s+/g, '-') // replace spaces with hyphens
             .replace(/-+/g, '-'); // remove consecutive hyphens
    return str;
}

function EventsOptions() {
    let query = useQuery();
    var category = "all";
    if (query.get("category") != null){
        category = query.get("category");
    }
    console.log(category);

    var highlight = "category";

    var ical = {'url': 'https://ubyssey.ca/events/ical/',
            'title': "Ubyssey's Events Around Campus iCal Feed"};

    var rss = {'url': 'https://ubyssey.ca/events/rss/',
        'title': "Ubyssey's Events Around Campus rss Feed"};

    var meta = {
        'title': "Events Around Campus Calendar",
        'description': "Events Around Campus collected by The Ubyssey",
        'url': 'https://ubyssey.ca/events/',
        };

    if (category != "all") {
        highlight = "host";
        
        ical = {'url': 'https://ubyssey.ca/events/ical/?category=' + category,
                'title': "Ubyssey's " + capitalize(category)  + " Around Campus iCal Feed"};

        rss = {'url': 'https://ubyssey.ca/events/rss/?category=' + category,
            'title': "Ubyssey's " + capitalize(category)  + " Around Campus rss Feed"};

        meta = {
            'title': capitalize(category) + " Around Campus Calendar",
            'description': capitalize(category)  + " Around Campus collected by The Ubyssey",
            'url': 'https://ubyssey.ca/events/?category=' + category,
            };

    }

    return (
        <>
        <div class="events-calendar--categories">
            <ul>
                <li class={category == 'all' && "selected"}><Link to="?">All</Link></li>
                <li class={category == 'sports' && "selected"}><Link to="?category=sports">Sports</Link></li>
                <li class={category == 'entertainment' && "selected"}><Link to="?category=entertainment">Entertainment</Link></li>
                <li class={category == 'community' && "selected"}><Link to="?category=community">Community</Link></li>
                <li class={category == 'seminar' && "selected"}><Link to="?category=seminar">Seminar</Link></li>
            </ul>
            <a class="alt-icon" href={ical.url} title={ical.title}><ion-icon name="calendar"></ion-icon></a>
            <a class="alt-icon" href={rss.url} title={rss.title}><ion-icon name="logo-rss"></ion-icon></a>
        </div>
        <p class="mobile-alt"><a href={ical.url}><ion-icon name="calendar"></ion-icon> iCal File</a> <a href={rss.url}><ion-icon name="logo-rss"></ion-icon> Rss Feed</a></p>
        </>
    )
}

function EventsCalendar({events}) {
    function eventsTags(event) {
        var tags = [];
        if (event.host != null) {
            tags.push(slugify(event.host));
        }
        tags.push(slugify(event.category));
    
        return tags.join(" ");
    }

    function dayString(date) {
        return String(date.getDate()) + String(date.getMonth()) + String(date.getFullYear()); 
    }

    function arrangeCalendar(events) {
        console.log("filtered events: ")
        console.log(events);
        const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const shortenedMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const s = 1000
        const m = s * 60;
        const h = m * 60;
        const d = h * 24;

        const today = new Date();

        var start = new Date(today.getTime() - (10*d));
        while(start.getDay() != 1) {
            start = new Date(start.getTime() + d);
        }

        var cur = new Date(start);

        var calendar = [];
        for(let i=0; i<4; i++) {
            var week = {
                'month': months[cur.getMonth()],
                'month_short': shortenedMonths[cur.getMonth()],
                'days': []
            };
            for(let a=0; a<7; a++) {
                var day = {
                    'day': cur.getDate(),
                    'phase': 'today',
                    'day_of_week': weekDays[cur.getDay()],
                    'events': [],
                };
                if (dayString(cur) == dayString(today)) {
                    day['phase'] = 'today';
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
        console.log(calendar);

        function placeEvents(calendar, event) {
            const delta = Math.floor((new Date(event.start_time).getTime() - start.getTime()) / d);
            calendar[Math.floor(delta/7)]['days'][delta % 7]['events'].push(event);
            return calendar;
        }

        calendar = events.reduce(placeEvents, calendar);
        console.log(calendar);
        return calendar;
    }

    function getHosts(hosts, event) {
        if (event.host != null) {
            console.log(event.host);
            if (!(hosts.includes(event.host))) {
                console.log("pushed");
                hosts.push(event.host);
            }
        }
        return hosts;
    }

    function toggleCategory(that) {
        console.log(that);
        if (that.classList.contains("inactive"))
        {
            $('.day li.' + that.id).show();
        } else {
            $('.day li.' + that.id).hide();
        }
        that.classList.toggle('inactive');
    }

    let query = useQuery();
    var category = "all";
    if (query.get("category") != null){
        category = query.get("category");
    }
    var displayedEvents = events.filter((e) => e.category===category || category==="all");
    var calendar = arrangeCalendar(displayedEvents);
    console.log(calendar);
    var legend = ["Sports", "Entertainment", "Community", "Seminar"];
    if (category != "all") {
        legend = displayedEvents.reduce(getHosts, []);
    }
    console.log(legend);
    var highlight = "";

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

        <div class="events-calendar--rows">{calendar.map((week, week_index) => 

            <div className="events-calendar--row">
                {week_index===0 && 
                    <h2 class="events-calendar--month">
                        <span className="full">{week.month}</span>
                        <span className="short">{week.month_short}</span>
                    </h2>
                }
                {week.days.map((day, day_index) => 
                <>
                    {(day.day === 1 && week_index!== 0) && 
                        <h2 className="events-calendar--month">
                        <span className="full">{week.month}</span>
                        <span className="short">{week.month_short}</span>
                        </h2>
                    }
                    <div className={"day " + day.phase}>
                        <button onClick="this.parentElement.parentElement.classList.toggle('enlarged')" className="events-calendar--number">
                            <span className="events-calendar--number-dayOfWeek">{day.day_of_week} </span>{day.day}.
                        </button>
                        <ul>{day.events.map((event) => 
                            <li className={eventsTags(event)}/*{event.event_url == selectedEvent.event_url && "selected"}
                            style={highlight == 'category' && event.category == 'seminar' && 
                                {"display": "none"}
                            }*/>
                            <a title={event.title} className="calendar-item" href={"?event=" + event.event_url} event-url={event.event_url}>
                                {/*
                                {event.start_time|date:"F j" != event.end_time|date:"F j" and day.day|stringformat:"i" != event.start_time|date:"j" %}<b>Ongoing</b>{% elif event.start_time|time == 'midnight' %}{% else %}<b>{{event.start_time|time:"fA"}}</b>{% endif %} {event.title|safe}
                                */ event.title}
                            </a>
                            </li>
                        )}</ul>
                    </div>
                </>)}
            </div>
        )}</div>

        <div class="legend">
            <ul>{legend.map((key, i) =>
                <li key={i} className={slugify(key)}>
                    <button id={slugify(key)} className="legend-button" onClick={(e) => toggleCategory(e.target)}>{key}</button>
                </li>
            )}</ul>
        </div>
        </>
    );
}