import LiveblogUpdate from "./LiveblogUpdate.jsx";

export default function LiveBlogFeed({updates, isLive, updateOrder, defaultUpdateOrder, presentTime, caughtUp, scrollToRecent, isAdmin}) {

    return (
    <div className="c-liveblog">

        <div className={"c-liveblog--update-notification top " + (!caughtUp && defaultUpdateOrder == -1 ? "show" : "")}>
            <button className="c-liveblog--update-notification--button" onClick={scrollToRecent}>New update</button>
        </div>

        <div id="liveblog">
            {updates.map((update)=> <LiveblogUpdate update={update} presentTime={presentTime} isAdmin={isAdmin} />)}
        </div>

        <div id="liveblog-end" className="c-liveblog--end">
            <div className="c-liveblog--end--contents">
                {updateOrder == -1 ? "Beginning of liveblog" : (isLive(updates) ? "You're caught up" : "End of liveblog")}
            </div>
        </div>

        <div className={"c-liveblog--update-notification bottom " + (!caughtUp && defaultUpdateOrder == 1 ? "show" : "")}>
            <button className="c-liveblog--update-notification--button" onClick={scrollToRecent}>New update!</button>
        </div>
    </div>
    )
}