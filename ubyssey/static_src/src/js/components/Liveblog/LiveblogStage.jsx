import { Fragment } from "react";
import DOMPurify from "dompurify";

const liveblogHtmlOptions = {
    ADD_TAGS: ["iframe"],
    ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "loading", "referrerpolicy"],
};

function LiveblogStageHeader({meta}) {
    const header = meta.page.header || {};
    const layout = header.layout || "big-centered";
    const title = DOMPurify.sanitize(header.title || meta.page.title || "", { ALLOWED_TAGS: ["em", "strong", "i", "b"], ALLOWED_ATTR: [] });
    const video = /^[A-Za-z0-9_-]{11}$/.test(header.video_id || "") ? `https://www.youtube-nocookie.com/embed/${header.video_id}` : null;
    const updated = meta.updatedTime && new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Vancouver", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
    }).format(new Date(meta.updatedTime));

    return <section className={`ar-hero ar-hero--${layout} liveblog-hero`}>
        <div className="ar-hero__copy">
            <p className="ar-kicker">{header.section || "News"}{header.category && ` / ${header.category}`}</p>
            <h1 dangerouslySetInnerHTML={{ __html: title }} />
            {header.subtitle ? <p className="ar-deck">{header.subtitle}</p> : header.above_cut_lede ?
                <div className="ar-deck" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(header.above_cut_lede) }} /> :
                meta.page.lede && <p className="ar-deck">{meta.page.lede}</p>}
            <div className="liveblog-hero__status">
                {meta.live && <span className="live-signal">LIVE</span>}
                {updated && <span className="c-article__published-at">Last updated <time className="liveblog_updated_at" dateTime={meta.updatedTime}>{updated}</time></span>}
            </div>
        </div>
        {(header.image_url || video) && <figure className="ar-hero__media">
            {video ? <iframe src={video} title={`Video for ${meta.page.title}`} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /> :
                <img src={header.image_url} alt={header.image_alt || ""} />}
            {(header.caption || header.credit) && <figcaption>
                {header.caption && <span dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(header.caption) }} />}
                {header.credit && <span className="credit">{header.credit}</span>}
            </figcaption>}
        </figure>}
    </section>;
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

function LiveblogStageItemList({list, meta, bylineHtml}) {
    return (
        <>
            {list.map((item, index) => <Fragment key={`${item.type}-${index}`}>
                <LiveblogStageItem type={item.type} value={item.value} meta={meta}/>
                {item.type === "header" && bylineHtml && <div className="liveblog-main-byline" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(bylineHtml) }} />}
            </Fragment>)}
        </>
    )
}

export default function LiveblogStage({stage, meta, bylineHtml}) {
    return (
        <div className={"c-liveblog--stage c-liveblog-redesign__stage "+ (meta.page.layout=="default" ? "c-liveblog--stage--header" : "")}>
            <LiveblogStageItemList list={stage} meta={meta} bylineHtml={bylineHtml} />
        </div>
    )
}
