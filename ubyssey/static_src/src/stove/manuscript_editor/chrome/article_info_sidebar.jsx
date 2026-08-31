import { createRoot } from "react-dom/client";

export function createArticleInfoSidebar(root, { source = null, getContentDoc = () => null } = {}) {
  if (!root) return null;

  let activeView = null;
  const reactRoot = createRoot(root);

  function update() {
    reactRoot.render(
      <ArticleInfoSidebar
        view={activeView}
        source={source}
        contentDoc={getContentDoc()}
      />,
    );
  }

  update();
  return {
    setView(nextView) {
      activeView = nextView;
      update();
    },
    update,
    destroy() {
      reactRoot.unmount();
    },
  };
}

function ArticleInfoSidebar({ view, source, contentDoc }) {
  const highlightedWords = view && !view.state.selection.empty ? countWords(view.state.doc.textBetween(view.state.selection.from, view.state.selection.to, " ")) : null;
  const wordCount = contentWordCount(contentDoc);
  const status = source?.querySelector("[data-page-status]");
  const published = source?.querySelector("[data-page-published]");
  const saved = source?.querySelector("[data-page-saved]");
  const liveLink = source?.querySelector("[data-page-live-link]");
  const draftButton = source?.querySelector('[data-editor-action="draft"]');
  const publishButton = source?.querySelector('[data-editor-action="publish"]');

  return (
    <div className="pm-editor-toolbar__publish">
      {saved && <span className="pm-editor-toolbar__meta">{saved.textContent.trim()}</span>}
      {status && <span className="pm-editor-toolbar__meta">{status.textContent.trim()}</span>}
      {published && <span className="pm-editor-toolbar__meta">{published.textContent.trim()}</span>}
      <span className="pm-editor-toolbar__meta">
        Words: {highlightedWords === null ? wordCount : `${highlightedWords} of ${wordCount}`}
      </span>
      {liveLink && liveLink.href && (
        <a className="pm-editor-toolbar__link" href={liveLink.href} target="_blank" rel="noopener">
          {liveLink.textContent.trim() || "View Live"}
        </a>
      )}
      {[ ["draft", draftButton], ["publish", publishButton] ].map(([action, sourceButton]) => (
        sourceButton && (
          <button
            key={action}
            type="button"
            className={`pm-editor-toolbar__action pm-editor-toolbar__action--${action}`}
            onClick={() => {
              if (sourceButton.form.requestSubmit) sourceButton.form.requestSubmit(sourceButton);
              else sourceButton.click();
            }}
          >
            {sourceButton.textContent.trim()}
          </button>
        )
      ))}
    </div>
  );
}

function countWords(text) {
  const words = String(text || "").trim();
  return words ? words.split(/\s+/).length : 0;
}

function contentWordCount(doc) {
  let text = "";
  doc?.forEach((block) => {
    if (block.attrs?.blockType === "richtext") text += ` ${block.textContent}`;
  });
  return countWords(text);
}
