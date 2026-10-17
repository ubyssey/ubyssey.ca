import { useEffect, useState } from "react";

function Contest({ title, candidates, compact = false }) {
    const leadVotes = Math.max(...candidates.map((candidate) => candidate.votes), 1);
    return (
        <section className="election-results__contest" aria-label={title}>
            <h2>{title}</h2>
            {compact && <p className="election-results__hint">Ten councillors will be elected. Once votes are reported, the current top 10 are highlighted; results are not final until confirmed.</p>}
            <ol className={compact ? "election-results__list election-results__list--compact" : "election-results__list"}>
                {candidates.map((candidate, index) => (
                    <li className={["election-results__candidate", candidate.winner ? "is-winner" : "", compact && index < 10 && candidate.votes > 0 ? "is-leading" : ""].join(" ")} key={`${title}-${candidate.name}`}>
                        {candidate.image && <img className="election-results__image" src={candidate.image} alt="" loading="lazy" />}
                        <div className="election-results__identity">
                            {candidate.profile_url ? <a href={candidate.profile_url} className="election-results__name">{candidate.name}</a> : <span className="election-results__name">{candidate.name}</span>}
                            {candidate.party && <span className="election-results__party">{candidate.party}</span>}
                            {candidate.winner && <strong className="election-results__winner">✓ Elected</strong>}
                        </div>
                        <div className="election-results__numbers">
                            <span>{new Intl.NumberFormat("en-CA").format(candidate.votes)} votes</span>
                            <span>{candidate.percentage}</span>
                            <span className="election-results__bar" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, candidate.votes / leadVotes * 100))}%` }} /></span>
                        </div>
                    </li>
                ))}
            </ol>
        </section>
    );
}

export default function ElectionResults({ url }) {
    const [data, setData] = useState(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let active = true;
        async function refresh() {
            try {
                const response = await fetch(url, { credentials: "same-origin" });
                if (!response.ok) throw new Error("Results request failed");
                const next = await response.json();
                if (active) { setData(next); setFailed(false); }
            } catch (_error) {
                if (active) setFailed(true);
            }
        }
        refresh();
        const timer = window.setInterval(refresh, 60000);
        return () => { active = false; window.clearInterval(timer); };
    }, [url]);

    return (
        <aside className="election-results" aria-label="Vancouver election results">
            <div className="election-results__scroll">
                <h2 className="election-results__title">Vancouver election results</h2>
                {!data?.available ? <p className="election-results__waiting">Results will appear here when the City publishes them.</p> : <>
                    <p className="election-results__meta">
                        {data.polls_closed} of {data.polls_total} polls closed<br />
                        City data updated <time dateTime={data.source_time}>{new Intl.DateTimeFormat("en-CA", { timeZone: "America/Vancouver", dateStyle: "medium", timeStyle: "short" }).format(new Date(data.source_time))} PT</time>
                    </p>
                    <Contest title="Vancouver mayor" candidates={data.mayor} />
                    <Contest title="Vancouver council" candidates={data.council} compact />
                    <p className="election-results__source">Source: City of Vancouver. Candidate status reflects the latest available data.</p>
                </>}
                {failed && <p className="election-results__error" role="status">Live refresh is temporarily unavailable. Last received results remain on display.</p>}
            </div>
        </aside>
    );
}
