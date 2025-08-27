import { useState, useEffect } from "react";

function dateformat(datetime) {
    const date = new Date(datetime);

    const months = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "Jun.", "Jul.", "Aug.", "Sep.", "Oct.", "Nov.", "Dec."];
    return months[date.getMonth()] + " " + String(date.getDate()) + ", " + String(date.getFullYear());
}

function ResultList({results, name}) {
    return (
    <>
        {results.length > 0 && <h3>{name}</h3>}
        <ul>{results.map((result) => 
            <li>
                <time datetime={result.datetime}>{dateformat(result.datetime)}</time><a href={result.url}>{result.title}</a>
            </li>
        )}</ul>
    </>
    )
}
export default function NavSearch() {
    const [query, setQuery] = useState("");
    const [articles, setArticles] = useState([]); 
    const [topics, setTopics] = useState([]); 
    const [pending, setPending] = useState(false);

    function search(searchQuery) {
        if (searchQuery.length > 0) {
            setQuery(searchQuery);
        }
    }

    useEffect(async() => {
        setPending(true);
        const current_query = query;
        const response = await fetch("/search/?q=" + current_query);
        const result = await response.json();
        console.log(current_query);
        console.log(query);
        if (current_query == query) {
            setPending(false);
            setTopics(result["topics"]);
            setArticles(result["articles"]);
        }
    }, [query]);

    return (
    <>
        <input type="text" onChange={e => search(e.target.value)}></input>
        
        {!pending ?
        <>
        <ResultList results={topics} name={"Topics"} />
        <ResultList results={articles} name={"Articles"} />
        </>
        : 
        <div>Pending {query}</div>
        }

    </>
    );
}
