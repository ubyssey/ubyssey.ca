import { useState, useEffect } from "react";
import DOMPurify from "dompurify";
import LiveblogStage from "./LiveblogStage.jsx";
import LiveBlogFeed from "./LiveblogFeed.jsx";
import { convertToMilliseconds, timeDeltaString } from "../../utils/datetimeUtils.js";

const liveblogHtmlOptions = {
    ADD_TAGS: ["iframe"],
    ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "loading", "referrerpolicy"],
};

function ShareBar() {
    const staticPrefix = document.getElementById("liveblog")?.dataset.staticPrefix || "/static/";
    const icon = (name) => `${staticPrefix.replace(/\/$/, "")}/ubyssey/images/article/${name}`;
    return (
        <nav class="ar-share c-liveblog__share" aria-label="Share this article">
            <button type="button" data-share-copy title="Copy link"><img src={icon("share-link.svg")} alt="" /><span class="sr-only">Copy link</span></button>
            <a data-share-email href={"mailto:?subject=" + encodeURIComponent(document.title) + "&body=" + encodeURIComponent(window.location.href)} title="Share by email"><img src={icon("share-email.svg")} alt="" /></a>
            <a data-share-bsky href={"https://bsky.app/intent/compose?text=" + encodeURIComponent(document.title + " " + window.location.href)} target="_blank" rel="noopener" title="Share to Bluesky"><img src={icon("share-bluesky.svg")} alt="" /></a>
            <a data-share-whatsapp href={"https://wa.me/?text=" + encodeURIComponent(document.title + " " + window.location.href)} target="_blank" rel="noopener" title="Share to WhatsApp"><img src={icon("share-whatsapp.svg")} alt="" /></a>
        </nav>
    )
}

function ReportLinks() {
    return <p class="report">
        <a href="https://forms.ubyssey.ca/erasure">Apply for erasure</a>
        <a href="https://forms.ubyssey.ca/tips">Send a tip</a>
        <a href="https://forms.ubyssey.ca/errors">Report an error</a>
    </p>
}

export default function LiveBlog() {
    function getDefaultUpdateOrder(){
        if (JSON.parse(document.getElementById('update-order').textContent) == "asc") {
            return 1;
        }
        return -1;
    }

    const defaultUpdateOrder = getDefaultUpdateOrder();

    function getUpdateOrder(live) {
        if (live) {
            return -1;
        }
        return defaultUpdateOrder;
    }

    function sortUpdates(a, b, order) {
        return (new Date(a.publish_date).getTime() - new Date(b.publish_date).getTime()) * order;
    }

    function timeUpdatedAt(consideredUpdates) {
        const sortedUpdates = [...consideredUpdates].sort((a, b) => sortUpdates(a, b, -1));
        if (sortedUpdates.length > 0) {
            return sortedUpdates[0].publish_date;
        }
        return null;
    }

    function isLive(consideredUpdates, live_policy) {
        if (live_policy.includes("auto")) {
            const time = timeUpdatedAt(consideredUpdates);
            if (time==null) {
                return true;
            }
            const delta = new Date().getTime() - new Date(time).getTime();
            return delta < convertToMilliseconds(0, 30, 0, 0);
        }
        
        return live_policy == "manual-live";
    }

    function pageInfoAtLoad() {
        return JSON.parse(document.getElementById('page-info-at-load').textContent);
    }
    function navHtml() {
        return JSON.parse(document.getElementById('nav-html').textContent);
    };
    function suggestedHtml() {
        return JSON.parse(document.getElementById('suggested-html').textContent);
    };
    function updatesAtLoad() {
        return JSON.parse(document.getElementById('updates-at-load').textContent);
    };
    function isAdminAtLoad() {
        return JSON.parse(document.getElementById('is-admin').textContent);
    };
    function isAdminView() {
        return JSON.parse(document.getElementById('admin-view').textContent);
    };
    function isPreviewMode() {
        const element = document.getElementById('preview-mode');
        return element ? JSON.parse(element.textContent) : false;
    }

    const [pageInfo, setPageInfo] = useState(() => pageInfoAtLoad());
    const [updates, setUpdates] = useState(() => updatesAtLoad());
    const [live, setLive] = useState(() => isLive(updates, pageInfo.meta.live_policy));
    const [caughtUp, setCaughtUp] = useState(true);
    const [updatedTime, setUpdatedTime] = useState(() => timeUpdatedAt(updates));
    const [updateOrder, setUpdateOrder] = useState(() => getUpdateOrder(live));
    const [isAdmin, setIsAdmin] = useState(() => isAdminAtLoad());
    const [presentTime, setPresentTime] = useState(new Date());
    const [connectionCount, setConnectionCount] = useState(1);
    const [isSorting, setIsSorting] = useState(false);
    const [viewMode, setViewMode] = useState("updates");

    function getLiveblogRecentScrollHeight(updateOrder) {
        const liveblogElem = document.getElementById('liveblog-feed');
        if (updateOrder==-1) {
            return liveblogElem.offsetTop;    
        }

        return liveblogElem.offsetTop + liveblogElem.offsetHeight - screen.height;
    }

    function scrollToRecent(updateOrder) {
        if (updateOrder == -1) {
            window.scrollTo(0, getLiveblogRecentScrollHeight(updateOrder) - screen.height/2);
        } else {
            window.scrollTo(0, getLiveblogRecentScrollHeight(updateOrder) + screen.height/2);
        }

        setTimeout(() => setCaughtUp(true), 1000);
    }

    function isAtRecent(updateOrder) {
        if (updateOrder == -1) {
            if (window.scrollY < getLiveblogRecentScrollHeight(updateOrder) || window.scrollY <= 0) {
                return true;
            }
        } else if (window.scrollY > getLiveblogRecentScrollHeight(updateOrder)) {
            return true;
        }
        return false;
    }

    function onScroll(e, updateOrder) {
        if (updateOrder == -1) {
            if (window.scrollY < getLiveblogRecentScrollHeight(updateOrder) || window.scrollY <= 0) {
                setCaughtUp(true);
            }
        } else if (window.scrollY > getLiveblogRecentScrollHeight(updateOrder)) {
            setCaughtUp(true);
        }
    }

    let chatSocket = null;

    useEffect(() => {

        setInterval(() => setPresentTime(new Date()), 1000);
        
        window.onscroll = (e) => onScroll(e, updateOrder);

        if (!caughtUp && isAtRecent(updateOrder)) {
            setTimeout(() => setCaughtUp(true), 1000);
        }
    }, []);

    useEffect(() => {
        if (isPreviewMode()) return;
        const roomName = JSON.parse(document.getElementById('room-name').textContent);
        let wsProtocol = "ws";
        if (window.location.protocol.includes("https")) {
            wsProtocol = "wss";
        }
        chatSocket = new WebSocket(
            wsProtocol + '://'
            + window.location.host
            + '/ws/liveblog/'
            + roomName
            + '/'
        );

        chatSocket.onopen = () => {
            console.log("Web socket connection opened");
        };

        chatSocket.onmessage = (e) => {
            console.log(e.data);
            const data = JSON.parse(e.data);

            if (data.message) {
                const newUpdate = JSON.parse(data.message);
                setUpdates(prev => [...prev.filter((update) => update.id != newUpdate.id), newUpdate].sort((a,b) => sortUpdates(a,b,updateOrder)));

                setCaughtUp(false);
                if (isAtRecent(updateOrder)) {
                    setTimeout(() => setCaughtUp(true), 2000);
                }
            } else if (data.delete) {
                setUpdates(prev => prev.filter((update) => update.id != data.delete).sort((a,b) => sortUpdates(a,b,updateOrder)));
            } else if (data.page_update) {
                setPageInfo(JSON.parse(data.page_update));
            } else {
                console.log(data);
            }
        };

        chatSocket.onclose = function(e) {
            console.error('Web socket closed unexpectedly');
            setTimeout(() => {setConnectionCount(connectionCount + 1);}, 250);
        };        
    }, [connectionCount]);

    function toggleUpdateOrder() {
        setIsSorting(true);
        window.setTimeout(() => {
            setUpdateOrder(current => current * -1);
            window.setTimeout(() => setIsSorting(false), 40);
        }, 150);
    }

    function toggleViewMode() {
        setIsSorting(true);
        window.setTimeout(() => {
            setViewMode(current => current === "updates" ? "timeline" : "updates");
            window.setTimeout(() => setIsSorting(false), 40);
        }, 150);
    }

    useEffect(() => {
        setUpdatedTime(timeUpdatedAt(updates));
    }, [updates]);

    useEffect(() => {
            setLive(isLive(updates, pageInfo.meta.live_policy));
    }, [updates, pageInfo.meta.live_policy]);

    useEffect(() => {
        setUpdateOrder(getUpdateOrder(live));
    }, [live]);

    function getMeta() {
        return {
            'page': pageInfo.meta,
            'live': live,
            'updatedTime': updatedTime,
            'isAdminView': isAdminView(),
            'isAdmin': isAdmin,
        }
    }

    if (isAdminView()) {
        
        return (
            <LiveBlogFeed meta={getMeta()} updates={updates} updateOrder={updateOrder} presentTime={presentTime} caughtUp={caughtUp} scrollToRecent={scrollToRecent} isAdmin={isAdmin} />
        ) 
    }
    
    return (
        <>
        <div id="nav" dangerouslySetInnerHTML={{__html: DOMPurify.sanitize(navHtml() || "", liveblogHtmlOptions)}}></div>
        <main id="main-content" className="article c-liveblog-redesign">
            <article className={"c-article c-article--liveblog clearfix c-article--liveblog--" + pageInfo.meta.layout}>
                    <LiveblogStage stage={pageInfo.stage} meta={getMeta()} />
                    <div className="article-content">
                        {pageInfo.meta.layout!="split_view" && <ShareBar />}
                        <LiveBlogFeed meta={getMeta()} updates={[...updates].sort((a,b) => sortUpdates(a,b,updateOrder))} updateOrder={updateOrder} presentTime={presentTime} caughtUp={caughtUp} scrollToRecent={scrollToRecent} isAdmin={isAdmin} toggleUpdateOrder={toggleUpdateOrder} viewMode={viewMode} toggleViewMode={toggleViewMode} isSorting={isSorting} />
                    </div>
                    <ReportLinks />
                    {pageInfo.meta.layout == "default" && 
                        <div dangerouslySetInnerHTML={{__html: DOMPurify.sanitize(suggestedHtml() || "", liveblogHtmlOptions)}}></div>
                    }
            </article>
        </main>
        </>
    )
}
