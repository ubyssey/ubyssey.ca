import { useState, useEffect } from "react";
import LiveblogUpdate from "./LiveblogUpdate.jsx";
import { timeDeltaString } from "../../utils/datetimeUtils.js";

export default function LiveBlogFeed() {
    function getUpdateOrder(){
        if (JSON.parse(document.getElementById('update-order').textContent) == "asc") {
            return 1;
        }
        return -1;
    }

    const updatesAtLoad = JSON.parse(document.getElementById('updates-at-load').textContent);
    const [updates, setUpdates] = useState(updatesAtLoad);
    const [updateOrder, setUpdateOrder] = useState(getUpdateOrder());

    console.log(updates);

    function updateTimes() {
        const times = document.getElementsByClassName("liveblog-updating-time");
        for (const time of times) {
            time.innerHTML = timeDeltaString(time.dateTime);
        }
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
        };

        chatSocket.onclose = function(e) {
            console.error('Chat socket closed unexpectedly');
        };

        //setInterval(updateTimes, 10000);
    }, []);

    function sortUpdates(a, b, order) {
        const val = (new Date(a.publish_date).getTime() - new Date(b.publish_date).getTime()) * order; 
        console.log(val);
        return val;
    }

    return (
    <div class="c-liveblog">
        <div id="liveblog">
            {updates.sort((a,b) => sortUpdates(a,b,updateOrder)).map((update)=> <LiveblogUpdate update={update} />)}
        </div>
        <div class="c-liveblog--end">
            <div class="c-liveblog--end--contents">
                You're caught up
            </div>
        </div>
    </div>
    )
}