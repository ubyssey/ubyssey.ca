import { convertToMilliseconds, timeDeltaString } from "../../utils/datetimeUtils.js";

function LiveblogStageHeader({value, meta}) {
    return (
    <div class="fw-banner c-liveblog-header">
        <div class="headline-container headline-container--timely-style">
        
            <div class="live-signal">LIVE</div>
            <h1 class="o-headline o-headline--article" dangerouslySetInnerHTML={{__html: meta.page.title}}></h1>
            <div class="c-article__published-at">Updated: <time class="liveblog_updated_at" dateTime={meta.updates.updatedTime}>{timeDeltaString(new Date(), new Date(meta.updates.updatedTime), convertToMilliseconds(0,0,0,1))}</time></div>

            <div class="author-string" dangerouslySetInnerHTML={{__html: meta.page.authors}}></div>
        </div>
    </div>  
    )
}

function LiveblogStageSummary({value}) {
    return (
        <div class="c-liveblog-summary" dangerouslySetInnerHTML={{__html: value.richtext}}></div>
    )
}

function LiveblogStageItem({type, value, meta}) {
    if (type=="header") {
        return <LiveblogStageHeader value={value} meta={meta} />
    } else if (type=="summary") {
        return <LiveblogStageSummary value={value} />
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
        <div class="c-liveblog--stage">
            <LiveblogStageItemList list={stage} meta={meta} />
        </div>
    )
}