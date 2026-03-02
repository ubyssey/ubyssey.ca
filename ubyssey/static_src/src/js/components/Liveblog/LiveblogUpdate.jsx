import { timeDeltaString, convertToMilliseconds } from "../../utils/datetimeUtils.js";

export default function LiveblogUpdate({update, isAdmin, presentTime}) {
    function isRecent(presentTime) {
        const cutoff = convertToMilliseconds(0,0,0,1);
        const delta = presentTime.getTime() - new Date(update.publish_date).getTime();
        return delta < cutoff;
    }
    
    function author_images(update) {
        const images = update.authors.filter((author) => author.author_image != null).map((author) => author.author_image);
        return images;
    } 

    return (
        <div key={update.id} className="o-liveblog-update">
            <div className="o-liveblog-update--meta">
                
                {author_images(update).length > 0 && 
                    <div className={"o-liveblog-update--meta--images"}>
                        {author_images(update).map((image) => 
                            <div className="o-liveblog-update--meta--image" dangerouslySetInnerHTML={{__html: image}}></div>
                        )}
                    </div>
                }
                <div>
                    <time className={"o-liveblog-update--meta--time liveblog-updating-time " + (isRecent(presentTime) ? "recent" : "")} datetime={update.publish_date}>{timeDeltaString(presentTime, new Date(update.publish_date), convertToMilliseconds(0,0,0,1))}</time>
                    <div className="o-liveblog-update--meta--author" dangerouslySetInnerHTML={{__html: 
                        update.authors.map((author) => 
                            '<span><a href="' + author.author_link + '">' + author.author_name + '</a> ' + author.author_role + '</span>'
                        ).join(", ")}}>
                    </div>
                </div>
                {isAdmin && <a className="o-liveblog-update--edit-button" href={"/admin/snippets/liveblog/liveblogupdate/edit/" + update.id + "/"}>Edit</a>}
            </div>
            <div className="o-liveblog-update--content" dangerouslySetInnerHTML={{__html: update.html}}></div>
        </div>
    )
}