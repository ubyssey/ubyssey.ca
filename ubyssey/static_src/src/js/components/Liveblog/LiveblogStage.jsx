import { convertToMilliseconds, timeDeltaString } from "../../utils/datetimeUtils.js";

function LiveblogStageHeader({value, meta}) {
    function showThrobber(meta) {
        return meta.live && meta.page.layout != "split-view"; 
    }

    return (
        <div class="headline-container headline-container--timely-style">
            {showThrobber(meta) && <div class="live-signal">LIVE</div>}
            <h1 class="o-headline o-headline--article" dangerouslySetInnerHTML={{__html: meta.page.title}}></h1>
            {meta.updatedTime != null && 
                <div class="c-article__published-at">Updated: <time class="liveblog_updated_at" dateTime={meta.updatedTime}>{timeDeltaString(new Date(), new Date(meta.updatedTime), convertToMilliseconds(0,0,0,1))}</time></div>            
            }

            <div class="author-string" dangerouslySetInnerHTML={{__html: meta.page.authors}}></div>
        </div>
    )
}

function LiveblogStageSummary({value}) {
    return (
        <div class="c-liveblog-summary" dangerouslySetInnerHTML={{__html: value.richtext}}></div>
    )
}

function LiveblogRawHTML({value}) {
    return (
        <div class="c-liveblog-stage--rawhtml" dangerouslySetInnerHTML={{__html: value.raw_html}}></div>
    )
}

function LiveblogStageItem({type, value, meta}) {
    if (type=="header") {
        return <LiveblogStageHeader value={value} meta={meta} />
    } else if (type=="summary") {
        return <LiveblogStageSummary value={value} />
    } else if (type="raw_html") {
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
        <div className={"c-liveblog--stage "+ (meta.page.layout=="default" ? "c-liveblog--stage--header" : "")}>
            <LiveblogStageItemList list={stage} meta={meta} />
        </div>
    )
}