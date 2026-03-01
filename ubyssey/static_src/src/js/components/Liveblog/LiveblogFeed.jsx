import LiveblogUpdate from "./LiveblogUpdate.jsx";

function UpdateNotification({caughtUp, updateOrder, position, scrollToRecent, live, meta}) {
    let positionOrder = 1;
    if (position == "top") {
        positionOrder = -1;
    }


    return (
        <>
        <div className={"c-liveblog--update-notification " + position + " " + (!caughtUp && updateOrder == positionOrder ? "show" : "")}>
            <button className="c-liveblog--update-notification--button" onClick={() => scrollToRecent(updateOrder)}>New update</button>
        </div>

        {(updateOrder == positionOrder && live) &&
        <div className="c-liveblog--loader-container">
            {meta.layout == "split_view" && <span>LIVE</span>}<div className="linear-dots-loader"></div>
        </div>}
        </>
    )

}

export default function LiveBlogFeed({meta, updates, live, updateOrder, presentTime, caughtUp, scrollToRecent, isAdmin}) {

    return (
    <div className="c-liveblog">

        <UpdateNotification caughtUp={caughtUp} updateOrder={updateOrder} position={"top"} scrollToRecent={scrollToRecent} live={live} meta={meta} />

        <div id="liveblog-feed">
            {updates.map((update)=> <LiveblogUpdate update={update} presentTime={presentTime} isAdmin={isAdmin} />)}
        </div>

        <div id="liveblog-end" className="c-liveblog--end">
            <div className="c-liveblog--end--contents">
                {updateOrder == -1 ? "Beginning of liveblog" : (live ? "You're caught up" : "End of liveblog")}
            </div>
        </div>

        <UpdateNotification caughtUp={caughtUp} updateOrder={updateOrder} position={"bottom"} scrollToRecent={scrollToRecent} live={live}  meta={meta} />
    </div>
    )
}