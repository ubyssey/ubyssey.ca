import { useState, useEffect } from "react";

function dateformat(datetime) {
    if (datetime == null) {
        return "";
    }
    const date = new Date(datetime);

    const months = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "Jun.", "Jul.", "Aug.", "Sep.", "Oct.", "Nov.", "Dec."];
    return months[date.getMonth()] + " " + String(date.getDate()) + ", " + String(date.getFullYear());
}

function ResultList({results, name}) {
    return (
    <>
        {results.length > 0 && <h3>{name}</h3>}
        <ul className={name.toLowerCase()}>{results.map((result) => 
            <li>
                {result.datetime && <time datetime={result.datetime}>{dateformat(result.datetime)}</time>}<a href={result.url} dangerouslySetInnerHTML={{__html: result.title}}></a>
            </li>
        )}</ul>
    </>
    )
}
export default function NavSearch() {
    const [pending, setPending] = useState(false);
    const [query, setQuery] = useState("");
    const [queried, setQueried] = useState("");

    const [result, setResult] = useState({"topics":[], "articles":[], "authors":[]});
    let results = {};

    let searchTimeout = setTimeout(() => {}, 0);

    async function search(searchQuery) {
        setPending(true);
        setQuery(searchQuery);  
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(async () => {
            console.log("search");
            if (searchQuery.length > 0) {   

                const current_query = searchQuery;
                console.log("api request to " + current_query);
                const response = await fetch("/search/?q=" + current_query);
                console.log(response);
                
                if (document.getElementById("nav-search-input").value == current_query) {
                    const result = await response.json();
                    setResult(result);
                    console.log(result);
                    setPending(false);
                    setQueried(current_query);

                    results[query] = result;
                } else {
                    console.log("outdated: " + current_query);
                }
            }

        }, 100);
    }

    return (
    <>
        <input id="nav-search-input" type="text" onChange={e => search(e.target.value)} placeholder="Search"></input>
        <div class="c-nav-search--results">
        {!pending ?
        (<>
        {queried.length > 0 && <div class="c-nav-search--status">Results for <a href={"/archive/?q=" + queried}>"<i>{queried}</i>"</a></div>}
        <ResultList results={result["topics"]} name={"Topics"} />
        <ResultList results={result["articles"]} name={"Articles"} />
        <ResultList results={result["authors"]} name={"Authors"} />
        </>)
        : 
        (<>{queried.length > 0 && <div class="c-nav-search--status">Pending results for <a href={"/archive/?q=" + query}>"<i>{query}</i>"</a></div>}</>)
        }
        </div>

    </>
    );
}
