import { useState, useEffect } from "react";
import ReactDOM from 'react-dom';

const storyAssignmentState = [
    "None",
    "Assigned",
    "Editing",
    "Ready",
    "Published"
];

const visualAssignmentState = [
    "New",
    "Assigned",
    "Completed",
];

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

function labelDate(dateString) {
    const daysOfWeek = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
    const months = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "Jun.", "Jul.", "Aug.", "Sep.", "Oct.", "Nov.", "Dec."];
    
    const datetime = changeTimezone(dateString, "America/Vancouver");

    return daysOfWeek[datetime.getDay()] + " " + months[datetime.getMonth()] + " " + String(datetime.getDate());    
}

function pad(num, size) {
    num = num.toString();
    while (num.length < size) num = "0" + num;
    return num;
}

function dateNumber(datetime) {
    datetime = changeTimezone(datetime, "America/Vancouver");
    return String(datetime.getFullYear()) + "-" +
        pad(datetime.getMonth() + 1, 2) + "-" +
        pad(datetime.getDate(), 2)        
    ;
}

function VisualAssignmentProgress({visual_request}) {
    return (
        <div className="o-content-tracker--timeline-article--progress-item">
        <>{visual_request.state != 2 ?
            <><svg class="icon icon-radio-empty default" aria-hidden="true"><use href="#icon-radio-empty"></use></svg> Awaiting </>
        :
            <><svg class="icon icon-circle-check default" aria-hidden="true"><use href="#icon-circle-check"></use></svg> Recieved </>           
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
                <svg class={"icon " + (article.state == 4 ? "icon-circle-check" : article.state < 2 ? "icon-radio-empty": "icon-radio-full") + " default"} aria-hidden="true"><use href={(article.state == 4 ? "#icon-circle-check" : article.state < 2 ? "#icon-radio-empty": "#icon-radio-full")}></use></svg> {storyAssignmentState[article.state]}
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

function ContentTrackerTimelineArticle({article, setViewedStoryAssignment}) {
    return (
        <div className={"o-content-tracker--timeline-article " + article.assigning_section} title={article.subject} onClick={() => {setViewedStoryAssignment({...article, "viewed": "story"})}}>
            <div className="o-content-tracker--timeline-article--subject" dangerouslySetInnerHTML={{__html: article.subject}}></div>
            <ContentTrackerArticleProgress article={article} />
        </div>
    );
}

function ContentTrackerVisualRequest({visual_request}) {
    return (
        <div className="o-content-tracker--viewer--visual_request">
            <h3>{transformHypenedString(visual_request.visual_type)} {visual_request.state == 2 ? <>(Completed)</> : <>(Awaiting)</>} <a href={"/admin/snippets/content_tracker/visualassignment/" + visual_request.id} target="_blank" className="button button--icon text-replace white"><svg class="icon icon-edit icon" aria-hidden="true"><use href="#icon-edit"></use></svg>edit</a></h3>
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
                {visual_request.state == 2 &&
                <div>
                    <dt>Completed:</dt>
                    <dd>{dateformat(visual_request.completed)}</dd>
                </div>
                }                
            </div>
        </div>
    );
}

function ContentTrackerActiveStoryAssignments({activeStoryAssignments, setViewedStoryAssignment, filter, setFilter, sections}) {
    return (
        <>
            <div class="c-content-tracker--upper-left--header">
                <h1>Active assignments</h1>
                <div className="w-field__input">
                    <select value={filter} onChange={e => setFilter(e.target.value)}>
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
                        <th>Story</th>
                        <th>Story type</th>
                        <th>Assignee(s)</th>
                        <th>State</th>
                        <th>Deadline</th>
                        <th>Target</th>
                    </tr>
                </thead>
                <tbody>
                {activeStoryAssignments.filter(({assigning_section}) => assigning_section == filter || filter == "all").map(article =>
                    <tr className="c-content-tracker--deadline-list-item" onClick={() => {setViewedStoryAssignment({...article, "viewed": "story"})}}>
                        <td className="c-content-tracker--deadline-list-item--subject" title={article.subject}>{article.subject}</td>
                        <td>{transformHypenedString(article.assigning_section)} - {transformHypenedString(article.story_type)}</td>
                        <td>{article.assignees.map(({full_name}) => full_name).join(", ")}</td>
                        <td><span className="w-status">{storyAssignmentState[article.state]}</span></td>
                        <td className={"c-content-tracker--deadline-list-item--deadline " + (new Date(article.deadline) < new Date() ? "late": "")}>{dateformat(article.deadline)}</td>
                        <td className={"c-content-tracker--deadline-list-item--deadline " + (new Date(article.target) < new Date() ? "late": "")}>{dateformat(article.target)}</td>
                    </tr>
                )}
                </tbody>
            </table>
        </>
    )
}

function ContentTrackerActiveVisualAssignments({activeVisualAssignments, setViewedStoryAssignment, filter, setFilter, visualTypes}) {
    return (
        <>
            <div class="c-content-tracker--upper-left--header">
                <h1>Active assignments</h1>
                <div className="w-field__input">
                    <select value={filter} onChange={e => setFilter(e.target.value)}>
                        <option value="all">All</option>
                        {visualTypes.map((visualType) => 
                            <option value={visualType}>{transformHypenedString(visualType)} ({activeVisualAssignments.filter(({visual_type}) => visual_type == visualType).length})</option>
                        )}
                    </select>
                </div>
            </div>

            <table className="listing">
                <thead>
                    <tr>
                        <th>Story</th>
                        <th>Visual type</th>
                        <th>Assignee(s)</th>
                        <th>State</th>
                        <th>Created</th>
                        <th>Deadline</th>
                    </tr>
                </thead>
                <tbody>
                {activeVisualAssignments.filter(({visual_type}) => visual_type == filter || filter == "all").map(article =>
                    <tr className="c-content-tracker--deadline-list-item" onClick={() => {setViewedStoryAssignment({...article, "viewed": "visual"})}}>
                        <td className="c-content-tracker--deadline-list-item--subject">{article.story_assignment ? article.story_assignment.subject : "[No story attached]"}</td>
                        <td>{article.story_assignment && transformHypenedString(article.story_assignment.assigning_section) + " - "}{transformHypenedString(article.visual_type)} {article.intended_use.toLowerCase()!="unspecified" && "(" + article.intended_use + ")"}</td>
                        <td>{article.assignees.map(({full_name}) => full_name).join(", ")}</td>
                        <td><span className="w-status">{visualAssignmentState[article.state]}</span></td>
                        <td className={"c-content-tracker--deadline-list-item--deadline"}>{dateformat(article.created)}</td>
                        <td className={"c-content-tracker--deadline-list-item--deadline " + (new Date(article.deadline) < new Date() ? "late": "")}>{dateformat(article.deadline)}</td>
                    </tr>
                )}
                </tbody>
            </table>
        </>
    )
}

function ContentTrackerViewStoryAssignment({storyAssignment}) {
    return (
        <div className="c-content-tracker--viewed-article">
                <div className="c-content-tracker--viewed-assignment">
                    <h3>{storyAssignment.subject} <a href={"/admin/snippets/content_tracker/storyassignment/edit/" + storyAssignment.id} target="_blank" className="button button--icon text-replace white"><svg class="icon icon-edit icon" aria-hidden="true"><use href="#icon-edit"></use></svg>edit</a></h3>
                    <dl>
                        <dt>{transformHypenedString(storyAssignment.assigning_section)} - {transformHypenedString(storyAssignment.story_type)}</dt>
                        <dd>{storyAssignment.summary}</dd>
                        {storyAssignment.assignees.length > 0 &&
                        <>
                            <dt>Assignee{storyAssignment.assignees.length > 1 && <>(s)</>}</dt>
                            <dd dangerouslySetInnerHTML={{__html: storyAssignment.assignees.map(({full_name, slug}) => "<a href='/authors/" + slug + "/'>" + full_name + "</a>").join(", ")}}></dd>
                        </>
                        }
                        <dt>Draft</dt>
                        <dd><a href={storyAssignment.article_file_folder}>File folder</a>, <a href={storyAssignment.manuscript}>Manuscript</a>{storyAssignment.article_page && <>, <a href={"/admin/pages/" + storyAssignment.article_page.id + "/edit/"}>CMS edit page</a>{storyAssignment.article_page.live && <>, <a href={storyAssignment.article_page.url}>Webpage</a></>}</>}</dd>
                    </dl>
                    <div className="o-content-tracker--dates-data">
                        <div>
                            <dt>Created:</dt> 
                            <dd>{dateformat(storyAssignment.created)}</dd>
                        </div>
                        <div>
                            <dt>Deadline:</dt>
                            <dd>{dateformat(storyAssignment.deadline)}</dd>
                        </div>
                        <div>
                            <dt>Target:</dt>
                            <dd>{dateformat(storyAssignment.target)}</dd>
                        </div>
                        {storyAssignment.article_page &&
                        <div>
                            <dt>Published:</dt>
                            <dd>{dateformat(storyAssignment.article_page.datetime)}</dd>
                        </div>
                        }
                    </div>
                    <div id="viewed-assignment-progress-bar" class="progress active">
                        <div class="bar" style={{"width": storyAssignmentStateProgress[storyAssignment.state]}}>{storyAssignmentState[storyAssignment.state]}</div>
                    </div>   

                    {storyAssignment.visual_requests && <>
                        {storyAssignment.visual_requests.map(visual_request =>
                            <ContentTrackerVisualRequest visual_request={visual_request} />
                        )}
                    </>}
                    
                </div>
            </div>
    )
}

function ContentTrackerViewVisualAssignment({visualAssignment}) {
    return (
        <div className="c-content-tracker--viewed-article">
                <div className="c-content-tracker--viewed-assignment">
                    <ContentTrackerVisualRequest visual_request={visualAssignment} />
                    {visualAssignment.story_assignment && <ContentTrackerViewStoryAssignment storyAssignment={visualAssignment.story_assignment} />}
                </div>
            </div>
    )
}

function ContentTrackerTimeline({dateRange, sections, moveSection, articlesBySectionByDate, lateStoryAssignments, setViewedStoryAssignment, todayNumber}) {
    return (
        
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
                                <th className={(date == todayNumber? "today": "") + (date < todayNumber? " past": "") + " week-" + String(changeTimezone(date, "America/Vancouver").getDay())}>
                                    {labelDate(date) + (date == todayNumber? " (Today)": "")}
                                </th>
                                {date == todayNumber? 
                                <th className="late">
                                    Late
                                </th>
                                : <></>}
                            </>
                            )}
                        </tr>
                    {sections.map((section, i) =>
                        <tr class="c-content-tracker--sections">
                            <td className="c-content-tracker--labels">
                                {i - 1 >= 0 &&
                                    <button className="section-mover-button" onClick={() => moveSection(section, -1)}>
                                        <svg width="32" height="32" fill="currentColor"><svg id="icon-arrow-up" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M11.75 10.75a.743.743 0 0 1-.54-.21L8 7.327 4.766 10.54a.723.723 0 0 1-1.055 0 .723.723 0 0 1 0-1.055l3.75-3.75a.723.723 0 0 1 1.055 0l3.75 3.75a.723.723 0 0 1 0 1.055.727.727 0 0 1-.516.211Z"></path></svg>
                                        </svg>
                                    </button>                                
                                }
                                {i + 1 < sections.length &&
                                    <button className="section-mover-button" onClick={() => moveSection(section, 1)}>
                                        <svg width="32" height="32" fill="currentColor"><svg id="icon-arrow-down" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M8 11.5a.743.743 0 0 1-.54-.21L3.71 7.54a.723.723 0 0 1 0-1.056.723.723 0 0 1 1.056 0L8 9.695l3.21-3.21a.723.723 0 0 1 1.056 0 .723.723 0 0 1 0 1.054l-3.75 3.75A.727.727 0 0 1 8 11.5Z"></path></svg>
                                        </svg>    
                                    </button>
                                }
                                <span class="section-label">{transformHypenedString(section)}</span>
                            </td>
                            <td className="c-content-tracker--gap past"></td>
                            {dateRange.map(date => 
                            <>
                                <td className={(date == todayNumber? "today": "") + (date < todayNumber? " past": "")+ " week-" + String(changeTimezone(date, "America/Vancouver").getDay())}>
                                    {section in articlesBySectionByDate ?
                                    <>
                                        {date in articlesBySectionByDate[section] && 
                                        <div className="c-content-tracker--timeline-articles-container">
                                            {articlesBySectionByDate[section][date].map((article) =>
                                            <ContentTrackerTimelineArticle article={article} setViewedStoryAssignment={setViewedStoryAssignment} />
                                        )}</div>
                                        }
                                    </>
                                    :
                                    <></> 
                                    }

                                </td>
                                {date == todayNumber? 
                                    <td className="late">
                                        <div className="c-content-tracker--timeline-articles-container">
                                            {lateStoryAssignments.filter(({assigning_section}) => assigning_section==section).map((article) =>
                                            <ContentTrackerTimelineArticle article={article} setViewedStoryAssignment={setViewedStoryAssignment} />
                                        )}</div>
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
    )
}

function ContentTrackerMenu({setTimeCursor, timeCursor}) {
    return (
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
    )
}

function ViewedAssignmentsTabs({viewedAssignments, setViewedAssignments}) {
    return (
        <div className="w-tabs" data-tabs="">
            <div role="tablist" className="w-tabs__list">
                    
                <a id="tab-label-tab-1" href="#tab-tab-1" onClick={() => setViewedAssignments("story")} className="w-tabs__tab " role="tab" aria-selected={viewedAssignments=="story"} aria-controls="tab-tab-1">
                    Story assignments
                </a>

                <a id="tab-label-tab-2" href="#tab-tab-2" onClick={() => setViewedAssignments("visual")} className="w-tabs__tab " role="tab" aria-selected={viewedAssignments=="visual"} tabindex="-1" aria-controls="tab-tab-2">
                    Visual assignments
                </a>

            </div>
        </div>
    )
}

export default function ContentTracker() {
    const [activeStoryAssignments, setActiveStoryAssignments] = useState([]);
    const [activeVisualAssignments, setActiveVisualAssignments] = useState([]);
    const [lateStoryAssignments, setLateStoryAssignments] = useState([]);
    
    const [articles, setArticles] = useState([]);
    const [articlesBySectionByDate, setArticlesBySectionByDate] = useState({});
    const [dateRange, setDateRange] = useState([]);
    const [timeCursor, setTimeCursor] = useState(7);
    const [timeScale, setTimeScale] = useState(8);

    const [sectionFilter, setsectionFilter] = useState("all");
    const [visualFilter, setVisualFilter] = useState("all");

    const [viewedStoryAssignment, setViewedStoryAssignment] = useState({});

    const [viewedAssignments, setViewedAssignments] = useState("story");

    const [sections, setSections] = useState(["news", "culture", "features", "opinion", "humour", "research", "sports"]);
    const visualTypes = ["illustration", "photo", "web-design"];
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

    function getLateStoryAssignments() {
        const apiUrl = "/admin/story_assignment_api/?late=true&orderby=deadline";
        fetch(apiUrl).then((response) => response.json().then((json) => {
            setLateStoryAssignments(json);
        }));        
    }

    function getActiveVisualAssignments() {
        const apiUrl = "/admin/visual_assignment_api/?active=true&orderby=deadline";
        fetch(apiUrl).then((response) => response.json().then((json) => {
            setActiveVisualAssignments(json);
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

    function getSectionOrderFromLocalStorage() {
        console.log("getSectionOrderFromLocalStorage");
        const defaultOrder = ["news", "culture", "features", "opinion", "humour", "research", "sports"];
        let useLocalStorage = false;
        if (localStorage.contentTrackerSectionOrder) {
            let localStorageOrder = localStorage.contentTrackerSectionOrder.split(",");
            
            // Check storage order only includes correct sections
            const correctSections = localStorageOrder.map((s) => defaultOrder.includes(s)).includes(false)==false;
            const sameLength = localStorageOrder.length == defaultOrder.length;
            useLocalStorage = correctSections && sameLength;

            if (useLocalStorage) {
                setSections(localStorageOrder);
            }
        } 

        if (useLocalStorage == false) {
            localStorage.contentTrackerSectionOrder = defaultOrder;
            setSections(defaultOrder);
        }
    }

    function moveSection(section, upDown) {
        let i = sections.indexOf(section);
        let sectionsCopy = sections.slice();

        if (upDown+i >= 0) {
            sectionsCopy.splice(i, 1);
            sectionsCopy.splice(i+upDown, 0, section);            
        } else {
            console.log("error moving section to position: " + String(upDown+i));
        }
        setSections(sectionsCopy);
        localStorage.contentTrackerSectionOrder = sectionsCopy.join(",");
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
        getActiveVisualAssignments();
        getLateStoryAssignments();
        getSectionOrderFromLocalStorage();
    }, []);

    return (
    <>
    <div class="c-content-tracker--upper">
        <div class="c-content-tracker--upper-left">
            <ViewedAssignmentsTabs viewedAssignments={viewedAssignments} setViewedAssignments={setViewedAssignments} />
            {viewedAssignments == "story" ?
                <ContentTrackerActiveStoryAssignments setViewedStoryAssignment={setViewedStoryAssignment} activeStoryAssignments={activeStoryAssignments} filter={sectionFilter} setFilter={setsectionFilter} sections={sections}/>            
            :
                <ContentTrackerActiveVisualAssignments setViewedStoryAssignment={setViewedStoryAssignment} activeVisualAssignments={activeVisualAssignments} filter={visualFilter} setFilter={setVisualFilter} visualTypes={visualTypes} />
            }

        </div>
        <div class="c-content-tracker--viewed">
            {viewedStoryAssignment.viewed ?
            <>
                {viewedStoryAssignment.viewed == "story" ? 
                    <ContentTrackerViewStoryAssignment storyAssignment={viewedStoryAssignment}/>
                :
                    <ContentTrackerViewVisualAssignment visualAssignment={viewedStoryAssignment}/>
                }
            </>
            :
            <p className="c-content-tracker--viewer-tip">Click on an assignment to view its information!</p>
            }
        </div>
    </div>

    <div className="c-content-tracker--below">
        <ContentTrackerMenu setTimeCursor={setTimeCursor} timeCursor={timeCursor}/>
        <ContentTrackerTimeline dateRange={dateRange} sections={sections} moveSection={moveSection} articlesBySectionByDate={articlesBySectionByDate} lateStoryAssignments={lateStoryAssignments} setViewedStoryAssignment={setViewedStoryAssignment} todayNumber={todayNumber}/>
    </div>
    </>
    );
}

ReactDOM.render(
    <ContentTracker />,
    document.getElementById('content-tracker')
);