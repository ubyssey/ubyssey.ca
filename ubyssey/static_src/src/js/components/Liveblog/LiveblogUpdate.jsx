import { timeDeltaString, convertToMilliseconds } from "../../utils/datetimeUtils.js";

export default function LiveblogUpdate({update, isAdmin}) {
    function isRecent() {
        const cutoff = convertToMilliseconds(0,0,0,1);
        const delta = new Date().getTime() - new Date(update.publish_date).getTime();
        return delta < cutoff;
    }
    
    return (
        <div className="o-liveblog-update">
            <div className="o-liveblog-update--meta">
                <div className={"o-liveblog-update--meta--image "} dangerouslySetInnerHTML={{__html: update.author_image}}></div>
                <div>
                    <time className={"o-liveblog-update--meta--time liveblog-updating-time " + (isRecent() ? "recent" : "")} datetime={update.publish_date}>{timeDeltaString(update.publish_date, convertToMilliseconds(0,0,0,1))}</time>
                    <div className="o-liveblog-update--meta--author">
                        <a href={update.author_link}>{update.author_name}</a>
                    </div>
                </div>
                {isAdmin && <a className="o-liveblog-update--edit-button" href={"/admin/snippets/liveblog/liveblogupdate/edit/" + update.id + "/"}>Edit</a>}
            </div>
            <div dangerouslySetInnerHTML={{__html: update.html}}></div>
        </div>
    )
}