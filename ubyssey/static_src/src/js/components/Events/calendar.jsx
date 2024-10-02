import React from 'react'
import {
    BrowserRouter as Router,
    Link,
    useLocation,
    useSearchParams
} from "react-router-dom";
import ReactDOM from 'react-dom';
import axios from "axios";

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
    const [events, setEvents] = React.useState([]);
    function getEvents(){
        
        const s = 1000
        const m = s * 60;
        const h = m * 60;
        const d = h * 24;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        var start = new Date(today.getTime() - (10*d));
        while(start.getDay() != 1) {
            start = new Date(start.getTime() + d);
        }
        let end = new Date(start.getTime() + (4*7+1)*d)

        let q = ["end_time__gte=" + getDateString(start),"start_time__lte=" + getDateString(end),"limit=300"];
        axios
        .get(
            '/api/events/?' + q.join("&")
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
                        <EventsCalendar events={events} />
                    </div>
                </div>
            
            <EventInfo events={events}/>
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
    var category = "all";
    if (query.get("category") != null){
        category = query.get("category");
    }

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

    document.getElementsByTagName("title")[0].innerHTML = meta.title

    return (
        <>
        <div class="events-calendar--categories">
            <ul>
                <li class={category == 'all' && "selected"}><Link to="?hidden=seminar">All</Link></li>
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
            if (event.end_time.getTime() - event.start_time.getTime() >= d-h || event.start_time.getHours() == 0) {
                event.displayTime = "";
            }
            while(cur <= new Date(event.end_time)) {
                const delta = Math.floor((cur.getTime() - start.getTime()) / d);
                if (delta >= 0 && delta < (7*4)) {
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
        hosts.sort();
        return hosts;
    }

    function toggleCategory(that, searchParams, setSearchParams) {

        var hidden = [];
        if (searchParams.has("hidden")) {
            hidden = searchParams.get("hidden").split(" ");
        }
        hidden = hidden.filter((i) => i!="");
        
        if (hidden.includes(that.id)) {
            hidden.splice(hidden.indexOf(that.id), 1);
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

    let query = useQuery();
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

            <div className={"events-calendar--row" + (week.this_week ? " enlarged" : "")}>
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
                        <button onClick={(e) => e.target.parentElement.parentElement.classList.toggle('enlarged')} className="events-calendar--number">
                            <span className="events-calendar--number-dayOfWeek">{day.day_of_week} </span>{day.day}.
                        </button>
                        <ul>{day.events.map((event) => 
                            <li className={(eventHash==event.hash && "selected") + " " + eventsTags(event)}>
                            <Link title={event.title.replace("<br>", ", ")} className="calendar-item" to={"?event=" + event.hash} event-url={event.event_url}
                            onClick={(e) => {
                                e.preventDefault();
                                searchParams.set("event", event.hash);
                                setSearchParams(searchParams);
                            }}
                            dangerouslySetInnerHTML={
                               {__html: "<b>" + event.displayTime + "</b> " +  ((event.host && event.category=="seminar") ? event.host.replace("UBC ", "").split("for ").slice(-1)[0].split("of ").slice(-1)[0] + ":<br>" : "" ) + event.title}
                            }>
                                {/*
                                {event.start_time|date:"F j" != event.end_time|date:"F j" and day.day|stringformat:"i" != event.start_time|date:"j" %}<b>Ongoing</b>{% elif event.start_time|time == 'midnight' %}{% else %}<b>{{event.start_time|time:"fA"}}</b>{% endif %} {event.title|safe}
                                */}
                            </Link>
                            </li>
                        )}</ul>
                    </div>
                </>)}
            </div>
        )}</div>

        <div class="legend">
            <ul>{legend.map((key, i) =>
                <li key={i} className={slugify(key)}>
                    <button id={slugify(key)} className={"legend-button" + (hidden.includes(slugify(key)) ? " inactive" : "")}
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
    const [widthMode, setWidthMode] = React.useState(window.innerWidth <= 759);
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
            setWidthMode(window.innerWidth <= 759);
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