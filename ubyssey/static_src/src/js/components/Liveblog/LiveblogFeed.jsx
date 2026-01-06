import { useState, useEffect } from "react";
import LiveblogUpdate from "./LiveblogUpdate.jsx";
import { convertToMilliseconds, timeDeltaString } from "../../utils/datetimeUtils.js";

export default function LiveBlogFeed() {
    function getUpdateOrder(){
        if (JSON.parse(document.getElementById('update-order').textContent) == "asc") {
            return 1;
        }
        return -1;
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
            return false;
        }
        const delta = new Date().getTime() - new Date(time).getTime();
        return delta < convertToMilliseconds(0, 30, 0, 0);
    }

    const updatesAtLoad = JSON.parse(document.getElementById('updates-at-load').textContent);
    
    const [updates, setUpdates] = useState(updatesAtLoad);
    const [updateOrder, setUpdateOrder] = useState(getUpdateOrder());
    const [caughtUp, setCaughtUp] = useState(!isLive(updatesAtLoad));

    function updateTimes() {
        const times = document.getElementsByclassNameName("liveblog-updating-time");
        for (const time of times) {
            time.innerHTML = timeDeltaString(time.dateTime);
        }
    }

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
        const roomName = JSON.parse(document.getElementById('room-name').textContent);
        chatSocket = new WebSocket(
            'ws://'
            + window.location.host
            + '/ws/liveblog/'
            + roomName
            + '/'
        );

        chatSocket.onmessage = function(e) {
            const data = JSON.parse(e.data);
            console.log(data.message);
            setUpdates([...updates, JSON.parse(data.message)]);
            console.log(updates);

            setCaughtUp(false);
            if (isAtRecent()) {
                setTimeout(() => setCaughtUp(true), 2000);
            }
        };

        chatSocket.onclose = function(e) {
            console.error('Chat socket closed unexpectedly');
        };

        //setInterval(updateTimes, 10000);

        window.onscroll = (e) => {
            console.log(window.scrollY);
            console.log(updateOrder);
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
        const live = isLive(updates);
        if (document.body.classList.contains("live") && !live) {
            document.body.classList.remove("live");
        }
        if (live) {
            document.body.classList.add("live");
        }

        const updatedTime = timeUpdatedAt(updates);
        for (let liveblog_updated_at of document.getElementsByClassName("liveblog_updated_at")) {
            liveblog_updated_at.dateTime = updatedTime;
            liveblog_updated_at.innerHTML = timeDeltaString(updatedTime, convertToMilliseconds(0,0,0,1));
        }

    }, [updates]);

    return (
    <div className="c-liveblog">

        <div className={"c-liveblog--update-notification top " + (!caughtUp && updateOrder == -1 ? "show" : "")}>
            <button className="c-liveblog--update-notification--button" onClick={scrollToRecent}>New update</button>
        </div>

        <div id="liveblog">
            {updates.sort((a,b) => sortUpdates(a,b,updateOrder)).map((update)=> <LiveblogUpdate update={update} />)}
        </div>

        <div id="liveblog-end" className="c-liveblog--end">
            <div className="c-liveblog--end--contents">
                {updateOrder == -1 ? "Beginning of liveblog" : (isLive(updates) ? "You're caught up" : "End of liveblog")}
            </div>
        </div>

        <div className={"c-liveblog--update-notification bottom " + (!caughtUp && updateOrder == 1 ? "show" : "")}>
            <button className="c-liveblog--update-notification--button" onClick={scrollToRecent}>New update!</button>
        </div>
    </div>
    )
}