import { useState, useEffect } from "react";
import ReactDOM from 'react-dom';

function daysSince(datetime) {
    if (datetime == null) {
        return "";
    }
    const date = new Date(datetime);

    const delta = new Date().getTime() - date.getTime();
    const days = Math.floor(delta / (1000*60*60*24));
    if (days == 0) {
        const minutes = Math.floor(delta / (1000*60*60));
        return String(minutes) + "h";
    }
    return String(days) + "d";
}

function humanizeTimeliness(timeliness) {
    const labels = ["A day", "A few days", "A week", "Evergreen"];
    return labels[timeliness - 1];
}

const compareFunc = (a, b) =>
    // https://www.geeksforgeeks.org/javascript/how-to-compare-two-arrays-in-javascript/
    a.length === b.length &&
    a.every((element, index) => element === b[index]);

function PublishingScheduleArticle({article}) {

    function dragStart(event) {
        event.dataTransfer.setData("id", String(article.id));
        event.dataTransfer.setData("adminTitle", article.title);
        event.dataTransfer.setData("editUrl", "/admin/page/" + String(article.id) + "/edit/");
    }


    return (
        <li key={article.id} draggable="true" onDragStart={dragStart} className={(article.live ? "live " : "") + (article.to_be_published ? "to-publish ": "") + "draggable"}>
            <span class="status">{article.live ? "Live " + daysSince(article.datetime) : "Ready " + daysSince(article.ready_at)}</span> <h3><a href={"/admin/pages/" + String(article["id"]) + "/edit/"} title={article["title"]}>{article["title"]}</a></h3> <span class="timeliness">Timely: {humanizeTimeliness(article["timeliness"])}</span>
        </li>
    )
}

export default function PublishingSchedule() {
    const [currentlyCurated, setCurrentlyCurated] = useState([]);
    const [toBeCurated, setToBeCurated] = useState([]);
    const [ready, setReady] = useState([]);
    const [articles, setArticles] = useState({});

    let readDraftCallbackTime = null;
    let readDraftCallback = null;

    // Callback function to execute when mutations are observed

    const callback = (mutationList, observer) => {

        if (readDraftCallbackTime == null) {
            readDraftCallback = setTimeout(readDraftCurated, 1000);
            readDraftCallbackTime = (new Date()).getTime();
            return;
        }
        if ((new Date()).getTime() - readDraftCallbackTime > 1000) {
            //console.log("mutation")
            readDraftCallback = setTimeout(readDraftCurated, 1000);
            readDraftCallbackTime = (new Date()).getTime();
        } else {
            //console.log("mutation Within a second")
        }
    };

    function isVisible(elem) {
        return !!(elem.offsetWidth || elem.offsetHeight || elem.getClientRects().length);
    }

    function readDraftCurated() {
        const pageChoosers = document.getElementById('panel-child-content-curated_stream-section').getElementsByClassName('w-field--admin_page_chooser');

        let toBeCuratedArticlesIDs = [];
        for (let chooser of pageChoosers) {
            if (isVisible(chooser)) {

                if (!chooser.ondragenter) {
                    // When the draggable p element enters the droptarget, change the DIVS's border style
                    chooser.addEventListener("dragenter", function(event) {
                        chooser.style.background = "var(--w-color-grey-400)";
                        //if (event.target.classList.contains("chosen") || event.target.classList.contains("unchosen")) {
                        //    event.target.style.background = "var(--w-color-grey-400)";
                        //}
                    });

                    // By default, data/elements cannot be dropped in other elements. To allow a drop, we must prevent the default handling of the element
                    chooser.addEventListener("dragover", function(event) {
                        event.preventDefault();
                        chooser.style.background = "var(--w-color-grey-400)";
                    });

                    // When the draggable p element leaves the droptarget, reset the DIVS's border style
                    chooser.addEventListener("dragleave", function(event) {
                        chooser.style.background = "";
                        //if (event.target.classList.contains("chosen") || event.target.classList.contains("unchosen")) {
                        //    event.target.style.background = "";
                        //}
                    });

                    chooser.addEventListener("drop", function(event) {
                        event.preventDefault();

                        const chooserID = chooser.getElementsByClassName("page-chooser")[0].id.replace("-chooser", "");
                        const chooserObj = new window.PageChooser(chooserID);
                        const state = {
                            "id": event.dataTransfer.getData("id"),
                            "adminTitle": event.dataTransfer.getData("adminTitle"),
                            "editUrl": event.dataTransfer.getData("editUrl"),
                        }
                        chooserObj.setState(state);
                        chooser.style.background = "";
                    });
                }

                const input = chooser.getElementsByTagName("input")[0];
                if (input.value == "" || input.value == null) {
                    continue;
                }
                const articleID = parseInt(input.value);
                if (!toBeCuratedArticlesIDs.includes(articleID))
                toBeCuratedArticlesIDs.push(articleID);
            }
        }
        
        // const getOrder = (e) => parseInt(document.getElementsByName(e.id.replace("value-article", "order"))[0].value);

        if (!compareFunc(toBeCurated, toBeCuratedArticlesIDs)) {

            setToBeCurated(toBeCuratedArticlesIDs);
            for (let toBeCuratedArticleID of toBeCuratedArticlesIDs) {
                if (!(toBeCuratedArticleID in articles)) {
                    const apiUrl = "/admin/articlepage_drafts_api/" + String(toBeCuratedArticleID) + "/";
                    fetch(apiUrl).then((response) => response.json().then((json) => {
                        setArticles(prevArticles => ({...prevArticles, [toBeCuratedArticleID]: {...prevArticles[toBeCuratedArticleID],
                            "id": json['id'],
                            "title": json['title'],
                            "url": json["url"],
                            "datetime": json["datetime"],
                            "live": json["live"],
                            "timeliness": json["timeliness"],
                            "to_be_published": true,
                        }}));
                    }));
                } else {
                    setArticles(prevArticles => ({...prevArticles, [toBeCuratedArticleID]: {...prevArticles[toBeCuratedArticleID], "to_be_published": true}}));
                }
            }
        }
    }

    function readLiveCurated() {
        const apiUrl = "/admin/homepage_curated_api/";
        fetch(apiUrl).then((response) => response.json().then((json) => {
            setCurrentlyCurated(json["articles"].map((article) => article["id"]));

            for (let article of json["articles"]) {
                let current = {};
                if (article["id"] in articles) {
                    current = articles[article["id"]];
                }
                Object.assign(current, article);
                setArticles(prevArticles => ({...prevArticles, [article["id"]]: current}));
            }
        }));
    }

    function readReady() {
        const apiUrl = "/admin/publish_committee_workflow_api/";
        fetch(apiUrl).then((response) => response.json().then((json) => {
            let articleIDs = [];
            for (let workflow of json["workflows"]) {
                let article = workflow["article"];
                article["ready_at"] = workflow["ready_at"];

                let current = {};
                if (article["id"] in articles) {
                    current = articles[article["id"]];
                }
                Object.assign(current, article);
                setArticles(prevArticles => ({...prevArticles, [article["id"]]: current}));

                articleIDs.push(article["id"]);
            }
            setReady(articleIDs);
        }));
    }

    useEffect(() => {
       // Select the node that will be observed for mutations
        const targetNode = document.getElementById("panel-child-content-curated_stream-section");

        // Options for the observer (which mutations to observe)
        const config = { attributes: true, childList: true, subtree: true };

        // Create an observer instance linked to the callback function
        const observer = new MutationObserver(callback);

        // Start observing the target node for configured mutations
        observer.observe(targetNode, config);

        readLiveCurated();
        readReady();
        readDraftCurated();        
    }, []);

    return (
    <>
    <div class="curated publishingSchedule-flexbox">
        <div class="currently-curated" id="currently-curated">
            <h2>Live</h2>
            {currentlyCurated.length > 0 ?
            <ul>
                {currentlyCurated.map((articleId) => 
                    (articleId in articles ? <PublishingScheduleArticle article={articles[articleId]}/> : "")
                )}
            </ul>
            : <p>There are currently no articles live in the curated stream.</p>}
        </div>

        <div class="to-be-curated" id="to-be-curated">
            <h2>Draft</h2>
            {toBeCurated.length > 0 ?
            <ul>
                {toBeCurated.map((articleId) => 
                    (articleId in articles ? <PublishingScheduleArticle article={articles[articleId]}/> : "")
                )}
            </ul>
            : <p>There are currently no articles drafted for the curated stream.</p>}
        </div>
    </div>

    <div class="ready-publish publishingSchedule-flexbox">
        <div class="ready" id="ready">
            <h2>Ready</h2>
            {ready.length > 0 ?
            <ul>
                {ready.map((articleId) => 
                    (articleId in articles ? <PublishingScheduleArticle article={articles[articleId]}/> : "")
                )}
            </ul>
            : <p>There are currently no active drafts submitted to cabinet.</p>}
        </div>
    </div>
    </>
    );
}

ReactDOM.render(
    <PublishingSchedule />,
    document.getElementById('publishingSchedule')
);