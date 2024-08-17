import React from 'react'
import {
    BrowserRouter as Router,
    Link,
    useLocation
} from "react-router-dom";
import ReactDOM from 'react-dom';

export function QueryEventsCalendar() {
    return (
      <Router>
        <EventsCalendar />
      </Router>
    );
}

export function QueryEventsOption() {
    return (
      <Router>
        <EventsOptions />
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

function EventsCalendar() {
    let query = useQuery();
    var calendar = [];
    var highlight = [];
    var legend = [];

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

        <div class="events-calendar--rows">{calendar.map((week, i) => {

            <div className="events-calendar--row">
            {i==0 && 
                <h2 class="events-calendar--month">
                    <span className="full">{week.month}</span>
                    <span className="short">{week.month_short}</span>
                </h2>
            }
            {week.days.map((day, i) => {
                {i != 0 && day.day == 1 && 
                    <h2 className="events-calendar--month">
                    <span className="full">{week.month}</span>
                    <span className="short">{week.month_short}</span>
                    </h2>
                }
                <div className={"day " + day.phase}>
                    <button onClick="this.parentElement.parentElement.classList.toggle('enlarged')" className="events-calendar--number">
                        <span className="events-calendar--number-dayOfWeek">{day.day_of_week} </span>{day.day}.
                    </button>
                    <ul>{day.events.map((event) => {
                        <li className={event.host|slugify + " " + event.category}/*{event.event_url == selectedEvent.event_url && "selected"}*/
                        style={highlight == 'category' && event.category == 'seminar' && 
                            {"display": "none"}
                        }>
                        <a title={event.title} className="calendar-item" href={"?event=" + event.event_url} event-url={event.event_url}>
                            {/*
                            {event.start_time|date:"F j" != event.end_time|date:"F j" and day.day|stringformat:"i" != event.start_time|date:"j" %}<b>Ongoing</b>{% elif event.start_time|time == 'midnight' %}{% else %}<b>{{event.start_time|time:"fA"}}</b>{% endif %} {event.title|safe}
                            */ event.title}
                        </a>
                        </li>
                    })}</ul>
                </div>})}
            </div>
        })}</div>

        <div class="legend">
            <ul>{legend.map(key =>
                <li class="{{key|slugify}}">
                    <button id="{{key|slugify}}" class="legend-button {% if key == 'seminar' %}inactive{% endif %}" onClick="toggleCategory(this)">{{key}}</button>
                </li>
            )}</ul>
        </div>
        </>
    )
}