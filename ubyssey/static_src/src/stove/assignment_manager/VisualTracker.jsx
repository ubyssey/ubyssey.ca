import { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";

const stateLabels = {
    0: "New",
    1: "Assigned",
    2: "Completed",
    New: "New",
    Assigned: "Assigned",
    Completed: "Completed",
};

const humanize = (value) => String(value || "")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const formatDate = (value) => value
    ? new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value))
    : "—";

function AssignmentCard({ assignment }) {
    const state = stateLabels[assignment.state] || "New";
    const isLate = assignment.deadline && new Date(assignment.deadline) < new Date() && state !== "Completed";
    const story = assignment.story_assignment;

    return (
        <article className={`visual-tracker-card ${isLate ? "is-late" : ""}`}>
            <div className="visual-tracker-card__topline">
                <span className={`visual-tracker-badge visual-tracker-badge--${state.toLowerCase()}`}>{state}</span>
                <span className="visual-tracker-card__type">{humanize(assignment.visual_type)}</span>
            </div>
            <h2>{story?.subject || "Unlinked visual request"}</h2>
            <p className="visual-tracker-card__request">{assignment.request}</p>
            <dl className="visual-tracker-card__details">
                <div>
                    <dt>Deadline</dt>
                    <dd>{formatDate(assignment.deadline)}{isLate && <strong> · Late</strong>}</dd>
                </div>
                <div>
                    <dt>Use</dt>
                    <dd>{humanize(assignment.intended_use)}</dd>
                </div>
            </dl>
            {assignment.assignees?.length > 0 && (
                <p className="visual-tracker-card__assignees">
                    <span>Assigned to </span>
                    {assignment.assignees.map(({ full_name }) => full_name).join(", ")}
                </p>
            )}
            <div className="visual-tracker-card__actions">
                <a href={`/admin/snippets/content_tracker/visualassignment/${assignment.id}/`} target="_blank" rel="noreferrer">
                    Open request
                </a>
                {story?.article_page && (
                    <a href={`/admin/pages/${story.article_page.id}/edit/`} target="_blank" rel="noreferrer">
                        Open story
                    </a>
                )}
            </div>
        </article>
    );
}

function VisualTracker() {
    const [assignments, setAssignments] = useState([]);
    const [status, setStatus] = useState("all");
    const [type, setType] = useState("all");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        fetch("/admin/visual_assignment_api/?active=true&orderby=deadline", {
            credentials: "same-origin",
            headers: { Accept: "application/json" },
        })
            .then((response) => {
                if (!response.ok) throw new Error(`Request failed (${response.status})`);
                return response.json();
            })
            .then(setAssignments)
            .catch(() => setError("Visual requests could not be loaded. Please try again."))
            .finally(() => setLoading(false));
    }, []);

    const types = useMemo(() => [...new Set(assignments.map(({ visual_type }) => visual_type))].sort(), [assignments]);
    const filteredAssignments = assignments.filter((assignment) =>
        (status === "all" || String(assignment.state) === status || stateLabels[assignment.state] === status) &&
        (type === "all" || assignment.visual_type === type)
    );

    return (
        <main className="visual-tracker">
            <header className="visual-tracker__header">
                <div>
                    <p className="visual-tracker__eyebrow">Content tracker</p>
                    <h1>Visual requests</h1>
                    <p>Keep photography, illustration, video, and web design moving alongside each story.</p>
                </div>
                <a className="button button-primary" href="/stove/visuals/new">
                    Add visual request
                </a>
            </header>
            <div className="visual-tracker__filters" aria-label="Filter visual requests">
                <label>Status
                    <select value={status} onChange={(event) => setStatus(event.target.value)}>
                        <option value="all">All active</option>
                        <option value="0">New</option>
                        <option value="1">Assigned</option>
                    </select>
                </label>
                <label>Visual type
                    <select value={type} onChange={(event) => setType(event.target.value)}>
                        <option value="all">All types</option>
                        {types.map((item) => <option key={item} value={item}>{humanize(item)}</option>)}
                    </select>
                </label>
                <span className="visual-tracker__count">{filteredAssignments.length} request{filteredAssignments.length === 1 ? "" : "s"}</span>
            </div>
            {loading && <p className="visual-tracker__message">Loading visual requests…</p>}
            {!loading && error && <p className="visual-tracker__message visual-tracker__message--error">{error}</p>}
            {!loading && !error && filteredAssignments.length === 0 && (
                <p className="visual-tracker__message">No visual requests match these filters.</p>
            )}
            {!loading && !error && filteredAssignments.length > 0 && (
                <section className="visual-tracker__grid">
                    {filteredAssignments.map((assignment) => <AssignmentCard key={assignment.id} assignment={assignment} />)}
                </section>
            )}
        </main>
    );
}

const container = document.getElementById("visual-tracker");
if (container) ReactDOM.render(<VisualTracker />, container);
