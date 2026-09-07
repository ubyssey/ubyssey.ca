import { convertToMilliseconds, timeDeltaString } from "../../utils/datetimeUtils.js";
import DOMPurify from "dompurify";

const liveblogHtmlOptions = {
    ADD_TAGS: ["iframe"],
    ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "loading", "referrerpolicy"],
};

function LiveblogStageHeader({value, meta}) {
    function showThrobber(meta) {
        return meta.live && meta.page.layout != "split_view"; 
    }

    return (
        <div className="headline-container headline-container--timely-style">
            {showThrobber(meta) && <div className="live-signal">LIVE</div>}
            <h1 className="o-headline o-headline--article">{meta.page.title}</h1>
            {meta.updatedTime != null && 
                <div className="c-article__published-at">Last updated <time className="liveblog_updated_at" dateTime={meta.updatedTime}>{new Intl.DateTimeFormat("en-CA", {month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit"}).format(new Date(meta.updatedTime))}</time></div>
            }

            <div className="author-string">
                {(meta.page.authors || []).map((author, index) =>
                    <span key={`${author.url}-${index}`}>
                        {index > 0 && ", "}
                        {author.url ? <a href={author.url}>{author.name}</a> : author.name}
                    </span>
                )}
            </div>
        </div>
    )
}

function LiveblogStageSummary({value}) {
    return (
        <div className="c-liveblog-summary" dangerouslySetInnerHTML={{__html: DOMPurify.sanitize(value.richtext || "", liveblogHtmlOptions)}}></div>
    )
}

function LiveblogRawHTML({value}) {
    return (
        <div className="c-liveblog-stage--rawhtml" dangerouslySetInnerHTML={{__html: DOMPurify.sanitize(value.raw_html || "", liveblogHtmlOptions)}}></div>
    )
}

function LiveblogStageItem({type, value, meta}) {
    if (type=="header") {
        return <LiveblogStageHeader value={value} meta={meta} />
    } else if (type=="summary") {
        return <LiveblogStageSummary value={value} />
    } else if (type === "raw_html") {
        return <LiveblogRawHTML value={value} />
    }
}

function LiveblogStageItemList({list, meta}) {
    return (
        <>
            {list.map((item) => <LiveblogStageItem type={item.type} value={item.value} meta={meta}/>)}
        </>
    )
}

export default function LiveblogStage({stage, meta}) {
    return (
        <div className={"c-liveblog--stage c-liveblog-redesign__stage "+ (meta.page.layout=="default" ? "c-liveblog--stage--header" : "")}>
            <LiveblogStageItemList list={stage} meta={meta} />
        </div>
    )
}
