import { useState } from "react";
import { timeDeltaString, convertToMilliseconds } from "../../utils/datetimeUtils.js";
import DOMPurify from "dompurify";

function textFromMarkup(markup) {
    return markup.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

function timelineContent(markup) {
    const heading = markup.match(/<h[2-3][^>]*>([\s\S]*?)<\/h[2-3]>/i);
    const paragraph = markup.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    const title = heading ? textFromMarkup(heading[1]) : "Update";
    const excerpt = textFromMarkup(paragraph ? paragraph[1] : markup);
    return { title, excerpt: excerpt.length > 148 ? `${excerpt.slice(0, 145).trimEnd()}…` : excerpt };
}

export default function LiveblogUpdate({update, isAdmin, presentTime, isLive, compact = false}) {
    const [expanded, setExpanded] = useState(false);
    function isRecent(presentTime) {
        const cutoff = convertToMilliseconds(0,0,0,1);
        const delta = presentTime.getTime() - new Date(update.publish_date).getTime();
        return delta < cutoff;
    }
    
    function author_images(update) {
        const images = update.authors.filter((author) => author.author_image != null).map((author) => author.author_image);
        return images;
    } 

    function updateDate() {
        const published = new Date(update.publish_date);
        const elapsed = presentTime.getTime() - published.getTime();
        const options = !isLive || elapsed >= convertToMilliseconds(0, 0, 1, 0)
            ? { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }
            : { hour: "numeric", minute: "2-digit" };
        return new Intl.DateTimeFormat("en-CA", options).format(published);
    }

    async function copyUpdateLink(event) {
        const button = event.currentTarget;
        const url = new URL(window.location.href);
        url.hash = `update-${update.id}`;
        try {
            await navigator.clipboard.writeText(url.toString());
        } catch (_error) {
            const input = document.createElement("textarea");
            input.value = url.toString();
            input.style.position = "fixed";
            input.style.opacity = "0";
            document.body.appendChild(input);
            input.select();
            document.execCommand("copy");
            input.remove();
        }
        button.classList.add("is-copied");
        button.setAttribute("aria-label", "Link copied");
        window.setTimeout(() => {
            button.classList.remove("is-copied");
            button.setAttribute("aria-label", "Copy link to this update");
        }, 1600);
    }

    return (
        <section id={`update-${update.id}`} className={`o-liveblog-update${compact ? " o-liveblog-update--compact" : ""}${expanded ? " is-expanded" : ""}`}>
            <button className="o-liveblog-update__copy" type="button" onClick={copyUpdateLink} aria-label="Copy link to this update" title="Copy link to this update">
                <ion-icon name="link-outline" aria-hidden="true"></ion-icon>
                <span>Copied</span>
            </button>
            <div className="o-liveblog-update--meta">
                
                {author_images(update).length > 0 && 
                    <div className={"o-liveblog-update--meta--images"}>
                        {author_images(update).map((image) => 
                            <div className="o-liveblog-update--meta--image" dangerouslySetInnerHTML={{__html: DOMPurify.sanitize(image || "", liveblogHtmlOptions)}}></div>
                        )}
                    </div>
                }
                <div>
                    <time className={"o-liveblog-update--meta--time liveblog-updating-time " + (isRecent(presentTime) ? "recent" : "")} dateTime={update.publish_date}>{updateDate()}</time>
                    <div className="o-liveblog-update--meta--author" dangerouslySetInnerHTML={{__html: 
                        update.authors.map((author) => 
                            '<span><a class="o-liveblog-update--author-name" href="' + author.author_link + '">' + author.author_name + '</a><span class="o-liveblog-update--author-role"> ' + author.author_role + '</span></span>'
                        ).join(", ")}}>
                    </div>
                </div>
                {isAdmin && <a className="o-liveblog-update--edit-button" href={"/admin/snippets/liveblog/liveblogupdate/edit/" + update.id + "/"}>Edit</a>}
            </div>
            {compact && !expanded ?
                <button className="o-liveblog-update__timeline" type="button" onClick={() => setExpanded(true)} aria-label={`Expand update: ${timelineContent(update.html).title}`}>
                    <strong>{timelineContent(update.html).title}</strong>
                    {timelineContent(update.html).excerpt && <span>{timelineContent(update.html).excerpt}</span>}
                </button>
                : <div className="o-liveblog-update--content" dangerouslySetInnerHTML={{__html: update.html}}></div>
            }
            {compact && expanded && <button className="o-liveblog-update__collapse" type="button" onClick={() => setExpanded(false)}>Collapse update</button>}
        </section>
    )
}
