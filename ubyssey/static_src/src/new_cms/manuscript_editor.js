//
// Handles Manuscript Editor Specific Functionality
//

import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { Fragment } from "prosemirror-model";

import {
  createEditorToolbar,
  editorPlugins,
  makeButton,
  richTextSchema,
} from "./prosemirror/base";
import {
  createEmptyRichTextBlock,
  createStreamBlockNode,
  createStreamEditor,
  pmDocToStreamValue,
  streamSchema,
} from "./streamfield/prosetail";

const editorInstances = [];
const manuscriptRichTextEditors = [];
let articleBlockControlsState = null;
let articleEditorToolbar = null;
let selectedArticleBlock = null;
let suppressedArticleHoverBlock = null;
let suppressedArticleHoverTimer = null;
const articleInsertBlockTypes = new Map();
let scheduleManuscriptPreview = () => {};

// Utils
function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function readJsonScript(id) {
  return JSON.parse(document.getElementById(id).textContent) || {};
}

function setupArticleShadow() {
  const host = document.querySelector("[data-article-shadow]");
  if (!host) {
    return null;
  }

  const articleStylesheets = Array.from(host.querySelectorAll("[data-article-stylesheet]"));
  const articleStylesheetHrefs = articleStylesheets
    .map((stylesheet) => stylesheet.getAttribute("href"))
    .filter(Boolean);

  for (const stylesheet of articleStylesheets) {
    stylesheet.remove();
  }

  const articleHtml = host.innerHTML;
  host.innerHTML = "";

  const shadowRoot = host.shadowRoot || host.attachShadow({ mode: "open" });
  shadowRoot.innerHTML = "";

  const stylesheets = [
    host.dataset.typekitCss,
    host.dataset.bootstrapCss,
    host.dataset.shadowEditorCss,
    ...articleStylesheetHrefs,
  ].filter(Boolean);

  for (const href of stylesheets) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    shadowRoot.appendChild(link);
  }

  const shadowHtml = document.createElement("html");
  const shadowBody = document.createElement("body");
  const updateShadowTheme = () => {
    shadowHtml.setAttribute("color-css-theme", document.documentElement.getAttribute("color-css-theme") || "light");
  };

  updateShadowTheme();
  new MutationObserver(updateShadowTheme).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["color-css-theme"],
  });

  shadowHtml.appendChild(shadowBody);
  shadowRoot.appendChild(shadowHtml);

  for (const style of document.querySelectorAll("style")) {
    if (style.textContent?.includes("ProseMirror")) {
      shadowRoot.appendChild(style.cloneNode(true));
    }
  }

  const toolbar = document.createElement("div");
  toolbar.className = "pm-manuscript-toolbar";
  shadowBody.appendChild(toolbar);

  const wrapper = document.createElement("main");
  wrapper.className = "article-shadow-preview article";
  wrapper.innerHTML = articleHtml;
  shadowBody.appendChild(wrapper);

  return shadowRoot;
}

document.addEventListener("DOMContentLoaded", () => {
  const manuscriptRoot = setupArticleShadow();
  const blockRegistry = { byStreamField: readJsonScript("block-registry") };
  const editorData = readJsonScript("editor-data");
  const editorErrors = readJsonScript("editor-errors");

  if (JSON.stringify(editorErrors) !== "{}") {
    alert("Failed to save due to errors: " + JSON.stringify(editorErrors));
  }

  const textareas = Array.from(document.querySelectorAll("[data-stream-json]"));
  for (const textarea of textareas) {
    editorInstances.push(createStreamEditor(
      textarea,
      blockRegistry,
      editorData[textarea.dataset.streamField] || [],
      {
        getDocForSave: applyManuscriptRichTextOverrides,
        onDocChanged: () => { scheduleManuscriptPreview(); },
        onTransaction: () => { filterArticleEditorToBlock(selectedArticleBlock); },
      },
    ));
  }

  articleEditorToolbar = createEditorToolbar(manuscriptRoot?.querySelector(".pm-manuscript-toolbar"), {
    publishSource: document.querySelector("[data-article-toolbar-source]"),
  });
  createManuscriptRichTextEditors(manuscriptRoot);
  createArticleBlockControls(manuscriptRoot);
  setupArticleBlockKeyboard(manuscriptRoot);
  setupMetadataResize();
  for (const tab of document.querySelectorAll("[data-metadata-tab]")) {
    tab.addEventListener("click", () => { selectMetadataTab(tab.dataset.metadataTab); });
  }

  const form = document.querySelector("[data-manuscript-form]");
  setupServerPreview(form, manuscriptRoot);

  form.addEventListener("submit", () => {
    for (const instance of editorInstances) {
      instance.writeBackToTextarea();
    }
  });

  window.manuscriptEditors = editorInstances;
  window.manuscriptRichTextEditors = manuscriptRichTextEditors;
  window.manuscriptBlockRegistry = blockRegistry;
});

function setupServerPreview(form, manuscriptRoot) {
  if (!form?.dataset.previewUrl || !manuscriptRoot) return;

  let timer = null;
  let controller = null;
  let previewId = 0;
  let previewRevision = 0;
  let deferredManuscriptPreview = false;

  scheduleManuscriptPreview = ({ deferIfManuscriptFocused = false } = {}) => {
    previewRevision += 1;
    clearTimeout(timer);

    if (deferIfManuscriptFocused && focusedManuscriptRichText(manuscriptRoot)) {
      deferredManuscriptPreview = true;
      return;
    }

    deferredManuscriptPreview = false;
    timer = setTimeout(sendPreview, 500);
  };

  const flushDeferredPreview = () => {
    if (!deferredManuscriptPreview || focusedManuscriptRichText(manuscriptRoot)) return;
    scheduleManuscriptPreview();
  };

  const scheduleFromForm = (event) => {
    if ((event.composedPath?.() || []).some((element) => element?.classList?.contains("pm-manuscript-rich-text"))) return;
    scheduleManuscriptPreview();
  };

  form.addEventListener("input", scheduleFromForm);
  form.addEventListener("change", scheduleFromForm);
  manuscriptRoot.addEventListener("focusout", () => { setTimeout(flushDeferredPreview, 0); });

  async function sendPreview() {
    const streamDocs = new Map();
    for (const instance of editorInstances) {
      streamDocs.set(instance.fieldName, applyManuscriptRichTextOverrides(instance.fieldName, instance.view.state.doc.toJSON()));
    }
    for (const instance of editorInstances) {
      instance.textarea.value = JSON.stringify(pmDocToStreamValue(streamDocs.get(instance.fieldName)), null, 2);
    }

    if (controller) controller.abort();
    controller = new AbortController();
    const currentPreviewId = ++previewId;
    const requestRevision = previewRevision;

    try {
      const response = await fetch(form.dataset.previewUrl, {
        method: "POST",
        body: new FormData(form),
        credentials: "same-origin",
        signal: controller.signal,
      });
      const payload = await response.json();

      if (currentPreviewId !== previewId || requestRevision !== previewRevision) return;

      if (response.ok && payload.html) {
        window.manuscriptPreviewErrors = {};
        const wrapper = manuscriptRoot.querySelector(".article-shadow-preview");
        if (!wrapper) return;

        for (const editor of manuscriptRichTextEditors) {
          editor.view.destroy();
        }
        manuscriptRichTextEditors.length = 0;
        articleEditorToolbar?.setView(null);

        wrapper.innerHTML = payload.html;
        createManuscriptRichTextEditors(manuscriptRoot, streamDocs);
        createArticleBlockControls(manuscriptRoot);

        const articleBlock = selectedArticleBlock && articleBlockFromDescriptor(manuscriptRoot, selectedArticleBlock);
        if (articleBlock) {
          selectedArticleBlock = articleBlockDescriptor(articleBlock) || selectedArticleBlock;
        } else if (selectedArticleBlock && !articleBlockDescriptors().some((item) => sameArticleBlockDescriptor(item, selectedArticleBlock))) {
          selectedArticleBlock = null;
        }

        filterArticleEditorToBlock(selectedArticleBlock);
      } else {
        window.manuscriptPreviewErrors = payload.errors || {};
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        window.manuscriptPreviewErrors = { preview: ["Preview failed."] };
      }
    }
  }
}

function focusedManuscriptRichText(manuscriptRoot) {
  const active = manuscriptRoot?.activeElement;
  return Boolean(active?.closest?.(".pm-manuscript-rich-text, .pm-manuscript-toolbar"));
}

function selectMetadataTab(selected) {
  for (const tab of document.querySelectorAll("[data-metadata-tab]")) {
    tab.setAttribute("aria-selected", String(tab.dataset.metadataTab === selected));
  }
  for (const panel of document.querySelectorAll("[data-metadata-panel]")) {
    panel.hidden = panel.dataset.metadataPanel !== selected;
  }
}

function setupMetadataResize() {
  const editor = document.querySelector("[data-manuscript-editor]");
  const handle = document.querySelector("[data-metadata-resize-handle]");
  const aside = document.querySelector("[data-metadata-editor]");
  if (!editor || !handle || !aside) return;

  const setWidth = (width) => {
    const max = Math.min(1080, window.innerWidth - 180);
    editor.style.setProperty("--metadata-width", `${Math.max(280, Math.min(max, width))}px`);
  };

  setWidth(Number(localStorage.getItem("metadataEditorWidth")) || aside.getBoundingClientRect().width);

  handle.addEventListener("pointerdown", (event) => {
    handle.setPointerCapture(event.pointerId);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (moveEvent) => {
      const width = editor.getBoundingClientRect().right - moveEvent.clientX;
      setWidth(width);
      localStorage.setItem("metadataEditorWidth", Math.round(width));
    };

    const onUp = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
    };

    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  });
}

function createManuscriptRichTextEditors(manuscriptRoot, streamDocs = null) {
  if (!manuscriptRoot) return;

  for (const instance of editorInstances) {
    const articleBlocks = Array.from(manuscriptRoot.querySelectorAll("[data-article-block]"))
      .filter((element) => element.dataset.streamField === instance.fieldName);
    const doc = streamDocs?.get(instance.fieldName) || instance.view.state.doc.toJSON();

    (doc.content || []).forEach((block, blockIndex) => {
      const field = (block.content || []).find((child) => (
        child.type === "editable_field" &&
        child.attrs?.mode === "richtext" &&
        JSON.stringify(child.attrs?.path || []) === "[]"
      ));

      if (block.attrs?.blockType !== "richtext" || !field || (block.content || []).some((child) => child.type === "control_field")) {
        return;
      }

      const blockId = block.attrs?.id;
      const articleBlock = (
        blockId && articleBlocks.find((element) => element.dataset.streamBlockId === String(blockId))
      ) || articleBlocks.find((element) => Number(element.dataset.streamBlockIndex) === blockIndex);

      if (!articleBlock) return;

      let view;
      view = new EditorView({ mount: articleBlock }, {
        state: EditorState.create({
          doc: richTextSchema.nodeFromJSON({
            type: "doc",
            content: field.content?.length ? field.content : [{ type: "paragraph" }],
          }),
          plugins: editorPlugins(richTextSchema),
        }),

        dispatchTransaction(transaction) {
          view.updateState(view.state.apply(transaction));
          articleEditorToolbar?.update();
          if (transaction.docChanged) scheduleManuscriptPreview({ deferIfManuscriptFocused: true });
        },

        attributes: {
          class: `${articleBlock.className} pm-manuscript-rich-text`,
        },
      });

      view.dom.addEventListener("focus", () => { articleEditorToolbar?.setView(view); }, true);

      manuscriptRichTextEditors.push({
        fieldName: instance.fieldName,
        blockId,
        blockIndex,
        view,
      });
    });
  }
}

const ARTICLE_BLOCK_SELECTOR = "[data-article-block][data-stream-field]";
const ARTICLE_STREAM_FIELDS = new Set(["header", "content"]);
const ARTICLE_KEY_DIRECTIONS = {
  ArrowDown: 1,
  ArrowRight: 1,
  ArrowUp: -1,
  ArrowLeft: -1,
};

function createArticleBlockControls(manuscriptRoot) {
  if (!manuscriptRoot) return;

  articleBlockControlsState?.cleanup?.();
  articleBlockControlsState = null;
  manuscriptRoot.querySelectorAll(".pm-article-block-controls, .pm-article-block-controls-layer").forEach((element) => { element.remove(); });
  if (!manuscriptRoot.querySelector(ARTICLE_BLOCK_SELECTOR)) return;

  const element = (tag, className) => Object.assign(document.createElement(tag), { className });

  const layer = element("div", "pm-article-block-controls-layer");
  const outline = element("div", "pm-article-block-outline");
  const controls = element("div", "pm-article-block-controls");
  const select = element("select", "pm-article-block-controls__select");
  const buttons = {};

  select.setAttribute("aria-label", "Block type to insert");
  controls.appendChild(select);

  const addButton = (key, label, title, callback, extraClass = "") => {
    buttons[key] = makeButton(label, () => {
      const { instance, articleBlock } = articleBlockControlsState || {};
      if (instance && articleBlock) callback(instance, articleBlock, select.value);
    }, title, `pm-article-block-controls__button ${extraClass}`.trim());
    controls.appendChild(buttons[key]);
  };

  [
    ["insert", "+", "Insert after", insertStreamBlockAfter],
    ["up", "↑", "Move up", (instance, articleBlock) => { moveArticleStreamBlock(instance, articleBlock, -1); }],
    ["down", "↓", "Move down", (instance, articleBlock) => { moveArticleStreamBlock(instance, articleBlock, 1); }],
    ["delete", "Del", "Delete", deleteArticleStreamBlock, "pm-article-block-controls__button--danger"],
  ].forEach((args) => { addButton(...args); });

  layer.appendChild(outline);
  layer.appendChild(controls);
  manuscriptRoot.appendChild(layer);

  const state = {
    articleBlock: null,
    instance: null,
    hideTimer: null,

    cleanup() {
      clearTimeout(this.hideTimer);
      for (const [target, eventName, listener, options] of listeners) {
        target.removeEventListener(eventName, listener, options);
      }
      layer.remove();
    },

    hide() {
      clearTimeout(this.hideTimer);
      this.articleBlock = null;
      this.instance = null;
      layer.classList.remove("is-active");
    },

    setActive(articleBlock) {
      const instance = editorInstances.find((item) => item.fieldName === articleBlock.dataset.streamField);
      const info = instance && streamBlockInfoForArticleBlock(instance, articleBlock);
      if (!instance || !info) {
        this.hide();
        return;
      }

      clearTimeout(this.hideTimer);
      this.articleBlock = articleBlock;
      this.instance = instance;
      fillSelect(instance);
      buttons.up.disabled = info.index === 0;
      buttons.down.disabled = info.index === instance.view.state.doc.childCount - 1;
      positionControls();
    },
  };

  select.addEventListener("change", () => {
    if (state.instance) articleInsertBlockTypes.set(state.instance.fieldName, select.value);
  });

  const fillSelect = (instance) => {
    const blockTypes = instance.availableBlockTypes || [];
    const preferredValue = articleInsertBlockTypes.get(instance.fieldName);
    const currentValue = select.value;

    select.replaceChildren(...blockTypes.map((blockType) => {
      const option = document.createElement("option");
      option.value = blockType;
      option.textContent = blockType;
      return option;
    }));

    const nextValue = [preferredValue, currentValue, blockTypes[0]].find((value) => value && blockTypes.includes(value));
    if (nextValue) {
      select.value = nextValue;
      articleInsertBlockTypes.set(instance.fieldName, nextValue);
    }
  };

  const positionControls = () => {
    if (!state.articleBlock) return;

    const rect = state.articleBlock.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      state.hide();
      return;
    }

    // Set to zero for now since makes it hard to select on non-desktop
    const offset = 0;
    const padding = 6;
    layer.classList.add("is-active");
    Object.assign(outline.style, {
      left: `${rect.left - offset}px`,
      top: `${rect.top - offset}px`,
      width: `${rect.width + (offset * 2)}px`,
      height: `${rect.height + (offset * 2)}px`,
    });

    Object.assign(controls.style, { left: "0px", top: "0px" });
    const controlsRect = controls.getBoundingClientRect();
    const left = Math.max(padding, Math.min(rect.left - offset, window.innerWidth - controlsRect.width - padding));
    const topCandidate = rect.top - offset - controlsRect.height;
    const top = Math.max(padding, Math.min(
      topCandidate < padding ? rect.top + offset : topCandidate,
      window.innerHeight - controlsRect.height - padding,
    ));
    Object.assign(controls.style, { left: `${left}px`, top: `${top}px` });
  };

  const insideActiveArea = (target) => Boolean(target && (
    controls.contains(target) || state.articleBlock?.contains(target)
  ));

  const showFromTarget = (target, shouldSelect = false) => {
    if (controls.contains(target)) {
      clearTimeout(state.hideTimer);
      return;
    }

    const articleBlock = target.closest?.(ARTICLE_BLOCK_SELECTOR);
    if (!articleBlock) return;

    if (!shouldSelect && articleBlock === suppressedArticleHoverBlock) return;
    if (shouldSelect || articleBlock !== suppressedArticleHoverBlock) clearSuppressedArticleHover();

    state.setActive(articleBlock);
    if (shouldSelect) selectArticleBlock(articleBlock);
  };

  const scheduleHide = () => {
    clearTimeout(state.hideTimer);
    state.hideTimer = setTimeout(() => {
      if (!insideActiveArea(manuscriptRoot.activeElement)) state.hide();
    }, 120);
  };

  const onOver = (event) => { showFromTarget(event.target); };
  const onFocusIn = (event) => { showFromTarget(event.target, true); };
  const onClick = (event) => { showFromTarget(event.target, true); };
  const onOut = (event) => {
    if (suppressedArticleHoverBlock?.contains(event.target) && !suppressedArticleHoverBlock.contains(event.relatedTarget)) {
      clearSuppressedArticleHover();
    }
    if (insideActiveArea(event.target) && !insideActiveArea(event.relatedTarget)) scheduleHide();
  };
  const onFocusOut = () => { setTimeout(scheduleHide, 0); };
  const listeners = [
    [manuscriptRoot, "mouseover", onOver],
    [manuscriptRoot, "focusin", onFocusIn],
    [manuscriptRoot, "click", onClick],
    [manuscriptRoot, "mouseout", onOut],
    [manuscriptRoot, "focusout", onFocusOut],
    [window, "scroll", positionControls, true],
    [window, "resize", positionControls],
  ];

  for (const [target, eventName, listener, options] of listeners) {
    target.addEventListener(eventName, listener, options);
  }

  articleBlockControlsState = state;
}

function hideArticleBlockControls() {
  articleBlockControlsState?.hide();
}

function streamBlockInfoForArticleBlock(instance, articleBlock) {
  const blockId = articleBlock.dataset.streamBlockId;
  const blockIndex = Number(articleBlock.dataset.streamBlockIndex);
  let start = 0;

  for (let index = 0; index < instance.view.state.doc.childCount; index += 1) {
    const node = instance.view.state.doc.child(index);
    const end = start + node.nodeSize;
    if ((blockId && node.attrs?.id === blockId) || (!blockId && index === blockIndex)) {
      return { node, index, start, end };
    }
    start = end;
  }

  return null;
}

function insertStreamBlockAfter(instance, articleBlock, blockType) {
  const info = streamBlockInfoForArticleBlock(instance, articleBlock);
  if (!info || !blockType) return;

  const newBlock = createStreamBlockNode(instance, blockType);
  const descriptor = {
    fieldName: instance.fieldName,
    blockId: newBlock.attrs?.id || "",
    blockIndex: info.index + 1,
  };

  clearSuppressedArticleHover();
  suppressedArticleHoverBlock = articleBlock;
  suppressedArticleHoverTimer = setTimeout(() => {
    if (suppressedArticleHoverBlock === articleBlock) clearSuppressedArticleHover();
  }, 1200);
  selectedArticleBlock = descriptor;
  instance.view.dispatch(instance.view.state.tr.insert(info.end, newBlock));
  selectArticleBlockDescriptor(descriptor, articleBlock.getRootNode());
  hideArticleBlockControls();
}

function moveArticleStreamBlock(instance, articleBlock, direction) {
  const info = streamBlockInfoForArticleBlock(instance, articleBlock);
  if (!info) return;

  const targetIndex = info.index + direction;
  if (targetIndex < 0 || targetIndex >= instance.view.state.doc.childCount) return;

  const blocks = [];
  for (let index = 0; index < instance.view.state.doc.childCount; index += 1) {
    blocks.push(instance.view.state.doc.child(index));
  }

  [blocks[info.index], blocks[targetIndex]] = [blocks[targetIndex], blocks[info.index]];
  instance.view.dispatch(instance.view.state.tr.replaceWith(
    0,
    instance.view.state.doc.content.size,
    Fragment.fromArray(blocks),
  ));
  const root = articleBlock.getRootNode();
  const fieldName = articleBlock.dataset.streamField;
  const articleBlocks = streamFieldArticleBlocks(root, fieldName);
  const target = articleBlocks[articleBlocks.indexOf(articleBlock) + direction];
  if (!target) return;

  if (direction < 0) target.before(articleBlock);
  else target.after(articleBlock);

  refreshArticleBlockIndexes(root, fieldName);
  articleBlockControlsState?.setActive?.(articleBlock);
  selectArticleBlock(articleBlock);
}

function deleteArticleStreamBlock(instance, articleBlock) {
  const info = streamBlockInfoForArticleBlock(instance, articleBlock);
  if (!info) return;

  const { doc, tr } = instance.view.state;
  selectedArticleBlock = null;
  if (doc.childCount <= 1) {
    instance.view.dispatch(tr.replaceWith(info.start, info.end, streamSchema.nodeFromJSON(createEmptyRichTextBlock())));
    filterArticleEditorToBlock(null);
    hideArticleBlockControls();
    return;
  }

  instance.view.dispatch(tr.delete(info.start, info.end));
  const root = articleBlock.getRootNode();
  const fieldName = articleBlock.dataset.streamField;
  articleBlock.remove();
  refreshArticleBlockIndexes(root, fieldName);
  filterArticleEditorToBlock(null);
  hideArticleBlockControls();
}

function streamFieldArticleBlocks(root, fieldName) {
  return Array.from(root.querySelectorAll(`${ARTICLE_BLOCK_SELECTOR}[data-stream-field="${window.CSS.escape(fieldName)}"]`));
}

function refreshArticleBlockIndexes(root, fieldName) {
  streamFieldArticleBlocks(root, fieldName).forEach((block, index) => {
    block.dataset.streamBlockIndex = index;
  });
}

function selectArticleBlock(articleBlock) {
  selectArticleBlockDescriptor(articleBlockDescriptor(articleBlock), articleBlock.getRootNode());
}

function selectArticleBlockDescriptor(descriptor, manuscriptRoot = null, options = {}) {
  if (!descriptor) return false;

  selectedArticleBlock = descriptor;
  selectMetadataTab("article");
  filterArticleEditorToBlock(descriptor);

  const articleBlock = manuscriptRoot && articleBlockFromDescriptor(manuscriptRoot, descriptor);
  if (articleBlock) {
    articleBlockControlsState?.setActive?.(articleBlock);
    if (options.reveal) articleBlock.scrollIntoView({ block: "nearest" });
  }

  return true;
}

function articleBlockDescriptor(articleBlock) {
  const instance = editorInstances.find((item) => item.fieldName === articleBlock.dataset.streamField);
  const info = instance && streamBlockInfoForArticleBlock(instance, articleBlock);
  if (!instance || !info) return null;

  return {
    fieldName: instance.fieldName,
    blockId: info.node.attrs?.id || articleBlock.dataset.streamBlockId || "",
    blockIndex: info.index,
  };
}

function articleBlockFromDescriptor(root, descriptor) {
  const blocks = streamFieldArticleBlocks(root, descriptor.fieldName);
  return (
    descriptor.blockId && blocks.find((block) => block.dataset.streamBlockId === String(descriptor.blockId))
  ) || blocks[descriptor.blockIndex] || null;
}

function filterArticleEditorToBlock(descriptor) {
  for (const instance of editorInstances) {
    if (!ARTICLE_STREAM_FIELDS.has(instance.fieldName)) continue;

    const section = instance.mount.closest(".editor-section");
    const isSelectedField = descriptor?.fieldName === instance.fieldName;
    if (section) section.hidden = Boolean(descriptor && !isSelectedField);

    const blocks = Array.from(instance.mount.querySelectorAll(".pm-stream-block"));
    const selectedBlock = isSelectedField
      ? (
        descriptor.blockId && blocks.find((block) => block.dataset.streamBlockId === String(descriptor.blockId))
      ) || blocks.find((block) => Number(block.dataset.streamBlockIndex) === descriptor.blockIndex) || null
      : null;
    blocks.forEach((block) => {
      block.hidden = Boolean(descriptor && block !== selectedBlock);
    });
  }
}

function clearSuppressedArticleHover() {
  if (suppressedArticleHoverTimer) clearTimeout(suppressedArticleHoverTimer);
  suppressedArticleHoverTimer = null;
  suppressedArticleHoverBlock = null;
}

function setupArticleBlockKeyboard(manuscriptRoot) {
  document.addEventListener("keydown", (event) => {
    const direction = ARTICLE_KEY_DIRECTIONS[event.key];
    const isEditing = (event.composedPath?.() || []).some((element) => (
      ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(element?.nodeName) ||
      element?.isContentEditable ||
      element?.classList?.contains("ProseMirror")
    ));

    if (
      !direction || isEditing || event.defaultPrevented ||
      event.altKey || event.ctrlKey || event.metaKey || event.shiftKey
    ) return;

    const descriptors = articleBlockDescriptors();
    if (!descriptors.length) return;

    const currentIndex = selectedArticleBlock
      ? descriptors.findIndex((descriptor) => sameArticleBlockDescriptor(descriptor, selectedArticleBlock))
      : -1;
    const nextIndex = currentIndex < 0
      ? (direction > 0 ? 0 : descriptors.length - 1)
      : Math.max(0, Math.min(descriptors.length - 1, currentIndex + direction));

    if (nextIndex === currentIndex) return;
    clearSuppressedArticleHover();
    if (selectArticleBlockDescriptor(descriptors[nextIndex], manuscriptRoot, { reveal: true })) event.preventDefault();
  });
}

function articleBlockDescriptors() {
  const descriptors = [];

  for (const fieldName of ARTICLE_STREAM_FIELDS) {
    const instance = editorInstances.find((item) => item.fieldName === fieldName);
    if (!instance) continue;

    for (let blockIndex = 0; blockIndex < instance.view.state.doc.childCount; blockIndex += 1) {
      const node = instance.view.state.doc.child(blockIndex);
      descriptors.push({
        fieldName,
        blockId: node.attrs?.id || "",
        blockIndex,
      });
    }
  }

  return descriptors;
}

function sameArticleBlockDescriptor(left, right) {
  if (!left || !right || left.fieldName !== right.fieldName) return false;
  return left.blockId || right.blockId ? left.blockId === right.blockId : left.blockIndex === right.blockIndex;
}

function applyManuscriptRichTextOverrides(fieldName, pmDoc) {
  const nextDoc = clone(pmDoc);
  const blocks = nextDoc.content || [];

  for (const editor of manuscriptRichTextEditors.filter((item) => item.fieldName === fieldName)) {
    const block = (
      editor.blockId && blocks.find((node) => node.attrs?.id === editor.blockId)
    ) || (!editor.blockId && blocks[editor.blockIndex]);
    const field = (block?.content || []).find((child) => child.type === "editable_field" && child.attrs?.mode === "richtext");

    if (field) {
      field.content = editor.view.state.doc.toJSON().content || [{ type: "paragraph" }];
    }
  }

  return nextDoc;
}
