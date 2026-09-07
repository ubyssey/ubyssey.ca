import LiveblogUpdate from "./LiveblogUpdate.jsx";

function UpdateNotification({meta, caughtUp, updateOrder, position, scrollToRecent}) {

    function positionOrder(position) {
        return {"top": -1, "bottom": 1}[position];
    }

    function showUpdateNotification(caughtUp, updateOrder, position) {
        return !caughtUp && updateOrder == positionOrder(position);
    }

    function loaderText(meta) {
        if (meta.isAdminView) {
            return;
        }

        if (meta.page.layout == "split_view") {
            return (<span>LIVE</span>);
        }
    }

    if (meta.live) {
        return (
            <>
            <div className={"c-liveblog--update-notification " + position + " " + (showUpdateNotification(caughtUp, updateOrder, position) ? "show" : "")}>
                <button className="c-liveblog--update-notification--button" onClick={() => scrollToRecent(updateOrder)}>New update</button>
            </div>

            {(updateOrder == positionOrder(position) && meta.live) &&
            <div className="c-liveblog--loader-container">
                {loaderText(meta)}<div className="linear-dots-loader"></div>
            </div>}
            </>
        )
    }

}

export default function LiveBlogFeed({meta, updates, updateOrder, presentTime, caughtUp, scrollToRecent, isAdmin, toggleUpdateOrder, viewMode = "updates", toggleViewMode, isSorting}) {

    return (
    <div className="c-liveblog">

        {!meta.isAdminView && <div className="c-liveblog__heading">
            <div className="c-liveblog__controls">
                <button className="c-liveblog__timeline-toggle" type="button" onClick={toggleViewMode} aria-pressed={viewMode === "timeline"}>
                    {viewMode === "timeline" ? "Updates" : "Timeline"}
                </button>
                <button type="button" onClick={toggleUpdateOrder} aria-label={`Sort updates by ${updateOrder === -1 ? "oldest" : "latest"}`}>
                    {updateOrder === -1 ? "Latest" : "Oldest"}<span aria-hidden="true">{updateOrder === -1 ? "↓" : "↑"}</span>
                </button>
            </div>
        </div>}

        <UpdateNotification meta={meta} caughtUp={caughtUp} updateOrder={updateOrder} position={"top"} scrollToRecent={scrollToRecent} />

        <div id="liveblog-feed" className={(isSorting ? "is-sorting " : "") + (viewMode === "timeline" ? "is-timeline" : "")}>
            {updates.map((update)=> <LiveblogUpdate key={update.id} update={update} presentTime={presentTime} isLive={meta.live} isAdmin={isAdmin} compact={viewMode === "timeline"} />)}
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
