import { useState, useEffect } from "react";
import LiveblogStage from "./LiveblogStage.jsx";
import LiveBlogFeed from "./LiveblogFeed.jsx";
import { convertToMilliseconds, timeDeltaString } from "../../utils/datetimeUtils.js";

export default function LiveBlog() {
    function getUpdateOrder(){
        if (JSON.parse(document.getElementById('update-order').textContent) == "asc") {
            return 1;
        }
        return -1;
    }

    const defaultUpdateOrder = getUpdateOrder();

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
            return false;
        }
        const delta = new Date().getTime() - new Date(time).getTime();
        return delta < convertToMilliseconds(0, 30, 0, 0);
    }

    function pageMetaAtLoad() {
        return JSON.parse(document.getElementById('page_meta-at-load').textContent);
    };
    function stageAtLoad() {
        return JSON.parse(document.getElementById('stage-at-load').textContent);
    };
    function updatesAtLoad() {
        return JSON.parse(document.getElementById('updates-at-load').textContent);
    };
    function isAdminAtLoad() {
        return JSON.parse(document.getElementById('is-admin').textContent);
    };

    const [pageMeta, setPageMeta] = useState(() => pageMetaAtLoad());
    const [stage, setStage] = useState(() => stageAtLoad());
    const [updates, setUpdates] = useState(() => updatesAtLoad());
    const [live, setLive] = useState(() => isLive(updates));
    const [caughtUp, setCaughtUp] = useState(() => true);
    const [updatedTime, setUpdatedTime] = useState(() => timeUpdatedAt(updates));
    const [updateOrder, setUpdateOrder] = useState(() => getUpdateOrder());
    const [isAdmin, setIsAdmin] = useState(() => isAdminAtLoad());
    const [presentTime, setPresentTime] = useState(new Date());
    const [connectionCount, setConnectionCount] = useState(1);

    function getLiveblogRecentScrollHeight() {
        const liveblogElem = document.getElementById('liveblog');
        if (updateOrder==-1) {
            return liveblogElem.offsetTop;    
        }

        return liveblogElem.offsetTop + liveblogElem.offsetHeight - screen.height;
    }

    function scrollToRecent() {
        if (updateOrder == -1) {
            window.scrollTo(0, getLiveblogRecentScrollHeight() - screen.height/2);
        } else {
            window.scrollTo(0, getLiveblogRecentScrollHeight() + screen.height/2);
        }

        setTimeout(() => setCaughtUp(true), 1000);
    }

    function isAtRecent() {
        if (updateOrder == -1) {
            if (window.scrollY < getLiveblogRecentScrollHeight() || window.scrollY <= 0) {
                return true;
            }
        } else if (window.scrollY > getLiveblogRecentScrollHeight()) {
            return true;
        }
        return false;
    }

    let chatSocket = null;

    useEffect(() => {
        setCaughtUp(!isLive(updates))
        
        setInterval(() => setPresentTime(new Date()), 1000);
        
        window.onscroll = (e) => {
            if (updateOrder == -1) {
                if (window.scrollY < getLiveblogRecentScrollHeight() || window.scrollY <= 0) {
                    setCaughtUp(true);
                }
            } else if (window.scrollY > getLiveblogRecentScrollHeight()) {
                setCaughtUp(true);
            }
        };

        if (!caughtUp && isAtRecent()) {
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
                if (isAtRecent()) {
                    setTimeout(() => setCaughtUp(true), 2000);
                }
            } else if (data.delete) {
                setUpdates(prev => prev.filter((update) => update.id != data.delete).sort((a,b) => sortUpdates(a,b,updateOrder)));
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

        if (live) {
            setUpdateOrder(-1);
        } else {
            setUpdateOrder(defaultUpdateOrder);
        }

    }, [updates]);

    function liveStageMeta() {
        return {
            'page': pageMeta,
            'updates': {
                'live': live,
                'updatedTime': updatedTime
            }
        }
    }

    return (
        <>
            <LiveblogStage stage={stage} meta={liveStageMeta()} />
            <LiveBlogFeed updates={updates} isLive={isLive} updateOrder={updateOrder} defaultUpdateOrder={defaultUpdateOrder} presentTime={presentTime} caughtUp={caughtUp} scrollToRecent={scrollToRecent} isAdmin={isAdmin} />
        </>
    )
}