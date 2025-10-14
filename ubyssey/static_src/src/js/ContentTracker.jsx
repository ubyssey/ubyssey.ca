import { useState, useEffect } from "react";
import ReactDOM from 'react-dom';

function dateformat(datetime) {
    if (datetime == null) {
        return "";
    }
    const date = new Date(datetime);

    const months = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "Jun.", "Jul.", "Aug.", "Sep.", "Oct.", "Nov.", "Dec."];
    return months[date.getMonth()] + " " + String(date.getDate()) + ", " + String(date.getFullYear());
}

function humanizeTimeliness(timeliness) {
    const labels = ["A day", "A few days", "A week", "Evergreen"];
    return labels[timeliness - 1];
}

function labelDate(dateNumber) {
    const months = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "Jun.", "Jul.", "Aug.", "Sep.", "Oct.", "Nov.", "Dec."];
    
    const date = dateNumber % 100;

    return months[Math.floor(dateNumber /100) % 100] + " " + String(date);    
}

function pad(num, size) {
    num = num.toString();
    while (num.length < size) num = "0" + num;
    return num;
}

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
        <div className={"o-content-tracker--timeline-article " + article.assigning_section} title={article.subject} onClick={() => {setViewedArticle(article)}}>
            <div className="o-content-tracker--timeline-article--subject" dangerouslySetInnerHTML={{__html: article.subject}}></div>
            <div className="o-content-tracker--timeline-article--state"><span className="state">{article.state}</span> <span className={"deadline " + new Date(article.deadline) < new Date() ? "late": ""}></span>Deadline: {dateformat(article.deadline)}</div>

            {article.article_page && 
            <div className="o-content-tracker--timeline-article--article_page">
            <svg class="icon icon-doc-empty-inverse w-panel__icon" aria-hidden="true"><use href="#icon-doc-empty-inverse"></use></svg>
            <div className="o-content-tracker--timeline-article--headline"><a href={article.article_page.url} title={article.article_page.title} dangerouslySetInnerHTML={{__html: article.article_page.title}}></a></div>
            </div>
            }
        </div>
    ) 
}

export default function ContentTracker() {
    const [articles, setArticles] = useState([]);
    const [articlesBySectionByDate, setArticlesBySectionByDate] = useState({});
    const [dateRange, setDateRange] = useState([]);
    const [timeCursor, setTimeCursor] = useState(6);
    const [timeScale, setTimeScale] = useState(8);

    const [viewedArticle, setViewedArticle] = useState({});

    const sections = ["news", "culture", "features", "opinion", "humour", "research", "sports"];
    const todayNumber = dateNumber(new Date());

    function getArticles(timeCursor, timeScale) {
        const apiUrl = "/admin/story_assignment_api/?timeCursor=" + String(timeCursor) + "&timeScale=" + String(timeScale);
        fetch(apiUrl).then((response) => response.json().then((json) => {
            setArticles(json);
        }));
    }

    function getArticlesBySectionByDate(articles) {
        console.log(articles);
        let bySection = Object.groupBy(articles, ({assigning_section})=> assigning_section);
        
        console.log(bySection);
        for (let k of Object.keys(bySection)) {
            bySection[k] = Object.groupBy(bySection[k], ({target}) => dateNumber(target));
        }
        console.log(bySection);

        return bySection;
    }

    useEffect(() => {
        getArticles(timeCursor, timeScale);
        const d = 24 * 60 * 60 * 1000;
        const w = 7 * d;
        const today = new Date()
        const lower = new Date(today.getTime() + (w * timeCursor) - (w * timeScale));
        const upper = new Date(today.getTime() + (w * timeCursor));

        let range = [];
        for (let i=lower; i < upper; i=new Date(new Date(i.getTime() + (d * 1.3)).setHours(0, 0, 0, 0))) {
            console.log(i)
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
        <div class="c-content-tracker--upper-left">
            <h2>Active assignments</h2>
            <div className="c-content-tracker--deadline-list">
                {articles.map(article =>
                    <div className="c-content-tracker--deadline-list-item" onClick={() => {setViewedArticle(article)}}>
                        <h3 title={article.subject}>{article.subject}</h3>
                        <div>{article.assigning_section} - {article.story_type}</div>
                        <div>{article.state}</div>
                        <div className={"c-content-tracker--deadline-list-item--deadline " + (new Date(article.deadline) < new Date() ? "late": "")}>Deadline: {dateformat(article.deadline)}</div>
                    </div>
                )}
            </div>
        </div>
        <div class="c-content-tracker--viewed">
            {viewedArticle.id ?
            <div className="c-content-tracker--viewed-article">
                <div className="c-content-tracker--viewed-assignment">
                    <h3>{viewedArticle.subject} <span className="c-content-tracker--viewed-assignment-type">{viewedArticle.assigning_section} - {viewedArticle.story_type}</span></h3>
                    <div className="c-content-tracker--viewed-assignment-state">{viewedArticle.state}</div>
                    <p>{viewedArticle.summary}</p>
                    <div><span className="w-panel__heading--label">Created:</span> {dateformat(viewedArticle.created)}, <span className="w-panel__heading--label">Deadline:</span> {dateformat(viewedArticle.deadline)}, <span className="w-panel__heading--label">Target:</span> {dateformat(viewedArticle.target)}</div>
                    <a href={viewedArticle.article_file_folder}>File folder</a>, <a href={viewedArticle.manuscript}>Manuscript</a>
                </div>
            </div>
            :
            <p>Click on an assignment in the timeline to view its information!</p>
            }
        </div>
    </div>

    <div className="c-content-tracker--below">

        <div className="c-content-tracker--menu">
            <div>
                <button onClick={() => {setTimeCursor(timeCursor - 1)}}>Back {timeCursor}</button>
                <button onClick={() => {setTimeCursor(timeCursor + 1)}}>Forward</button>
                <button onClick={() => {setTimeScale(timeScale + 1)}}>Out {timeScale}</button>
                <button onClick={() => {setTimeScale(timeScale - 1)}}>In</button>
            </div>
            <div class="actionbutton">           
                <a href="/admin/snippets/content_tracker/visualassignment/add/" target="_blank" className="button bicolor button--icon"><span class="icon-wrapper"><svg class="icon icon-plus icon" aria-hidden="true"><use href="#icon-plus"></use></svg></span>Add visual assignment</a>
            </div>
            <div class="actionbutton">           
                <a href="/admin/snippets/content_tracker/storyassignment/add/" target="_blank" className="button bicolor button--icon"><span class="icon-wrapper"><svg class="icon icon-plus icon" aria-hidden="true"><use href="#icon-plus"></use></svg></span>Add story assignment</a>
            </div>
        </div>

        <div className="c-content-tracker--timeline-container">
            <div class="c-content-tracker--timeline">
                <table>
                    <thead></thead>
                    <tbody>
                        <tr>
                            <th className="c-content-tracker--labels">Section</th>
                            <th className="c-content-tracker--gap past"></th>
                            {dateRange.map(date => 
                            <>
                                <th className={(date == todayNumber? "today": "") + (date < todayNumber? " past": "")}>
                                    {labelDate(date) + (date == todayNumber? " Today": "")}
                                </th>
                                {date == todayNumber? 
                                <th className="late">
                                    Late
                                </th>
                                : <></>}
                            </>
                            )}
                        </tr>
                    {sections.map((section) =>
                        <tr class="c-content-tracker--sections">
                            <td className="c-content-tracker--labels">{section}</td>
                            <td className="c-content-tracker--gap past"></td>
                            {dateRange.map(date => 
                            <>
                                <td className={(date == todayNumber? "today": "") + (date < todayNumber? " past": "")}>
                                    {section in articlesBySectionByDate ?
                                    <>
                                        {date in articlesBySectionByDate[section] && 
                                        <div className="c-content-tracker--timeline-articles-container">
                                            {articlesBySectionByDate[section][date].map((article) =>
                                            <ContentTrackerTimelineArticle article={article} setViewedArticle={setViewedArticle} />
                                        )}</div>
                                        }
                                    </>
                                    :
                                    <></> 
                                    }

                                </td>
                                {date == todayNumber? 
                                    <td className="late">

                                    </td>
                                : <></>}
                            </>
                            )}
                        </tr>
                    )}
                    </tbody>
                    <tfoot></tfoot>

                </table>
            </div>
            <div className="c-content-tracker--labels-background"></div>
        </div>
    </div>
    </>
    );
}

ReactDOM.render(
    <ContentTracker />,
    document.getElementById('content-tracker')
);