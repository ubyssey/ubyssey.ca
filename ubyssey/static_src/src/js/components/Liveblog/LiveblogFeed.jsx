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