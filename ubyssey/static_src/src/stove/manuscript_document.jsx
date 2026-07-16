// Deals with document level stuff like shadow dom/preview and direct inline editing
// Shadow Dom, preview refresh, history, text editor writeback

import { useEffect } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import Select from "react-select";
import { DOMParser as ProseMirrorDOMParser, DOMSerializer, Fragment } from "prosemirror-model";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { ACTIVE_SUGGESTION_THREAD_META, editorPlugins, richTextSchema } from "./manuscript_prosemirror.jsx";
import { clone, pmDocToStreamValue, topLevelBlockInfoByIdOrIndex } from "./manuscript_prosetail.jsx";
import { editorState } from "./manuscript_editor.js";
import { articleBlockDescriptors, describeArticleBlock, findArticleBlock, refreshBlockCommentBorders, sameArticleBlock, setupArticleBlockControls, showSelectedArticleBlockEditor } from "./manuscript_blocks.jsx";

// Non hidden inputs
const focusableSelector = "input:not([type='hidden']), select, textarea, button";

function on(target, eventName, callback, options) {
  target.addEventListener(eventName, callback, options);
  return () => target.removeEventListener(eventName, callback, options);
}

function setModalOpen(modal, isOpen, focusTarget = null) {
  modal.hidden = !isOpen;
  document.body.classList.toggle(
    "article-media-modal-open",
    Boolean(document.querySelector(".article-media-modal:not([hidden])")),
  );

  if (isOpen) {
    window.requestAnimationFrame(() => {
      (focusTarget || modal.querySelector(focusableSelector)).focus();
    });
  }
}

function usePageFieldToggles(form, schedulePreview) {
  useEffect(() => {
    const cleanups = Array.from(document.querySelectorAll("[data-page-field-toggle]")).flatMap((toggle) => {
      const field = form.elements.namedItem(toggle.dataset.pageFieldToggle);

      const syncToggle = () => {
        toggle.checked = Boolean(String(field.value).trim());
      };
      const onToggleChange = () => {
        if (toggle.checked) {
          field.value = toggle.dataset.pageFieldBoilerplate;
        } else if (String(field.value).trim() && !window.confirm("Remove this field? Its current text will not be saved.")) {
          toggle.checked = true;
          return;
        } else {
          field.value = "";
        }

        field.dispatchEvent(new Event("input", { bubbles: true }));
        form.dispatchEvent(new Event("input", { bubbles: true }));
        schedulePreview({ immediate: true });
      };

      syncToggle();
      return [
        on(field, "input", syncToggle),
        on(toggle, "change", onToggleChange),
      ];
    });

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [form, schedulePreview]);
}

function useArticleAuthorsPanel() {
  useEffect(() => {
    const panel = document.querySelector("[data-article-authors-panel]");
    if (!panel) return undefined;

    const rows = panel.querySelector("[data-article-author-rows]");
    const form = panel.closest("form");
    const selectRoots = new Map();
    const notifyChanged = () => {
      form.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const setupAuthorSelect = (select) => {
      const options = Array.from(select.options).map((option) => ({
        label: option.text,
        value: option.value,
      }));
      const container = document.createElement("div");
      const root = createRoot(container);

      container.className = "pm-author-panel__select";
      select.hidden = true;
      select.parentNode.insertBefore(container, select.nextSibling);
      root.render(
        <Select
          classNamePrefix="pm-author-panel-select"
          defaultValue={options.find((option) => option.value === select.value)}
          options={options}
          onChange={(option) => {
            select.value = option.value;
            select.dispatchEvent(new Event("change", { bubbles: true }));
          }}
        />,
      );
      selectRoots.set(container, root);
    };

    panel.querySelectorAll("[data-article-author-select]").forEach(setupAuthorSelect);

    const cleanups = [
      on(panel, "click", (event) => {
        const addButton = event.target.closest("[data-article-author-add]");
        const removeButton = event.target.closest("[data-article-author-remove]");
        if (!addButton && !removeButton) return;

        event.preventDefault();

        if (addButton) {
          const row = rows.querySelector("[data-article-author-row]").cloneNode(true);
          row.querySelector(".pm-author-panel__select").remove();
          row.querySelectorAll("label > span").forEach((label) => { label.remove(); });
          row.querySelectorAll("select").forEach((select) => { select.selectedIndex = 0; });
          rows.appendChild(row);
          setupAuthorSelect(row.querySelector("[data-article-author-select]"));
          window.requestAnimationFrame(() => {
            row.querySelector(".pm-author-panel-select__input input").focus();
          });
        } else {
          const row = removeButton.closest("[data-article-author-row]");
          const allRows = rows.querySelectorAll("[data-article-author-row]");
          const authorSelect = row.querySelector("[data-article-author-select]");
          const container = authorSelect.nextElementSibling;

          selectRoots.get(container).unmount();
          selectRoots.delete(container);
          container.remove();
          if (allRows.length === 1) {
            row.querySelectorAll("select").forEach((select) => { select.selectedIndex = 0; });
            setupAuthorSelect(authorSelect);
          } else {
            row.remove();
          }
        }

        notifyChanged();
      }),
      on(panel, "change", notifyChanged),
    ];

    return () => {
      cleanups.forEach((cleanup) => cleanup());
      selectRoots.forEach((root) => root.unmount());
    };
  }, []);
}

function useMetadataTabs() {
  useEffect(() => {
    const cleanups = Array.from(document.querySelectorAll("[data-metadata-tab]")).map((tab) => (
      on(tab, "click", () => {
        document.querySelectorAll("[data-metadata-tab]").forEach((item) => {
          item.setAttribute("aria-selected", String(item.dataset.metadataTab === tab.dataset.metadataTab));
        });
        document.querySelectorAll("[data-metadata-panel]").forEach((panel) => {
          panel.hidden = panel.dataset.metadataPanel !== tab.dataset.metadataTab;
        });
      })
    ));
    return () => cleanups.forEach((cleanup) => cleanup());
  }, []);
}

function useMediaAndSettingsModals(form) {
  useEffect(() => {
    const uploadButton = document.querySelector("[data-article-media-upload-button]");
    const settingsModal = document.querySelector("[data-manuscript-settings-modal]");
    const uploadModal = document.querySelector("[data-article-media-upload-modal]");
    const galleryModal = document.querySelector("[data-article-media-gallery-modal]");
    const uploadTitle = document.querySelector("[data-article-media-upload-title]");
    const kind = form.elements.namedItem("article_media-kind");
    let uploadReturnsToGallery = false;

    const mediaField = (name) => form.querySelector(`#id_article_media-${name}`);
    const setUploadMode = (mode) => {
      const editing = mode === "edit";
      uploadTitle.textContent = editing ? "Edit media" : "Upload media";
      uploadButton.textContent = editing ? "Save" : "Upload";
    };
    const reset = () => {
      form.querySelectorAll("[name^='article_media-']").forEach((field) => {
        if (field !== kind) field.value = "";
      });
      delete form.dataset.articleMediaEditKind;
      setUploadMode("upload");
    };
    const syncImageFields = () => {
      document.querySelectorAll("[data-article-media-image-only]").forEach((row) => {
        row.hidden = kind.value !== "image";
      });
      if (mediaField("media_id").value && kind.value !== form.dataset.articleMediaEditKind) reset();
    };
    const closeUpload = () => {
      const shouldFocusGallery = uploadReturnsToGallery;
      setModalOpen(uploadModal, false);
      uploadModal.classList.remove("article-media-modal--stacked");
      uploadReturnsToGallery = false;
      reset();
      syncImageFields();
      if (shouldFocusGallery) {
        window.requestAnimationFrame(() => {
          galleryModal.querySelector("[data-article-media-edit-button], a, button").focus();
        });
      }
    };

    syncImageFields();

    const cleanups = [
      on(document.querySelector("[data-manuscript-open-settings]"), "click", () => {
        setModalOpen(settingsModal, true, settingsModal.querySelector(focusableSelector));
      }),
      on(document.querySelector("[data-article-media-open-upload]"), "click", () => {
        uploadReturnsToGallery = !galleryModal.hidden;
        uploadModal.classList.toggle("article-media-modal--stacked", uploadReturnsToGallery);
        reset();
        syncImageFields();
        setModalOpen(uploadModal, true, kind);
      }),
      on(document.querySelector("[data-article-media-open-gallery]"), "click", () => {
        setModalOpen(galleryModal, true, galleryModal.querySelector("[data-article-media-edit-button], a, button"));
      }),
      on(form, "click", (event) => {
        const editButton = event.target.closest("[data-article-media-edit-button]");
        if (!editButton) return;

        const card = editButton.closest("[data-article-media-item]");
        event.preventDefault();

        ["id", "kind", "title", "author", "description", "tags"].forEach((name) => {
          const field = mediaField(name === "id" ? "media_id" : name);
          field.value = card.dataset[name] || "";
        });
        mediaField("file").value = "";
        form.dataset.articleMediaEditKind = card.dataset.kind;
        setUploadMode("edit");
        syncImageFields();
        uploadReturnsToGallery = !galleryModal.hidden;
        uploadModal.classList.toggle("article-media-modal--stacked", uploadReturnsToGallery);
        setModalOpen(uploadModal, true, mediaField("title"));
      }),
      ...Array.from(document.querySelectorAll("[data-article-media-close], [data-manuscript-settings-close]")).map((button) => (
        on(button, "click", () => {
          const modal = button.closest("[data-manuscript-settings-modal], [data-article-media-upload-modal], [data-article-media-gallery-modal]");
          if (modal === uploadModal) closeUpload();
          else setModalOpen(modal, false);
        })
      )),
      on(document, "keydown", (event) => {
        if (event.key !== "Escape") return;
        if (!uploadModal.hidden) closeUpload();
        else if (!galleryModal.hidden) setModalOpen(galleryModal, false);
        else if (!settingsModal.hidden) setModalOpen(settingsModal, false);
      }),
      on(kind, "change", syncImageFields),
      on(uploadButton, "click", async () => {
        uploadButton.disabled = true;
        try {
          const response = await fetch(form.dataset.mediaUploadUrl, { method: "POST", body: new FormData(form) });
          const payload = await response.json();
          if (!response.ok) {
            window.alert(`Upload failed: ${JSON.stringify(payload.errors || payload)}`);
            return;
          }

          document.querySelector("[data-article-media-gallery]").outerHTML = payload.gallery;
          const selector = `.pm-control-field--${payload.item.kind} select${payload.item.kind === "image" ? ",select[name='featured_media-image']" : ""}`;
          document.querySelectorAll(selector).forEach((select) => {
            const existingOption = Array.from(select.options).find((item) => String(item.value) === String(payload.item.id));
            const option = existingOption || select.appendChild(new Option());
            option.value = payload.item.id;
            option.textContent = payload.item.title;
          });

          closeUpload();
        } catch (error) {
          window.alert("Upload failed.");
        } finally {
          uploadButton.disabled = false;
        }
      }),
    ];
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [form]);
}

function useAsyncSave(form, writeBeforeSave) {
  useEffect(() => {
    const cleanup = on(form, "submit", async (event) => {
      event.preventDefault();

      const submitter = event.submitter;
      const originalText = submitter.textContent;
      const saveButtons = form.querySelectorAll("[data-article-action]");

      writeBeforeSave();
      const formData = new FormData(form);
      formData.set(submitter.name, submitter.value);

      saveButtons.forEach((button) => { button.disabled = true; });
      submitter.textContent = "Saving...";

      try {
        const response = await fetch(form.getAttribute("action"), {
          method: "POST",
          body: formData,
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
            "X-Requested-With": "XMLHttpRequest",
          },
        });
        const payload = (response.headers.get("content-type") || "").includes("application/json")
          ? await response.json()
          : {};

        if (!response.ok || payload.errors) {
          const message = payload.errors
            ? Object.entries(payload.errors)
              .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(", ") : messages}`)
              .join("\n")
            : `Save failed with status ${response.status}: ${form.getAttribute("action")}`;
          window.alert(message);
          return;
        }

        const historySelect = document.querySelector("[data-history-select]");
        if (historySelect && payload.revision) {
          const revisionId = String(payload.revision.id);
          const existingOption = Array.from(historySelect.options).find((option) => option.value === revisionId);
          if (!existingOption) {
            const option = document.createElement("option");
            option.value = revisionId;
            option.textContent = payload.revision.label || `Revision ${revisionId}`;
            historySelect.insertBefore(option, historySelect.options[0]);
          }
          historySelect.selectedIndex = 0;
        }

        submitter.textContent = payload.action === "publish" ? "Published" : "Saved";
        window.setTimeout(() => { submitter.textContent = originalText; }, 1400);
      } catch (error) {
        console.error(error);
        window.alert("Failed to save.");
      } finally {
        saveButtons.forEach((button) => { button.disabled = false; });
        if (submitter.textContent === "Saving...") submitter.textContent = originalText;
      }
    });

    return cleanup;
  }, [form, writeBeforeSave]);
}

function ManuscriptChrome({ form, schedulePreview, writeBeforeSave }) {
  usePageFieldToggles(form, schedulePreview);
  useArticleAuthorsPanel();
  useMetadataTabs();
  useMediaAndSettingsModals(form);
  useAsyncSave(form, writeBeforeSave);

  return null;
}

export function mountManuscriptChrome(props) {
  const mount = document.createElement("div");
  mount.hidden = true;
  mount.dataset.manuscriptChromeRoot = "";
  document.body.appendChild(mount);
  createRoot(mount).render(<ManuscriptChrome {...props} />);
}

// Shadow Dom, preview refresh, history, text editor writeback

const theme = "light" // todo Add setting in future
const ARTICLE_BLOCK_SELECTOR = "[data-article-block][data-stream-field]";
const DIRECT_EDITABLE_SELECTOR = "[data-article-editable-page-field], [data-article-editable-featured-media-field], [data-article-editable-stream-field][data-article-editable-path]";
const EMPTY_RICH_TEXT = [{ type: "paragraph" }];

export function setupArticleShadow() {
  const host = document.querySelector("[data-article-shadow]");
  if (!host) {
    return null;
  }

  const articleStylesheets = Array.from(host.querySelectorAll("[data-article-stylesheet]"));
  const articleStylesheetHrefs = articleStylesheets.map((stylesheet) => stylesheet.getAttribute("href")).filter(Boolean);

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
    ...articleStylesheetHrefs,
    host.dataset.shadowEditorCss,
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
    shadowHtml.setAttribute("color-css-theme", document.documentElement.getAttribute("color-css-theme") || theme);
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
  const content = document.createElement("div");
  wrapper.className = "article-shadow-preview article";
  content.dataset.articlePreviewContent = "";
  content.innerHTML = articleHtml;
  wrapper.appendChild(content);
  shadowBody.appendChild(wrapper);

  return shadowRoot;
}

function currentStreamDocs() {
  const streamDocs = new Map();
  for (const instance of editorState.streamEditors) {
    const nextDoc = clone(instance.view.state.doc.toJSON());
    const blocks = nextDoc.content || [];

    for (const editor of editorState.articleRichTextEditors.filter((item) => item.fieldName === instance.fieldName)) {
      const block = (editor.blockId && blocks.find((node) => node.attrs?.id === editor.blockId)) || (!editor.blockId && blocks[editor.blockIndex]);
      const field = (block?.content || []).find((child) => child.type === "editable_field" && child.attrs?.mode === "richtext");
      if (field) field.content = editor.view.state.doc.toJSON().content || EMPTY_RICH_TEXT;
    }

    streamDocs.set(instance.fieldName, nextDoc);
  }
  return streamDocs;
}

// Serializes every stream editor into its hidden textarea for preview/save
export function writeStreamTextareas(streamDocs = currentStreamDocs()) {
  for (const instance of editorState.streamEditors) {
    instance.textarea.value = JSON.stringify(pmDocToStreamValue(streamDocs.get(instance.fieldName)), null, 2);
  }

  return streamDocs;
}

function createArticleRichTextEditor(mount, content, className, onDocChanged) {
  const attributes = { class: className };
  for (const attr of [
    "data-article-block",
    "data-stream-field",
    "data-stream-block-id",
    "data-stream-block-index",
    "data-article-editable-page-field",
    "data-article-editable-featured-media-field",
    "data-article-editable-stream-field",
    "data-article-editable-path",
    "data-article-editable-path-prefix",
    "data-article-editable-mode",
  ]) {
    if (mount.hasAttribute?.(attr)) attributes[attr] = mount.getAttribute(attr);
  }

  let view;
  view = new EditorView({ mount }, {
    state: EditorState.create({
      doc: richTextSchema.nodeFromJSON({ type: "doc", content: content?.length ? content : EMPTY_RICH_TEXT }),
      plugins: editorPlugins(richTextSchema),
    }),

    dispatchTransaction(transaction) {
      const activeSuggestionThreadId = transaction.getMeta(ACTIVE_SUGGESTION_THREAD_META);
      view.updateState(view.state.apply(transaction));
      editorState.richTextToolbar?.update();
      if (activeSuggestionThreadId) editorState.commentSidebar?.activateThread(activeSuggestionThreadId);
      else editorState.commentSidebar?.update();
      editorState.footnoteSidebar?.update();
      if (transaction.docChanged) onDocChanged(view, transaction);
    },

    attributes,
  });
  view.dom.addEventListener("focus", () => { editorState.richTextToolbar?.setView(view); }, true);
  return {
    view,
    destroy() {
      view.destroy();
    },
  };
}

function destroyEditorViews(editors) {
  for (const editor of editors) editor.destroy();
  editors.length = 0;
  editorState.richTextToolbar?.setView(null);
  editorState.commentSidebar?.update();
  editorState.footnoteSidebar?.update();
}

function directEditableSource(target, { allowPage = true } = {}) {
  const instance = editorState.streamEditors.find((item) => item.fieldName === target.dataset.articleEditableStreamField);
  const articleBlock = target.closest?.(ARTICLE_BLOCK_SELECTOR);
  const paths = editablePaths(target);
  const block = instance && articleBlock && paths.length && topLevelBlockInfoByIdOrIndex(instance.view.state.doc, articleBlock.dataset.streamBlockId, Number(articleBlock.dataset.streamBlockIndex));
  const field = block && paths.map((path) => editableFieldInfo(block, path)).find(Boolean);
  const streamSource = field && { kind: "stream", instance, block, field };
  const pageFieldName = target.dataset.articleEditablePageField;
  const featuredMediaFieldName = target.dataset.articleEditableFeaturedMediaField;
  const form = (allowPage && document.querySelector("[data-manuscript-form]")) || null;
  const pageInput = formInput(form, pageFieldName);
  const featuredMediaInput = formInput(form, featuredMediaFieldName && `featured_media-${featuredMediaFieldName}`);
  const inputSource = (pageInput && { kind: "page", input: pageInput }) || (featuredMediaInput && { kind: "featured_media", input: featuredMediaInput });
  return (streamSource && (!inputSource || streamSource.field.textContent.trim())) ? streamSource : inputSource || streamSource;
}

function formInput(form, name) {
  if (!form || !name) return null;
  return form.elements?.namedItem(name) || Element.prototype.querySelector.call(form, `[name="${window.CSS.escape(name)}"]`);
}

function editablePaths(target) {
  if (target.dataset.articleEditablePath === undefined) return [];

  const prefixes = [];
  let element = target.parentElement;
  while (element) {
    if (element.dataset?.articleEditablePathPrefix !== undefined) {
      prefixes.unshift(parseEditablePath(element.dataset.articleEditablePathPrefix));
    }
    element = element.parentElement;
  }

  const prefixPath = prefixes.reduce((parts, prefix) => parts.concat(prefix), []);
  return target.dataset.articleEditablePath.split("|").map((path) => [
    ...prefixPath,
    ...parseEditablePath(path),
  ]);
}

function parseEditablePath(path) {
  return path === "" ? [] : path.split(".").map((part) => /^\d+$/.test(part) ? Number(part) : part);
}

function editableFieldInfo(block, path) {
  const match = editableFieldInfoInNode(block.node, path);
  return match && {
    ...match,
    pos: block.start + 1 + match.pos,
  };
}

function editableFieldInfoInNode(parent, targetPath, pathPrefix = [], startPos = 0) {
  let offset = 0;

  for (let index = 0; index < parent.childCount; index += 1) {
    const node = parent.child(index);
    const pos = startPos + offset;

    if (node.type.name === "editable_field") {
      const path = pathPrefix.concat(node.attrs?.path || []);
      if (samePath(path, targetPath)) return { node, path, pos, textContent: node.textContent || "" };
    } else if (node.type.name === "list_field") {
      const match = editableFieldInfoInListField(node, targetPath, pathPrefix.concat(node.attrs?.path || []), pos + 1);
      if (match) return match;
    } else if (node.childCount) {
      const match = editableFieldInfoInNode(node, targetPath, pathPrefix, pos + 1);
      if (match) return match;
    }

    offset += node.nodeSize;
  }

  return null;
}

function editableFieldInfoInListField(listField, targetPath, listPath, startPos) {
  let offset = 0;

  for (let index = 0; index < listField.childCount; index += 1) {
    const item = listField.child(index);
    const itemPos = startPos + offset;
    const itemPath = listPath.concat(index);
    const match = editableFieldInfoInNode(item, targetPath, itemPath, itemPos + 1);
    if (match) return match;
    offset += item.nodeSize;
  }

  return null;
}

function samePath(left = [], right = []) {
  return JSON.stringify(left || []) === JSON.stringify(right || []);
}

function writeStreamFieldContent(source, fragment) {
  const { view } = source.instance;
  const latestBlock = topLevelBlockInfoByIdOrIndex(view.state.doc, source.block.node.attrs?.id, source.block.index);
  const latestField = latestBlock && editableFieldInfo(latestBlock, source.field.path || source.field.node.attrs?.path || []);
  if (latestField) {
    view.dispatch(view.state.tr
      .replaceWith(latestField.pos + 1, latestField.pos + 1 + latestField.node.content.size, fragment)
      .setMeta("skipPreview", true));
  }
}

function richTextContentFromHtml(html) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html || "";
  return ProseMirrorDOMParser.fromSchema(richTextSchema).parse(wrapper).toJSON().content || EMPTY_RICH_TEXT;
}

function richTextHtmlFromDoc(doc) {
  const wrapper = document.createElement("div");
  wrapper.appendChild(DOMSerializer.fromSchema(richTextSchema).serializeFragment(doc.content));
  return wrapper.innerHTML;
}

function stopDirectEditEvents(target) {
  target.addEventListener("input", (event) => { event.stopPropagation(); });
}

export function setupServerPreviewRefresh(form, manuscriptRoot) {
  if (!form?.dataset.previewUrl || !manuscriptRoot) return;

  let timer = null;
  let controller = null;
  let previewId = 0;
  let previewRevision = 0;
  let deferredManuscriptPreview = false;
  const historySelect = document.querySelector("[data-history-select]");

  editorState.schedulePreview = ({ deferIfManuscriptFocused = false, immediate = false } = {}) => {
    if (historySelect) historySelect.selectedIndex = 0;
    previewRevision += 1;
    clearTimeout(timer);

    if (deferIfManuscriptFocused && focusedArticleRichText(manuscriptRoot)) {
      deferredManuscriptPreview = true;
      return;
    }

    deferredManuscriptPreview = false;
    timer = setTimeout(sendPreview, immediate ? 0 : 500);
  };

  editorState.cancelPreviewRefresh = () => {
    previewRevision += 1;
    clearTimeout(timer);
    if (controller) controller.abort();
    deferredManuscriptPreview = false;
  };

  const flushDeferredPreview = () => {
    if (editorState.blockEditorModalOpen) return;
    if (!deferredManuscriptPreview || focusedArticleRichText(manuscriptRoot)) return;
    editorState.schedulePreview();
  };

  const scheduleFromForm = (event) => {
    if ((event.composedPath?.() || []).some((element) => element?.matches?.("[data-history-select], .manuscript-topbar, .manuscript-topbar *"))) return;
    if ((event.composedPath?.() || []).some((element) => element?.matches?.(".pm-manuscript-rich-text, .pm-manuscript-direct-edit"))) return;
    if (editorState.blockEditorModalOpen) return;
    editorState.schedulePreview();
  };

  form.addEventListener("input", scheduleFromForm);
  form.addEventListener("change", scheduleFromForm);
  manuscriptRoot.addEventListener("focusout", () => { setTimeout(flushDeferredPreview, 0); });

  async function sendPreview() {
    const streamDocs = writeStreamTextareas();

    if (controller) controller.abort();
    controller = new AbortController();
    const currentPreviewId = ++previewId;
    const requestRevision = previewRevision;

    try {
      const html = await fetchPreviewHtml(form, new FormData(form), controller.signal);
      if (currentPreviewId !== previewId || requestRevision !== previewRevision || !html) return;

      if (replaceArticlePreviewHtml(manuscriptRoot, html)) {
        const reveal = editorState.revealSelectedArticleBlock;
        restoreCurrentArticleControls(manuscriptRoot, streamDocs);
        if (reveal) {
          editorState.revealSelectedArticleBlock = null;
          window.requestAnimationFrame(() => {
            const articleBlock = findArticleBlock(manuscriptRoot, reveal);
            articleBlock?.scrollIntoView({ behavior: "smooth", block: "center" });
          });
        }
      }
    } catch (error) {
      if (error.name !== "AbortError") console.error(error);
    }
  }
}

function focusedArticleRichText(manuscriptRoot) {
  const active = manuscriptRoot?.activeElement;
  return Boolean(active?.closest?.(".pm-manuscript-rich-text, .pm-manuscript-direct-edit, .pm-manuscript-toolbar"));
}

export function setupHistoryPreviewButtons(manuscriptRoot) {
  const form = document.querySelector("[data-manuscript-form]");
  const historyButtons = document.querySelectorAll("[data-history-button]");
  const historySelect = document.querySelector("[data-history-select]");
  const restoreButton = document.querySelector("[data-history-restore]");
  if (!form || !manuscriptRoot) return;

  const selectedRevision = () => historySelect?.value || "";
  const selectedRevisionIsCurrent = () => !historySelect || historySelect.selectedIndex <= 0;
  const updateRestoreButton = () => {
    if (restoreButton) restoreButton.disabled = selectedRevisionIsCurrent();
  };

  const previewRevision = async (revisionId, isCurrent = false) => {
    try {
      editorState.cancelPreviewRefresh();
      const formData = new FormData(form);
      const streamDocs = isCurrent ? writeStreamTextareas() : null;

      if (!isCurrent) formData.set("revision", revisionId);

      const html = await fetchPreviewHtml(form, formData);
      if (!html || !replaceArticlePreviewHtml(manuscriptRoot, html)) return;

      if (isCurrent) {
        restoreCurrentArticleControls(manuscriptRoot, streamDocs);
      } else {
        editorState.selectedArticleBlock = null;
        showSelectedArticleBlockEditor(null);
      }
    } catch (error) {
      if (error.name !== "AbortError") console.error(error);
    }
  };

  historySelect?.addEventListener("change", (event) => {
    event.stopPropagation();
    updateRestoreButton();
    previewRevision(historySelect.value, selectedRevisionIsCurrent());
  });

  restoreButton?.addEventListener("click", async () => {
    const revisionId = selectedRevision();
    if (!form.dataset.restoreUrl || selectedRevisionIsCurrent()) return;
    if (!window.confirm("Restore this version as the current draft?")) return;
    
    const originalText = restoreButton.textContent;
    restoreButton.disabled = true;
    restoreButton.textContent = "Restoring...";
    try {
      const formData = new FormData(form);
      formData.set("revision", revisionId);
      const response = await fetch(form.dataset.restoreUrl, {
        method: "POST",
        body: formData,
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
      });
      const payload = await response.json();
      if (!response.ok || payload.errors) {
        const message = payload.errors
          ? Object.entries(payload.errors)
            .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(", ") : messages}`)
            .join("\n")
          : "Failed to restore version.";
        // todo replace alerts with modal maybe
        alert(message);
        return;
      }
      window.location.reload();
    } catch (error) {
      console.error(error);
      alert("Failed to restore version.");
    } finally {
      restoreButton.textContent = originalText;
      updateRestoreButton();
    }
  });

  updateRestoreButton();

  for (const btn of historyButtons) {
    btn.addEventListener("click", () => { previewRevision(btn.dataset.revisionId); });
  }
}

async function fetchPreviewHtml(form, formData, signal = null) {
  const response = await fetch(form.dataset.previewUrl, {
    method: "POST",
    body: formData,
    credentials: "same-origin",
    signal,
  });
  const payload = await response.json();
  return response.ok && payload.html ? payload.html : null;
}

export function setupArticlePreviewEditors(manuscriptRoot, streamDocs = null) {
  if (!manuscriptRoot) return;

  if (!editorState.articleBlockControls) setupArticleBlockControls(manuscriptRoot);
  else refreshBlockCommentBorders(manuscriptRoot);

  // Inline RichText Editors
  const articleBlocksByField = new Map();
  for (const articleBlock of manuscriptRoot.querySelectorAll(ARTICLE_BLOCK_SELECTOR)) {
    const blocks = articleBlocksByField.get(articleBlock.dataset.streamField) || [];
    blocks.push(articleBlock);
    articleBlocksByField.set(articleBlock.dataset.streamField, blocks);
  }

  for (const instance of editorState.streamEditors) {
    const articleBlocks = articleBlocksByField.get(instance.fieldName) || [];
    const doc = streamDocs?.get(instance.fieldName) || instance.view.state.doc.toJSON();

    (doc.content || []).forEach((block, blockIndex) => {
      const field = (block.content || []).find((child) => (
        child.type === "editable_field" &&
        child.attrs?.mode === "richtext" &&
        samePath(child.attrs?.path, [])
      ));
      if (block.attrs?.blockType !== "richtext" || !field || (block.content || []).some((child) => child.type === "control_field")) return;

      const blockId = block.attrs?.id;
      const articleBlock = (blockId && articleBlocks.find((element) => element.dataset.streamBlockId === String(blockId))) || articleBlocks.find((element) => Number(element.dataset.streamBlockIndex) === blockIndex);
      if (!articleBlock) return;

      const editor = createArticleRichTextEditor(articleBlock, field.content, `${articleBlock.className} pm-manuscript-rich-text`, () => {});
      editorState.articleRichTextEditors.push({ ...editor, fieldName: instance.fieldName, blockId, blockIndex });
    });
  }

  // Direct Text Editors
  destroyEditorViews(editorState.articleDirectTextEditors);
  for (const target of manuscriptRoot.querySelectorAll(DIRECT_EDITABLE_SELECTOR)) {
    const source = directEditableSource(target);
    if (!source) continue;

    if (target.dataset.articleEditableMode === "richtext") {
      const editor = createArticleRichTextEditor(
        target,
        source.kind === "stream" ? source.field.node.toJSON().content : richTextContentFromHtml(source.input.value),
        `${target.className} pm-manuscript-direct-edit pm-manuscript-direct-rich-text`,
        (activeView) => {
          if (source.kind !== "stream") {
            source.input.value = richTextHtmlFromDoc(activeView.state.doc);
            return;
          }

          const schema = source.instance.view.state.schema;
          writeStreamFieldContent(source, Fragment.fromArray((activeView.state.doc.toJSON().content || EMPTY_RICH_TEXT).map((node) => schema.nodeFromJSON(node))));
        },
      );
      stopDirectEditEvents(editor.view.dom);
      editorState.articleDirectTextEditors.push(editor);
      continue;
    }

    const initialText = source.kind === "stream" ? source.field.textContent : source.input.value;
    target.textContent = String(initialText || "").trim();

    target.classList.add("pm-manuscript-direct-edit", "pm-manuscript-direct-plain-text");
    Object.assign(target, { contentEditable: "plaintext-only" });
    target.setAttribute("role", "textbox");
    target.setAttribute("tabindex", "0");
    stopDirectEditEvents(target);

    target.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        target.blur();
      }
    });
    target.addEventListener("paste", (event) => {
      event.preventDefault();
      document.execCommand("insertText", false, event.clipboardData?.getData("text/plain") || "");
    });
    target.addEventListener("input", () => {
      const activeSource = directEditableSource(target) || source;
      const nextValue = target.textContent.trim();
      if (activeSource.kind !== "stream") {
        activeSource.input.value = nextValue;
        return;
      }

      const schema = activeSource.instance.view.state.schema;
      writeStreamFieldContent(activeSource, Fragment.fromArray((nextValue ? nextValue.split(/\n{2,}/) : [""]).map((paragraphText) => (
        schema.nodes.paragraph.create(null, paragraphText ? schema.text(paragraphText) : null)
      ))));
    });
  }
}

function replaceArticlePreviewHtml(manuscriptRoot, html) {
  const content = manuscriptRoot.querySelector("[data-article-preview-content]");
  if (!content) return false;

  destroyEditorViews(editorState.articleDirectTextEditors);
  destroyEditorViews(editorState.articleRichTextEditors);
  content.innerHTML = html;
  return true;
}

function restoreCurrentArticleControls(manuscriptRoot, streamDocs) {
  setupArticlePreviewEditors(manuscriptRoot, streamDocs);

  const articleBlock = editorState.selectedArticleBlock && findArticleBlock(manuscriptRoot, editorState.selectedArticleBlock);
  if (articleBlock) {
    editorState.selectedArticleBlock = describeArticleBlock(articleBlock) || editorState.selectedArticleBlock;
  } else if (
    editorState.selectedArticleBlock &&
    !articleBlockDescriptors().some((item) => sameArticleBlock(item, editorState.selectedArticleBlock))
  ) {
    editorState.selectedArticleBlock = null;
  }

  showSelectedArticleBlockEditor(editorState.selectedArticleBlock);
  if (articleBlock) {
    articleBlock.classList.add("pm-article-block--selected");
    editorState.articleBlockControls?.setActive?.(articleBlock);
  }
  editorState.commentSidebar?.update();
  editorState.footnoteSidebar?.update();
}
