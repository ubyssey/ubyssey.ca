import LiveblogUpdate from "./LiveblogUpdate.jsx";

function UpdateNotification({meta, caughtUp, updateOrder, position, scrollToRecent}) {
    let positionOrder = 1;
    if (position == "top") {
        positionOrder = -1;
    }

    function showUpdateNotification(caughtUp, updateOrder, positionOrder) {
        return !caughtUp && updateOrder == positionOrder;
    }

    if (meta.live) {
        return (
            <>
            <div className={"c-liveblog--update-notification " + position + " " + (showUpdateNotification(caughtUp, updateOrder, positionOrder) ? "show" : "")}>
                <button className="c-liveblog--update-notification--button" onClick={() => scrollToRecent(updateOrder)}>New update</button>
            </div>

            {(updateOrder == positionOrder && meta.live) &&
            <div className="c-liveblog--loader-container">
                {meta.page.layout == "split_view" && <span>LIVE</span>}<div className="linear-dots-loader"></div>
            </div>}
            </>
        )
    }

}

export default function LiveBlogFeed({meta, updates, updateOrder, presentTime, caughtUp, scrollToRecent, isAdmin}) {

    return (
    <div className="c-liveblog">

        <UpdateNotification meta={meta} caughtUp={caughtUp} updateOrder={updateOrder} position={"top"} scrollToRecent={scrollToRecent} />

        <div id="liveblog-feed">
            {updates.map((update)=> <LiveblogUpdate update={update} presentTime={presentTime} isAdmin={isAdmin} />)}
        </div>

        <div id="liveblog-end" className="c-liveblog--end">
            <div className="c-liveblog--end--contents">
                {meta.updatedTime == null ? 
                    <>
                        {"The liveblog is about to start"}
                    </>    
                :
                    <>
                        {updateOrder == -1 ? "Beginning of liveblog" : (meta.live ? "You're caught up" : "End of liveblog")}
                    </>
                }
            </div>
        </div>

        <UpdateNotification meta={meta} caughtUp={caughtUp} updateOrder={updateOrder} position={"bottom"} scrollToRecent={scrollToRecent} />
    </div>
    )
}