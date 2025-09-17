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
    return (
        <li key={article.id} className={(article.live ? "live " : "") + (article.to_be_published && "to-publish ")}>
            <span class="status">{article.live ? "Live " + daysSince(article.datetime) : "Ready " + daysSince(article.ready_at)}</span> <h3><a href={"/admin/pages/" + String(article["id"]) + "/edit/"} title={article["title"]}>{article["title"]}</a></h3> <span class="timeliness">Timely: {humanizeTimeliness(article["timeliness"])}</span>
        </li>
    )
}

export default function PublishingSchedule() {
    const [currentlyCurated, setCurrentlyCurated] = useState([]);
    const [toBeCurated, setToBeCurated] = useState([]);
    const [ready, setReady] = useState([]);
    const [articles, setArticles] = useState({});

    // Select the node that will be observed for mutations
    const targetNode = document.getElementById("panel-child-content-curated_stream-section");

    // Options for the observer (which mutations to observe)
    const config = { attributes: true, childList: true, subtree: true };

    let readDraftCuratedTimeout = null;

    // Callback function to execute when mutations are observed
    const callback = (mutationList, observer) => {
        console.log("mutation");
        if (readDraftCuratedTimeout) {
            clearTimeout(readDraftCuratedTimeout);
        }
        readDraftCuratedTimeout = setTimeout(readDraftCurated, 1000);
    };

    // Create an observer instance linked to the callback function
    const observer = new MutationObserver(callback);

    // Start observing the target node for configured mutations
    observer.observe(targetNode, config);

    function isVisible(elem) {
        return !!(elem.offsetWidth || elem.offsetHeight || elem.getClientRects().length);
    }

    function readDraftCurated() {
        console.log("reading curated");
        const curatedStreamCount = parseInt(document.getElementsByName("curated_stream-count")[0].value);

        let toBeCuratedArticlesIDs = [];
        // let inputElements = [];
        for (let i=0; i<curatedStreamCount; i++) {
            let itemNum = 0;

            while (true) {
                const articleInputId = "curated_stream-" + String(i) + "-value-items-" + String(itemNum) + "-value-article";
                itemNum = itemNum + 1;
                const articleElementInput = document.getElementById(articleInputId);

                if (!articleElementInput) {
                    break;
                }

                if (!isVisible(articleElementInput.parentElement)) {
                    console.log("not visible");
                    console.log(articleElementInput.parentElement);
                    continue;
                }

                const articleId = articleElementInput.value;

                if (articleId != "") {
                    if (!toBeCuratedArticlesIDs.includes(articleId)) {
                        // inputElements.push(articleElementInput);
                        toBeCuratedArticlesIDs.push(parseInt(articleId));
                    }
                }
            }
        }
  
        // const getOrder = (e) => parseInt(document.getElementsByName(e.id.replace("value-article", "order"))[0].value);

        console.log(toBeCurated);
        console.log(toBeCuratedArticlesIDs);

        if (!compareFunc(toBeCurated, toBeCuratedArticlesIDs)) {

            setToBeCurated(toBeCuratedArticlesIDs);
            console.log(articles);
            for (let toBeCuratedArticleID of toBeCuratedArticlesIDs) {
                if (!(toBeCuratedArticleID in articles)) {
                    const apiUrl = "/admin/articlepage_drafts_api/" + String(toBeCuratedArticleID) + "/";
                    console.log(apiUrl);
                    fetch(apiUrl).then((response) => response.json().then((json) => {
                        let current = {};
                        console.log("setting");
                        console.log(toBeCuratedArticleID);
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
                    console.log("adding");
                    console.log(articles[toBeCuratedArticleID]);
                    setArticles(prevArticles => ({...prevArticles, [toBeCuratedArticleID]: {...prevArticles[toBeCuratedArticleID], "to_be_published": true}}));
                }
            }
        }
    }

    function readLiveCurated() {
        const apiUrl = "/admin/homepage_curated_api/";
        console.log(apiUrl);
        fetch(apiUrl).then((response) => response.json().then((json) => {
            setCurrentlyCurated(json["articles"].map((article) => article["id"]));

            for (let article of json["articles"]) {
                let current = {};
                if (article["id"] in articles) {
                    current = articles[article["id"]];
                }
                Object.assign(current, article);
                console.log(current);
                setArticles(prevArticles => ({...prevArticles, [article["id"]]: current}));
            }
            console.log("live");
            console.log(articles);
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
        readLiveCurated();
        readReady();
        readDraftCurated();        
    }, [])

    return (
    <>
    <div class="curated publishingSchedule-flexbox">
        <div class="currently-curated" id="currently-curated">
            <h2>Live</h2>
            <ul>
                {currentlyCurated.map((articleId) => 
                    (articleId in articles ? <PublishingScheduleArticle article={articles[articleId]}/> : "")
                )}
            </ul>
        </div>

        <div class="to-be-curated" id="to-be-curated">
            <h2>Draft</h2>
            <ul>
                {toBeCurated.map((articleId) => 
                    (articleId in articles ? <PublishingScheduleArticle article={articles[articleId]}/> : "")
                )}
            </ul>
        </div>
    </div>

    <div class="ready-publish publishingSchedule-flexbox">
        <div class="ready" id="ready">
            <h2>Ready</h2>
            <ul>
                {ready.map((articleId) => 
                    (articleId in articles ? <PublishingScheduleArticle article={articles[articleId]}/> : "")
                )}
            </ul>
        </div>
    </div>
    </>
    );
}

ReactDOM.render(
    <PublishingSchedule />,
    document.getElementById('publishingSchedule')
);