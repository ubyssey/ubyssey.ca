import { useState, useEffect } from "react";
import ReactDOM from 'react-dom';

const storyAssignmentState = [
    "None",
    "Awaiting",
    "Editing",
    "Ready",
    "Published"
]

const storyAssignmentStateProgress = ["0%", "25%", "50%", "75%", "100%"];

function transformHypenedString(string) {
    string = string.replaceAll("-", " ");
    return string[0].toUpperCase() + string.slice(1);
}

function changeTimezone(datetime, ianatz) {
    if (String(datetime).includes("T")) {
        datetime = new Date(datetime);        
    } else {
        datetime = new Date(new Date(datetime).toLocaleDateString("en-US", {timeZone: "UTC"}));
    }
    return datetime;
  }

function dateformat(datetime) {
    if (datetime == null) {
        return "";
    }
    datetime = changeTimezone(datetime, "America/Vancouver");

    const months = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "Jun.", "Jul.", "Aug.", "Sep.", "Oct.", "Nov.", "Dec."];
    return months[datetime.getMonth()] + " " + String(datetime.getDate()) + (Math.abs(new Date().getFullYear()-datetime.getFullYear()) > 1 ? ", " + String(datetime.getFullYear()) : "");
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
    datetime = changeTimezone(datetime, "America/Vancouver");
    return parseInt(
        String(datetime.getFullYear()) + 
        pad(datetime.getMonth(), 2) +
        pad(datetime.getDate(), 2)        
    );
}

function VisualAssignmentProgress({visual_request}) {
    return (
        <div className="o-content-tracker--timeline-article--progress-item">
        <>{visual_request.state != "completed" ?
            <><svg class="icon icon-radio-empty default" aria-hidden="true"><use href="#icon-radio-empty"></use></svg> Awaiting </>
        :
            <><svg class="icon icon-radio-full default" aria-hidden="true"><use href="#icon-radio-full"></use></svg> Recieved </>           
        }
        {transformHypenedString(visual_request.visual_type)}
        </>

        </div>
    );
}

function ContentTrackerArticleProgress({article}) {
    return (
        <>
            <div className="o-content-tracker--timeline-article--progress-item">    
                <svg class={"icon " + (article.state == 4 ? "icon-circle-check" : article.state < 3 ? "icon-radio-empty": "icon-radio-full") + " default"} aria-hidden="true"><use href={(article.state == 4 ? "#icon-circle-check" : article.state < 3 ? "#icon-radio-empty": "#icon-radio-full")}></use></svg> {storyAssignmentState[article.state]}
                {article.state == 4 ?
                <></>
                : article.state > 1 ? 
                <> (Target: {dateformat(article.target)})</>
                : 
                <> (Deadline: {dateformat(article.deadline)})</>
                }
            </div>

            {article.visual_requests.map((visual_request) =>
            <VisualAssignmentProgress visual_request={visual_request} />
            )}

            {article.article_page && 
            <div className="o-content-tracker--timeline-article--progress-item">
            <svg class="icon icon-doc-empty-inverse w-panel__icon" aria-hidden="true"><use href="#icon-doc-empty-inverse"></use></svg>
            <div className="o-content-tracker--timeline-article--headline"><a href={"/admin/pages/" + article.article_page.id + "/edit/"} title={article.article_page.title} dangerouslySetInnerHTML={{__html: article.article_page.title}}></a></div>
            </div>
            }
        </>
    );
}

function ContentTrackerTimelineArticle({article, setViewedArticle}) {
    return (
        <div className={"o-content-tracker--timeline-article " + article.assigning_section} title={article.subject} onClick={() => {setViewedArticle(article)}}>
            <div className="o-content-tracker--timeline-article--subject" dangerouslySetInnerHTML={{__html: article.subject}}></div>
            <ContentTrackerArticleProgress article={article} />
        </div>
    );
}

function ContentTrackerVisualRequest({visual_request}) {
    return (
        <div className="o-content-tracker--viewer--visual_request">
            <h3>{transformHypenedString(visual_request.visual_type)} {visual_request.state == "completed" ? <>(Completed)</> : <>(Awaiting)</>} <a href={"/admin/snippets/content_tracker/visualassignment/" + visual_request.id} target="_blank" className="button button--icon text-replace white"><svg class="icon icon-edit icon" aria-hidden="true"><use href="#icon-edit"></use></svg>edit</a></h3>
            <dl>
                <dt><a href={visual_request.memo}>Memo</a></dt>
                <dd>{visual_request.request}</dd>
                {visual_request.assignees.length > 0 &&
                <>
                    <dt>Assignee{visual_request.assignees.length > 1 && <>(s)</>}</dt>
                    <dd dangerouslySetInnerHTML={{__html: visual_request.assignees.map(({full_name, slug}) => "<a href='/authors/" + slug + "/'>" + full_name + "</a>").join(", ")}}></dd>
                </>
                }
            </dl>
            <div className="o-content-tracker--dates-data">
                <div>
                    <dt>Created:</dt> 
                    <dd>{dateformat(visual_request.created)}</dd>
                </div>
                <div>
                    <dt>Deadline:</dt>
                    <dd>{dateformat(visual_request.deadline)}</dd>
                </div>
            </div>
        </div>
    );
}

export default function ContentTracker() {
    const [activeStoryAssignments, setActiveStoryAssignments] = useState([]);
    const [articles, setArticles] = useState([]);
    const [articlesBySectionByDate, setArticlesBySectionByDate] = useState({});
    const [dateRange, setDateRange] = useState([]);
    const [timeCursor, setTimeCursor] = useState(7);
    const [timeScale, setTimeScale] = useState(8);

    const [deadlinesFilter, setDeadlinesFilter] = useState("all");

    const [viewedArticle, setViewedArticle] = useState({});

    const sections = ["news", "culture", "features", "opinion", "humour", "research", "sports"];
    const todayNumber = dateNumber(new Date());

    function getArticles(timeCursor, timeScale) {
        const apiUrl = "/admin/story_assignment_api/?timeCursor=" + String(timeCursor) + "&timeScale=" + String(timeScale);
        fetch(apiUrl).then((response) => response.json().then((json) => {
            setArticles(json);
        }));
    }

    function getActiveStoryAssignments() {
        const apiUrl = "/admin/story_assignment_api/?active=true&orderby=deadline";
        fetch(apiUrl).then((response) => response.json().then((json) => {
            setActiveStoryAssignments(json);
        }));        
    }

    function getArticlesBySectionByDate(articles) {
        console.log(articles);
        let bySection = Object.groupBy(articles, ({assigning_section})=> assigning_section);
        
        console.log(bySection);
        for (let k of Object.keys(bySection)) {
            bySection[k] = Object.groupBy(bySection[k], ({target, article_page}) => {
                if (article_page) {
                    if (article_page.live) {
                        return dateNumber(article_page.datetime);
                    }
                }
                if (dateNumber(target) < todayNumber) {
                    return "late";                    
                }
                return dateNumber(target);
            });
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
        lower.setHours(0, 0, 0, 0);
        const upper = new Date(today.getTime() + (w * timeCursor));
        upper.setHours(0, 0, 0, 0);

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

    useEffect(() => {
        getActiveStoryAssignments();
    }, []);

    return (
    <>
    <div class="c-content-tracker--upper">
        <div class="c-content-tracker--upper-left">
            <div class="c-content-tracker--upper-left--header">
                <h1>Active assignments</h1>
                <div className="w-field__input">
                    <select value={deadlinesFilter} onChange={e => setDeadlinesFilter(e.target.value)}>
                        <option value="all">All</option>
                        {sections.map((section) => 
                            <option value={section}>{transformHypenedString(section)} ({activeStoryAssignments.filter(({assigning_section}) => assigning_section == section).length})</option>
                        )}
                    </select>
                </div>
            </div>

            <table className="listing">
                <thead>
                    <tr>
                        <th>Story assignment</th>
                        <th>Story type</th>
                        <th>Assignee(s)</th>
                        <th>State</th>
                        <th>Deadline</th>
                        <th>Target</th>
                    </tr>
                </thead>
                <tbody>
                {activeStoryAssignments.filter(({assigning_section}) => assigning_section == deadlinesFilter || deadlinesFilter == "all").map(article =>
                    <tr className="c-content-tracker--deadline-list-item" onClick={() => {setViewedArticle(article)}}>
                        <td className="c-content-tracker--deadline-list-item--subject" title={article.subject}>{article.subject}</td>
                        <td>{transformHypenedString(article.assigning_section)} - {transformHypenedString(article.story_type)}</td>
                        <td>{article.assignees.map(({full_name}) => full_name).join(", ")}</td>
                        <td>{storyAssignmentState[article.state]}</td>
                        <td className={"c-content-tracker--deadline-list-item--deadline " + (new Date(article.deadline) < new Date() ? "late": "")}>{dateformat(article.deadline)}</td>
                        <td className={"c-content-tracker--deadline-list-item--deadline " + (new Date(article.target) < new Date() ? "late": "")}>{dateformat(article.target)}</td>
                    </tr>
                )}
                </tbody>
            </table>
        </div>
        <div class="c-content-tracker--viewed">
            {viewedArticle.id ?
            <div className="c-content-tracker--viewed-article">
                <div className="c-content-tracker--viewed-assignment">
                    <h3>{viewedArticle.subject} <a href={"/admin/snippets/content_tracker/storyassignment/edit/" + viewedArticle.id} target="_blank" className="button button--icon text-replace white"><svg class="icon icon-edit icon" aria-hidden="true"><use href="#icon-edit"></use></svg>edit</a></h3>
                    <dl>
                        <dt>{transformHypenedString(viewedArticle.assigning_section)} - {transformHypenedString(viewedArticle.story_type)}</dt>
                        <dd>{viewedArticle.summary}</dd>
                        {viewedArticle.assignees.length > 0 &&
                        <>
                            <dt>Assignee{viewedArticle.assignees.length > 1 && <>(s)</>}</dt>
                            <dd dangerouslySetInnerHTML={{__html: viewedArticle.assignees.map(({full_name, slug}) => "<a href='/authors/" + slug + "/'>" + full_name + "</a>").join(", ")}}></dd>
                        </>
                        }
                        <dt>Draft</dt>
                        <dd><a href={viewedArticle.article_file_folder}>File folder</a>, <a href={viewedArticle.manuscript}>Manuscript</a>{viewedArticle.article_page && <>, <a href={"/admin/pages/" + viewedArticle.article_page.id + "/edit/"}>CMS edit page</a>{viewedArticle.article_page.live && <>, <a href={viewedArticle.article_page.url}>Webpage</a></>}</>}</dd>
                    </dl>
                    <div className="o-content-tracker--dates-data">
                        <div>
                            <dt>Created:</dt> 
                            <dd>{dateformat(viewedArticle.created)}</dd>
                        </div>
                        <div>
                            <dt>Deadline:</dt>
                            <dd>{dateformat(viewedArticle.deadline)}</dd>
                        </div>
                        <div>
                            <dt>Target:</dt>
                            <dd>{dateformat(viewedArticle.target)}</dd>
                        </div>
                        {viewedArticle.article_page &&
                        <div>
                            <dt>Published:</dt>
                            <dd>{dateformat(viewedArticle.article_page.datetime)}</dd>
                        </div>
                        }
                    </div>
                    <div id="viewed-assignment-progress-bar" class="progress active">
                        <div class="bar" style={{"width": storyAssignmentStateProgress[viewedArticle.state]}}>{storyAssignmentState[viewedArticle.state]}</div>
                    </div>   


                    {viewedArticle.visual_requests.map(visual_request =>
                        <ContentTrackerVisualRequest visual_request={visual_request} />
                    )}
                </div>
            </div>
            :
            <p className="c-content-tracker--viewer-tip">Click on an assignment to view its information!</p>
            }
        </div>
    </div>

    <div className="c-content-tracker--below">

        <div className="c-content-tracker--menu">
            <div>
                <button class="button" type="button" onClick={() => {setTimeCursor(timeCursor - 1)}}>
                    <svg class="icon icon-arrow-left w-panel__icon" aria-hidden="true"><use href="#icon-arrow-left"></use></svg>
                </button>
                <button class="button" type="button" onClick={() => {setTimeCursor(timeCursor + 1)}}>
                    <svg class="icon icon-arrow-right w-panel__icon" aria-hidden="true"><use href="#icon-arrow-right"></use></svg>
                </button>
            </div>
            <div className="c-content-tracker--menu--add-assignment">
                <div class="actionbutton">           
                    <a href="/admin/snippets/content_tracker/visualassignment/add/" target="_blank" className="button bicolor button--icon"><span class="icon-wrapper"><svg class="icon icon-plus icon" aria-hidden="true"><use href="#icon-plus"></use></svg></span>Add visual assignment</a>
                </div>
                <div class="actionbutton">           
                    <a href="/admin/snippets/content_tracker/storyassignment/add/" target="_blank" className="button bicolor button--icon"><span class="icon-wrapper"><svg class="icon icon-plus icon" aria-hidden="true"><use href="#icon-plus"></use></svg></span>Add story assignment</a>
                </div>
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
                            <td className="c-content-tracker--labels">{transformHypenedString(section)}</td>
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