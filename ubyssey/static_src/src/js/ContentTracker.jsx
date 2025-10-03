import { useState, useEffect } from "react";
import ReactDOM from 'react-dom';

function humanizeTimeliness(timeliness) {
    const labels = ["A day", "A few days", "A week", "Evergreen"];
    return labels[timeliness - 1];
}

function labelDate(dateNumber) {
    const months = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "Jun.", "Jul.", "Aug.", "Sep.", "Oct.", "Nov.", "Dec."];
    const date = dateNumber % 100;

    if (date == 1) {
        return months[Math.floor(dateNumber /100) % 100] + " " + String(date);
    }
    return String(date);
}

function pad(num, size) {
    num = num.toString();
    while (num.length < size) num = "0" + num;
    return num;
}

const range = (start, stop, step) =>
  Array.from(
    { length: Math.ceil((stop - start) / step) },
    (_, i) => start + i * step,
  );

function dateNumber(datetime) {
    datetime = new Date(datetime);
    return parseInt(
        String(datetime.getFullYear()) + 
        pad(datetime.getMonth(), 2) +
        pad(datetime.getDate(), 2)        
    );
}

function ContentTrackerTimelineArticle({article, setViewedArticle}) {
    return (
        <div class={"o-content-tracker--timeline-article " + article.current_section}>
            <div class="o-content-tracker--timeline-article--hover-info">
                <img src={article.image}></img>
            </div>
            <div class="o-content-tracker--timeline-article--headline" title={article.title} dangerouslySetInnerHTML={{__html: article.title}} onClick={() => {setViewedArticle(article)}}></div>
        </div>
    ) 
}

export default function ContentTracker() {
    const [articles, setArticles] = useState([]);
    const [articlesBySectionByDate, setArticlesBySectionByDate] = useState({});
    const [dateRange, setDateRange] = useState([]);
    const [timeCursor, setTimeCursor] = useState(0);
    const [timeScale, setTimeScale] = useState(8);

    const [viewedArticle, setViewedArticle] = useState({});

    function getArticles(timeScale, timeCursor) {
        const apiUrl = "/admin/articlepage_drafts_api/?timeCursor=" + String(timeCursor) + "&timeScale=" + String(timeScale);
        fetch(apiUrl).then((response) => response.json().then((json) => {
            setArticles(json);
        }));
    }

    function getArticlesBySectionByDate(articles) {
        console.log(articles);
        let bySection = Object.groupBy(articles, ({current_section})=> current_section);
        console.log(bySection);
        for (let k of Object.keys(bySection)) {
            bySection[k] = Object.groupBy(bySection[k], ({datetime}) => dateNumber(datetime));
        }
        console.log(bySection);
        return bySection;
    }

    useEffect(() => {
        getArticles(timeCursor, timeScale);
        const d = 24 * 60 * 60 * 1000;
        const w = 7 * d;
        const today = new Date()
        const lower = new Date(today.getTime() - (w * timeCursor) - (w * timeScale));
        const upper = new Date(today.getTime() - (w * timeCursor));

        let range = [];
        for (let i=lower; i < upper; i=new Date(i.getTime() + d)) {
            range.push(dateNumber(i));
        }

        setDateRange(range);
    }, [timeCursor, timeScale]);

    useEffect(() => {
        setArticlesBySectionByDate(getArticlesBySectionByDate(articles));
    }, [articles]);

    return (
    <>
    <div class="c-content-tracker--upper">
        <div class="c-content-tracker--data">
            <button onClick={() => {setTimeCursor(timeCursor + 1)}}>Back {timeCursor}</button>
            <button onClick={() => {setTimeCursor(timeCursor - 1)}}>Forward</button>
            <button onClick={() => {setTimeScale(timeScale + 1)}}>Out {timeScale}</button>
            <button onClick={() => {setTimeScale(timeScale - 1)}}>In</button>
        </div>
        <div class="c-content-tracker--viewed">
            {viewedArticle ?
            <>
                <div className="c-content-tracker--viewed-img">
                    <img src={viewedArticle.image}></img>
                </div>
                <h1 dangerouslySetInnerHTML={{__html: viewedArticle.title}}></h1>
                <p><a href={viewedArticle.url} title={viewedArticle.title} dangerouslySetInnerHTML={{__html: viewedArticle.title}}></a></p>
                <p>Timeliness: {humanizeTimeliness(viewedArticle.timeliness)}</p>
            </>
            :
            <p>Click on an assignment in the timeline to view its information!</p>
            }
        </div>
    </div>

    <div className="c-content-tracker--timeline-container">
        <div class="c-content-tracker--timeline">
            <table>
                <thead></thead>
                <tbody>
                    <tr>
                        <th className="c-content-tracker--labels">Section</th>
                        <th className="c-content-tracker--gap"></th>
                        {dateRange.map(date => 
                            <th>
                                {labelDate(date)}
                            </th>
                        )}
                    </tr>
                {Object.keys(articlesBySectionByDate).map((section) =>
                    <tr class="c-content-tracker--sections">
                        <td className="c-content-tracker--labels">{section}</td>
                        <td className="c-content-tracker--gap"></td>
                        {dateRange.map(date => 
                            <td>
                                {date in articlesBySectionByDate[section] && 
                                <div className="c-content-tracker--timeline-articles-container">
                                    {articlesBySectionByDate[section][date].map((article) =>
                                    <ContentTrackerTimelineArticle article={article} setViewedArticle={setViewedArticle} />
                                )}</div>
                                }
                            </td>
                        )}
                    </tr>
                )}
                </tbody>
                <tfoot></tfoot>

            </table>
        </div>
        <div className="c-content-tracker--labels-background"></div>
    </div>
    </>
    );
}

ReactDOM.render(
    <ContentTracker />,
    document.getElementById('content-tracker')
);