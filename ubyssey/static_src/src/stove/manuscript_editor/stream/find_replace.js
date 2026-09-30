// Not sure where to put this, stream is definitely not it

const FIND_HIGHLIGHT = "stove-find-results";
const CURRENT_HIGHLIGHT = "stove-find-current";

// Adjacent text nodes are combined so you can have a word with one bold letter for example
function matchesInView(view, query, matchCase) {
  const needle = matchCase ? query : query.toLocaleLowerCase();
  if (!needle) return [];

  const runs = [];
  view.state.doc.descendants((node, position) => {
    if (!node.isText || !node.text) return;
    const previous = runs[runs.length - 1];
    if (previous && previous.to === position) {
      previous.text += node.text;
      previous.to += node.nodeSize;
      return;
    }
    runs.push({ from: position, to: position + node.nodeSize, text: node.text });
  });

  return runs.flatMap((run) => {
    const haystack = matchCase ? run.text : run.text.toLocaleLowerCase();
    const matches = [];
    let index = haystack.indexOf(needle);
    while (index !== -1) {
      matches.push({ view, from: run.from + index, to: run.from + index + query.length });
      index = haystack.indexOf(needle, index + query.length);
    }
    return matches;
  });
}

// Currently only does Richtext
function searchableViews(state) {
  return state.currentPageTextViews().filter((view) => !view.isDestroyed && view.editable);
}

function allMatches(state, query, matchCase) {
  return searchableViews(state).flatMap((view) => matchesInView(view, query, matchCase));
}

function sameMatch(left, right) {
  return left && right && left.view === right.view && left.from === right.from && left.to === right.to;
}

// https://developer.mozilla.org/en-US/docs/Web/API/Highlight
function renderHighlights(matches, currentMatch) {
  if (!window.CSS?.highlights || typeof window.Highlight !== "function") return;
  const results = [];
  const current = [];
  
  for (const match of matches) {
    const start = match.view.domAtPos(match.from);
    const end = match.view.domAtPos(match.to);
    const range = document.createRange();

    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);
    results.push(range);

    if (sameMatch(match, currentMatch)) current.push(range);
    
    const root = match.view.dom.getRootNode();
    if (root instanceof ShadowRoot && !root.querySelector("[data-find-highlight-style]")) {
      const style = document.createElement("style");
      style.dataset.findHighlightStyle = "";
      style.textContent = `
      ::highlight(${FIND_HIGHLIGHT}) { background: #d3d3d3; color: #1b1b1b; } 
      ::highlight(${CURRENT_HIGHLIGHT}) { background: #acacac; color: #1b1b1b; }`;
      root.appendChild(style);
    }
  }
  window.CSS.highlights.set(FIND_HIGHLIGHT, new window.Highlight(...results));
  if (current.length) window.CSS.highlights.set(CURRENT_HIGHLIGHT, new window.Highlight(...current));
  else window.CSS.highlights.delete(CURRENT_HIGHLIGHT);
}

function clearHighlights() {
  window.CSS?.highlights?.delete(FIND_HIGHLIGHT);
  window.CSS?.highlights?.delete(CURRENT_HIGHLIGHT);
}

function selectedEditorMatch(state) {
  const views = state.currentPageTextViews().filter((view) => !view.isDestroyed);
  const activeView = views.find((view) => view.hasFocus() && !view.state.selection.empty);
  if (activeView) {
    const { from, to } = activeView.state.selection;
    return {
      view: activeView,
      from,
      to,
      text: activeView.state.doc.textBetween(from, to, " "),
    };
  }

  for (const view of views) {
    const selection = view.dom.getRootNode().getSelection?.();
    if (!selection?.rangeCount || !view.dom.contains(selection.anchorNode) || !view.dom.contains(selection.focusNode)) continue;
    
    const text = selection.toString();
    if (!text) continue;
    
    const anchor = view.posAtDOM(selection.anchorNode, selection.anchorOffset);
    const focus = view.posAtDOM(selection.focusNode, selection.focusOffset);
    return { view, from: Math.min(anchor, focus), to: Math.max(anchor, focus), text };
  }
  return null;
}

export function setupFindReplace({ state }) {
  const panel = document.querySelector("[data-find-replace]");
  if (!panel) return;

  const findReplaceWindowState = window.stoveFindReplaceState || (window.stoveFindReplaceState = {
    replaceVisible: false,
    replaceText: "",
  });

  const findInput = panel.querySelector("[data-find-replace-find]");
  const replaceInput = panel.querySelector("[data-find-replace-replace]");
  replaceInput.value = findReplaceWindowState.replaceText;

  const count = panel.querySelector("[data-find-replace-count]");
  const replaceToggle = panel.querySelector("[data-find-replace-toggle]");
  const matchCase = panel.querySelector("[data-find-replace-case]");

  const setReplaceVisible = (visible) => {
    findReplaceWindowState.replaceVisible = visible;
    replaceRow.hidden = !visible;
    replaceToggle.dataset.expanded = String(visible);
    replaceToggle.textContent = visible ? "v" : ">";
  };

  const replaceRow = panel.querySelector("[data-find-replace-replace-row]");
  let activeMatch = null;

  const query = () => findInput.value;
  const matches = () => allMatches(state, query(), matchCase.checked);
  const updateCount = (found = matches()) => {
    const index = found.findIndex((match) => sameMatch(match, activeMatch));
    count.textContent = query() ? (found.length ? `${index + 1} of ${found.length}` : "No results") : "";
  };

  const revealMatch = (match) => {
    window.requestAnimationFrame(() => match.view.dom.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" }));
  };

  const find = (direction = 1) => {
    const found = matches();
    if (!found.length) {
      activeMatch = null;
      renderHighlights([], null);
      updateCount(found);
      return;
    }

    const remembered = found.findIndex((match) => sameMatch(match, activeMatch));
    const index = remembered < 0 ? (direction > 0 ? 0 : found.length - 1) : (remembered + direction + found.length) % found.length;
    activeMatch = found[index];
    
    renderHighlights(found, activeMatch);
    revealMatch(activeMatch);
    findInput.focus({ preventScroll: true });
    updateCount(found);
  };

  const open = (showReplace = findReplaceWindowState.replaceVisible) => {
    panel.hidden = false;
    setReplaceVisible(showReplace);

    const selectedMatch = selectedEditorMatch(state);
    if (selectedMatch) findInput.value = selectedMatch.text;
    const found = matches();

    activeMatch = selectedMatch ? found.find((match) => sameMatch(match, selectedMatch)) || null : null;
    renderHighlights(found, activeMatch);
    updateCount(found);

    findInput.focus();
    findInput.select();
  };

  const close = () => {
    panel.hidden = true;
    activeMatch = null;
    clearHighlights();
  };

  const replaceCurrent = () => {
    const found = matches();
    const current = found.find((match) => sameMatch(match, activeMatch));
    if (!current) return find(1);
    current.view.dispatch(current.view.state.tr.insertText(replaceInput.value, current.from, current.to));
    state.history?.stopCapturing();
    activeMatch = null;
    find(1);
  };

  const replaceAll = () => {
    const found = matches();
    if (!found.length) return;
    state.history?.stopCapturing();
    const byView = new Map();
    found.forEach((match) => byView.set(match.view, [...(byView.get(match.view) || []), match]));
    byView.forEach((viewMatches, view) => {
      viewMatches.reverse().forEach((match) => {
        view.dispatch(view.state.tr.insertText(replaceInput.value, match.from, match.to));
      });
    });
    state.history?.stopCapturing();
    activeMatch = null;
    updateCount();
  };

  replaceToggle.addEventListener("click", () => setReplaceVisible(replaceRow.hidden));
  panel.querySelector("[data-find-replace-close]").addEventListener("click", close);

  const previousButton = panel.querySelector("[data-find-replace-previous]");
  const nextButton = panel.querySelector("[data-find-replace-next]");
  [previousButton, nextButton].forEach((button) => {
    button.addEventListener("mousedown", (event) => event.preventDefault());
  });

  previousButton.addEventListener("click", () => find(-1));
  nextButton.addEventListener("click", () => find(1));
  panel.querySelector("[data-find-replace-replace-current]").addEventListener("click", replaceCurrent);
  panel.querySelector("[data-find-replace-all]").addEventListener("click", replaceAll);
  
  const resetHighlights = () => {
    activeMatch = null;
    renderHighlights(matches(), null);
    updateCount();
  };

  findInput.addEventListener("input", resetHighlights);
  replaceInput.addEventListener("input", () => {
    findReplaceWindowState.replaceText = replaceInput.value;
  });

  matchCase.addEventListener("change", resetHighlights);
  document.addEventListener("keydown", (event) => {
    if (!panel.hidden && event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (!event.defaultPrevented && !panel.hidden && event.key === "Enter" && !event.isComposing && event.target !== replaceInput) {
      event.preventDefault();
      find(event.shiftKey ? -1 : 1);
      return;
    }
    if (event.defaultPrevented || event.altKey || (!event.ctrlKey && !event.metaKey)) return;
    
    const key = event.key.toLowerCase();
    if (key !== "f" && key !== "h") return;
    event.preventDefault();
    open(key === "h" ? true : undefined);
  });
}
