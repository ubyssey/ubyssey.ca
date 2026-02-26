function LiveblogStageHeader({value}) {
    return (
    <div class="fw-banner c-liveblog-header">
        <div class="headline-container headline-container--timely-style">
        
            <div class="live-signal">LIVE</div>
            <h1 class="o-headline o-headline--article">self.title|safe</h1>
            <div class="c-article__published-at">Updated: <time class="liveblog_updated_at">self.updated_at</time></div>

            <div class="author-string">
                self.get_authors_with_urls|safe
            </div>
        </div>
        <div class="c-liveblog-summary">
            self.lede|safe
        </div>
    </div>  
    )
}


function LiveblogStageItem({type, value}) {
    if (type=="header") {
        return <LiveblogStageHeader value={value} />
    }
    
}

function LiveblogStageItemList({list}) {
    return (
        <>
            {list.map((item) => <LiveblogStageItem type={item.type} value={item.value} />)}
        </>
    )
}

export default function LiveblogStage({stage}) {
    return (
        <div class="c-liveblog--stage">
            <LiveblogStageItemList list={stage} />
        </div>
    )
}