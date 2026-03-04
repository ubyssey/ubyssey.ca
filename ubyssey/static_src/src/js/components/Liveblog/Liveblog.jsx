import { useState, useEffect } from "react";
import LiveblogStage from "./LiveblogStage.jsx";
import LiveBlogFeed from "./LiveblogFeed.jsx";
import { convertToMilliseconds, timeDeltaString } from "../../utils/datetimeUtils.js";

function ShareBar() {
    return (
        <>
            <p class="c-share">Share this article 
            <span class="c-share-buttons">
                <a href="#" class="share-link c-share_space" title="Copy Link to Clipboard"><ion-icon name="link" aria-hidden="true"></ion-icon><span id="custom-tooltip">copied!</span></a>
                <a href="#" class="share-mastodon c-share_space" title="Share to Mastodon"><ion-icon name="logo-mastodon" aria-hidden="true"></ion-icon></a> 
                <a href="#" class="share-facebook c-share_space" title="Share to Facebook"><ion-icon name="logo-facebook" aria-hidden="true"></ion-icon></a>
                <a href="#" class="share-bsky c-share_space" title="Share to Bluesky">
                    <svg viewBox="0 0 600 530" version="1.1" xmlns="http://www.w3.org/2000/svg">
                        <path d="m135.72 44.03c66.496 49.921 138.02 151.14 164.28 205.46 26.262-54.316 97.782-155.54 164.28-205.46 47.98-36.021 125.72-63.892 125.72 24.795 0 17.712-10.155 148.79-16.111 170.07-20.703 73.984-96.144 92.854-163.25 81.433 117.3 19.964 147.14 86.092 82.697 152.22-122.39 125.59-175.91-31.511-189.63-71.766-2.514-7.3797-3.6904-10.832-3.7077-7.8964-0.0174-2.9357-1.1937 0.51669-3.7077 7.8964-13.714 40.255-67.233 197.36-189.63 71.766-64.444-66.128-34.605-132.26 82.697-152.22-67.108 11.421-142.55-7.4491-163.25-81.433-5.9562-21.282-16.111-152.36-16.111-170.07 0-88.687 77.742-60.816 125.72-24.795z"/>
                    </svg>
                </a>
                <a href="#" class="share-reddit c-share_space" title="Share to Reddit"><ion-icon name="logo-reddit" aria-hidden="true"></ion-icon></a> 
            </span>
            </p>

            <p class="report">
                <a href="https://docs.google.com/forms/d/e/1FAIpQLSft99fUQ3oZZ4BZiZeIRZmVYY80daqXxjZxLj29or2HmTnmnA/viewform?usp=sharing">Submit a complaint</a>
                <a href="https://forms.gle/RbJjhEpqqt7tz4AF6">Report a correction</a>
            </p>
        </>
    )
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
        const sortedUpdates = consideredUpdates.sort((a, b) => sortUpdates(a, b, -1));
        if (sortedUpdates.length > 0) {
            return sortedUpdates[0].publish_date;
        }
        return null;
    }

    function isLive(consideredUpdates) {
        const time = timeUpdatedAt(consideredUpdates);
        if (time==null) {
            return true;
        }
        const delta = new Date().getTime() - new Date(time).getTime();
        return delta < convertToMilliseconds(0, 30, 0, 0);
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

    const [pageInfo, setPageInfo] = useState(() => pageInfoAtLoad());
    const [updates, setUpdates] = useState(() => updatesAtLoad());
    const [live, setLive] = useState(() => isLive(updates));
    const [caughtUp, setCaughtUp] = useState(true);
    const [updatedTime, setUpdatedTime] = useState(() => timeUpdatedAt(updates));
    const [updateOrder, setUpdateOrder] = useState(() => getUpdateOrder(live));
    const [isAdmin, setIsAdmin] = useState(() => isAdminAtLoad());
    const [presentTime, setPresentTime] = useState(new Date());
    const [connectionCount, setConnectionCount] = useState(1);

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

    useEffect(() => {
        setLive(isLive(updates));

        setUpdatedTime(timeUpdatedAt(updates));

    }, [updates]);

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
        <div id="nav" dangerouslySetInnerHTML={{__html: navHtml()}}></div>
        <main className="article">
            <article className={"c-article c-article--liveblog clearfix c-article--liveblog--" + pageInfo.meta.layout}>
                    <LiveblogStage stage={pageInfo.stage} meta={getMeta()} />
                    <div className="article-content">
                        <LiveBlogFeed meta={getMeta()} updates={updates.sort((a,b) => sortUpdates(a,b,updateOrder))} updateOrder={updateOrder} presentTime={presentTime} caughtUp={caughtUp} scrollToRecent={scrollToRecent} isAdmin={isAdmin} />
                        {pageInfo.meta.layout!="split_view" && <ShareBar />}
                    </div>
                    {pageInfo.meta.layout == "default" && 
                        <div dangerouslySetInnerHTML={{__html: suggestedHtml()}}></div>
                    }
            </article>
        </main>
        </>
    )
}