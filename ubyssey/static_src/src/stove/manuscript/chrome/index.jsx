// Non-prosemirror interface like settings and media modals, and author interface

// todo: maybe look at react modal libraries, as I keep on reimplementing them here

import { useEffect } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import Select from "react-select";
import AsyncSelect from "react-select/async";

// Sends author events to collab below in useArticleAuthorsPanel
import { AUTHORS_CHANGED_EVENT, AUTHORS_UPDATED_EVENT, setupMetadataCollaboration } from "../collab/metadata/index.js";

// Non hidden inputs
const focusableSelector = "input:not([type='hidden']), select, textarea, button";

// Creates eventlistener, and returns cleanup function
// see useMediaAndSettingsModals
function on(target, eventName, callback, options) {
  if (!target) return () => {};
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

let authorOptionsRequest;

function fetchAuthorOptions(form) {
  if (!authorOptionsRequest) {
    authorOptionsRequest = fetch(form.dataset.authorsUrl, {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    }).then(async (response) => {
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(`Authors request failed status ${response.status}`);
      }
      return payload;
    });
  }

  return authorOptionsRequest;
}

function useArticleAuthorsPanel() {
  useEffect(() => {
    const panel = document.querySelector("[data-article-authors-panel]");
    if (!panel) return undefined;

    const rows = panel.querySelector("[data-article-author-rows]");
    const form = panel.closest("form");
    const selectRoots = new Map();
    const notifyChanged = () => {
      panel.dispatchEvent(new Event(AUTHORS_CHANGED_EVENT, { bubbles: true }));
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
          isDisabled={select.dataset.authorsLoading === "true"}
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

    const applyCollaborativeRows = (event) => {
      const existingRow = rows.querySelector("[data-article-author-row]");
      if (!existingRow) return;

      const template = existingRow.cloneNode(true);
      template.querySelector(".pm-author-panel__select")?.remove();
      selectRoots.forEach((root) => root.unmount());
      selectRoots.clear();
      rows.replaceChildren();

      const collaborativeRows = event.detail?.length ? event.detail : [{ authorId: "", role: "author" }];
      collaborativeRows.forEach((item) => {
        const row = template.cloneNode(true);
        row.querySelector(".pm-author-panel__select")?.remove();
        const authorSelect = row.querySelector("[data-article-author-select]");
        const roleSelect = row.querySelector("[name='article_authors-role']");
        const authorId = String(item.authorId || "");

        authorSelect.dataset.selectedAuthorId = authorId;
        authorSelect.value = authorId;
        roleSelect.value = item.role || "author";
        rows.appendChild(row);
        setupAuthorSelect(authorSelect);
      });
    };

    panel.querySelectorAll("[data-article-author-select]").forEach(setupAuthorSelect);
    const refreshAuthorSelect = (select) => {
      const container = select.nextElementSibling;
      const root = selectRoots.get(container);
      if (root) {
        root.unmount();
        selectRoots.delete(container);
        container.remove();
      }
      setupAuthorSelect(select);
    };

    const loadAuthorOptions = async () => {
      try {
        const payload = await fetchAuthorOptions(form);

        const options = [
          { value: "", label: "Select author" },
          ...(payload.authors || []).map((author) => ({ value: author.id, label: author.label })),
        ];

        panel.querySelectorAll("[data-article-author-select]").forEach((select) => {
          const selectedAuthorId = select.dataset.selectedAuthorId || "";
          select.replaceChildren(...options.map((item) => {
            const option = document.createElement("option");
            option.value = item.value;
            option.textContent = item.label;
            return option;
          }));
          select.value = selectedAuthorId;
          delete select.dataset.authorsLoading;
          refreshAuthorSelect(select);
        });
      } catch (error) {
        console.error(error);
        panel.querySelectorAll("[data-article-author-select]").forEach((select) => {
          select.options[0].textContent = "Failed to fetch authors";
          refreshAuthorSelect(select);
        });
      }
    };

    loadAuthorOptions();

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
          const authorSelect = row.querySelector("[data-article-author-select]");
          authorSelect.dataset.selectedAuthorId = "";
          authorSelect.value = "";
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
            authorSelect.dataset.selectedAuthorId = "";
            authorSelect.value = "";
            setupAuthorSelect(authorSelect);
          } else {
            row.remove();
          }
        }

        notifyChanged();
      }),
      on(panel, "change", notifyChanged),
      // Handles incoming author updated above sends
      on(panel, AUTHORS_UPDATED_EVENT, applyCollaborativeRows),
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
    const coverModal = document.querySelector("[data-manuscript-cover-modal]");
    const guideModal = document.querySelector("[data-manuscript-guide-modal]");
    const uploadModal = document.querySelector("[data-article-media-upload-modal]");
    const galleryModal = document.querySelector("[data-article-media-gallery-modal]");
    const uploadTitle = document.querySelector("[data-article-media-upload-title]");
    const kind = form.elements.namedItem("article_media-kind");
    let uploadReturnsToGallery = false;
    // Sometimes there are layered modals
    const existingMediaModal = document.querySelector("[data-article-media-existing-modal]");
    const existingKind = document.querySelector("[data-article-media-existing-kind]");
    const existingSelectMount = document.querySelector("[data-article-media-existing-select]");
    const existingAddButton = document.querySelector("[data-article-media-existing-add]");
    const existingSelectRoot = createRoot(existingSelectMount);
    let existingMediaSearchController = null;
    let existingMediaSearchTimer = null;
    let resolvePendingExistingMediaSearch = null;
    let tagOptions = [];
    let tagOptionsStatus = "loading";
    let pendingTags = [];
    const tagField = form.querySelector("#id_article_media-tags");
    const tagSelectMount = document.createElement("div");
    const tagSelectRoot = createRoot(tagSelectMount);
    const authorSelectMount = document.createElement("div");
    const authorSelectRoot = createRoot(authorSelectMount);
    let existingSelection = null;

    const mediaField = (name) => form.querySelector(`#id_article_media-${name}`);
    const mediaAuthorField = form.querySelector("[data-article-media-author-select]");
    const renderAuthorSelect = (options, isDisabled = false) => {
      authorSelectRoot.render(
        <Select
          classNamePrefix="article-media-author-select"
          isDisabled={isDisabled}
          options={options}
          placeholder={isDisabled ? "Loading authors" : "Select author"}
          value={options.find((option) => String(option.value) === String(mediaAuthorField.value)) || null}
          onChange={(option) => {
            mediaAuthorField.value = option?.value || "";
            mediaAuthorField.dispatchEvent(new Event("change", { bubbles: true }));
          }}
        />,
      );
    };
    mediaAuthorField.hidden = true;
    mediaAuthorField.parentNode.insertBefore(authorSelectMount, mediaAuthorField.nextSibling);
    renderAuthorSelect([], true);
    let mediaAuthorsLoaded = false;
    const mediaAuthorOptionsReady = fetchAuthorOptions(form).then((payload) => {
      const selectedAuthorId = mediaAuthorField.dataset.pendingValue ?? mediaAuthorField.value;
      const options = [
        { value: "", label: "Select author" },
        ...(payload.authors || []).map((author) => ({ value: author.id, label: author.label })),
      ];

      mediaAuthorField.replaceChildren(...options.map((option) => new Option(option.label, option.value)));
      mediaAuthorField.value = selectedAuthorId;
      mediaAuthorsLoaded = true;
      delete mediaAuthorField.dataset.pendingValue;
      renderAuthorSelect(options);
      return true;
    }).catch((error) => {
      console.error(error);
      mediaAuthorField.options[0].textContent = "Failed to fetch authors";
      renderAuthorSelect([], true);
      return false;
    });

    const setTags = (tags) => {
      pendingTags = tags.filter(Boolean);
      const selectedTags = tagOptions.filter((option) => tags.includes(option.value));
      const fieldTags = tagOptionsStatus === "loaded" ? selectedTags.map((option) => option.value) : pendingTags;
      tagField.value = fieldTags.join(", ");
      tagSelectRoot.render(
        <Select
          isMulti
          isDisabled={tagOptionsStatus !== "loaded"}
          classNamePrefix="article-media-tag-select"
          options={tagOptions}
          placeholder={tagOptionsStatus === "failed" ? "Failed to fetch tags" : "Loading tags"}
          value={selectedTags}
          onChange={(options) => setTags(options.map((option) => option.value))}
        />,
      );
    };
    tagField.hidden = true;
    tagField.parentNode.insertBefore(tagSelectMount, tagField.nextSibling);
    setTags([]);
    fetch(form.dataset.mediaTagsUrl, {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    }).then(async (response) => {
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(`Media tags request failed status ${response.status}`);
      }
      tagOptions = payload.tags || [];
      tagOptionsStatus = "loaded";
      setTags(pendingTags);
    }).catch((error) => {
      console.error(error);
      tagOptionsStatus = "failed";
      setTags(pendingTags);
    });

    const setUploadMode = (mode) => {
      const editing = mode === "edit";
      uploadTitle.textContent = editing ? "Edit media" : "Upload media";
      uploadButton.textContent = editing ? "Save" : "Upload";
    };
    const reset = () => {
      form.querySelectorAll("[name^='article_media-']").forEach((field) => {
        if (field !== kind) field.value = "";
      });
      setTags([]);
      renderAuthorSelect(Array.from(mediaAuthorField.options).map((option) => ({ value: option.value, label: option.text })), !mediaAuthorsLoaded);
      delete mediaAuthorField.dataset.pendingValue;
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

    const cancelExistingMediaSearch = () => {
      if (existingMediaSearchTimer) window.clearTimeout(existingMediaSearchTimer);
      existingMediaSearchTimer = null;

      if (existingMediaSearchController) existingMediaSearchController.abort();
      existingMediaSearchController = null;

      if (resolvePendingExistingMediaSearch) resolvePendingExistingMediaSearch([]);
      resolvePendingExistingMediaSearch = null;
    };

    const loadExistingMediaOptions = (inputValue) => new Promise((resolve) => {
      cancelExistingMediaSearch();
      resolvePendingExistingMediaSearch = resolve;

      // Timer so that it doesn't search per character if typing fast
      existingMediaSearchTimer = window.setTimeout(async () => {
        existingMediaSearchTimer = null;

        const controller = new AbortController();
        existingMediaSearchController = controller;
        const url = new URL(form.dataset.mediaOptionsUrl, window.location.origin);
        url.searchParams.set("kind", existingKind.value);
        url.searchParams.set("q", inputValue.trim());

        try {
          const response = await fetch(url, {
            credentials: "same-origin",
            headers: { Accept: "application/json" },
            signal: controller.signal,
          });
          const payload = await response.json();
          if (!response.ok) throw new Error("Media Search Failed: " + response.status);
          resolve(payload.options || []);
        } catch (error) {
          if (error.name !== "AbortError") console.error(error);
          resolve([]);
        } finally {
          if (existingMediaSearchController === controller) existingMediaSearchController = null;
          if (resolvePendingExistingMediaSearch === resolve) resolvePendingExistingMediaSearch = null;
        }
      }, 250);
    });

    const renderExistingMediaSelect = () => {
      cancelExistingMediaSearch();
      existingSelection = null;
      existingAddButton.disabled = true;
      flushSync(() => {
        existingSelectRoot.render(
          <AsyncSelect
            key={existingKind.value}
            cacheOptions
            defaultOptions
            classNamePrefix="article-media-existing-select"
            loadOptions={loadExistingMediaOptions}
            placeholder="Search media..."
            loadingMessage={() => "Loading media..."}
            noOptionsMessage={({ inputValue }) => (inputValue ? "No matching media" : "No media found")}
            onChange={(option) => {
              existingSelection = option;
              existingAddButton.disabled = !option;
            }}
          />,
        );
      });
    };

    const closeExisting = () => {
      cancelExistingMediaSearch();
      setModalOpen(existingMediaModal, false);
      existingMediaModal.classList.remove("article-media-modal--stacked");
      existingSelection = null;
      existingAddButton.disabled = true;
      window.requestAnimationFrame(() => {
        galleryModal.querySelector("[data-article-media-edit-button], a, button").focus();
      });
    };

    const applyMediaResponse = (payload) => {
      document.querySelector("[data-article-media-gallery]").outerHTML = payload.gallery;
      const selector = `.pm-control-field--${payload.item.kind} select${payload.item.kind === "image" ? ",select[name='featured_media-image']" : ""}`;
      document.querySelectorAll(selector).forEach((select) => {
        const existingOption = Array.from(select.options).find((item) => String(item.value) === String(payload.item.id));
        const option = existingOption || select.appendChild(new Option());
        option.value = payload.item.id;
        option.textContent = payload.item.title;
      });
    };

    syncImageFields();

    const cleanups = [
      on(document.querySelector("[data-manuscript-open-guide]"), "click", () => {
        setModalOpen(guideModal, true, guideModal.querySelector(focusableSelector));
      }),
      on(document.querySelector("[data-manuscript-open-cover]"), "click", () => {
        setModalOpen(coverModal, true, coverModal.querySelector(focusableSelector));
      }),
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
      on(document.querySelector("[data-article-media-open-existing]"), "click", () => {
        existingMediaModal.classList.add("article-media-modal--stacked");
        renderExistingMediaSelect();
        setModalOpen(existingMediaModal, true, existingKind);
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
          const value = card.dataset[name] || "";
          if (name === "author" && !mediaAuthorsLoaded) {
            field.dataset.pendingValue = value;
          }
          field.value = value;
        });
        setTags((card.dataset.tags || "").split(",").map((tag) => tag.trim()));
        renderAuthorSelect(Array.from(mediaAuthorField.options).map((option) => ({ value: option.value, label: option.text })), !mediaAuthorsLoaded);
        mediaField("file").value = "";
        form.dataset.articleMediaEditKind = card.dataset.kind;
        setUploadMode("edit");
        syncImageFields();
        uploadReturnsToGallery = !galleryModal.hidden;
        uploadModal.classList.toggle("article-media-modal--stacked", uploadReturnsToGallery);
        setModalOpen(uploadModal, true, mediaField("title"));
      }),
      ...Array.from(document.querySelectorAll("[data-article-media-close], [data-manuscript-settings-close], [data-manuscript-cover-close], [data-manuscript-guide-close]")).map((button) => (
        on(button, "click", () => {
          const modal = button.closest("[data-manuscript-settings-modal], [data-article-media-upload-modal], [data-article-media-existing-modal], [data-article-media-gallery-modal], [data-manuscript-cover-modal], [data-manuscript-guide-modal]");
          if (modal === uploadModal) closeUpload();
          else if (modal === existingMediaModal) closeExisting();
          else setModalOpen(modal, false);
        })
      )),
      on(document, "keydown", (event) => {
        if (event.key !== "Escape") return;
        if (!uploadModal.hidden) closeUpload();
        else if (!existingMediaModal.hidden) closeExisting();
        else if (!galleryModal.hidden) setModalOpen(galleryModal, false);
        else if (!settingsModal.hidden) setModalOpen(settingsModal, false);
        else if (!coverModal.hidden) setModalOpen(coverModal, false);
        else if (!guideModal.hidden) setModalOpen(guideModal, false);
      }),
      on(kind, "change", syncImageFields),
      on(existingKind, "change", renderExistingMediaSelect),
      on(uploadButton, "click", async () => {
        uploadButton.disabled = true;
        try {
          const authorsAvailable = await mediaAuthorOptionsReady;
          if (!authorsAvailable && mediaField("media_id").value) {
            window.alert("Cannot edit media until authors are loaded. Though it probably shouldn't be taking this long.");
            return;
          }
          const response = await fetch(form.dataset.mediaUploadUrl, { method: "POST", body: new FormData(form) });
          const payload = await response.json();
          if (!response.ok) {
            window.alert(`Upload failed: ${JSON.stringify(payload.errors || payload)}`);
            return;
          }

          applyMediaResponse(payload);

          closeUpload();
        } catch (error) {
          window.alert("Upload failed.");
        } finally {
          uploadButton.disabled = false;
        }
      }),
      on(existingAddButton, "click", async () => {
        if (!existingSelection) return;
        existingAddButton.disabled = true;
        const data = new FormData();
        data.set("csrfmiddlewaretoken", form.elements.namedItem("csrfmiddlewaretoken").value);
        data.set("kind", existingKind.value);
        data.set("media_id", existingSelection.value);
        try {
          const response = await fetch(form.dataset.mediaExistingUrl, { method: "POST", body: data });
          const payload = await response.json();
          if (!response.ok) {
            window.alert(`Add failed: ${JSON.stringify(payload.errors || payload)}`);
            return;
          }
          applyMediaResponse(payload);
          closeExisting();
        } catch (error) {
          window.alert("Add failed.");
        } finally {
          existingAddButton.disabled = !existingSelection;
        }
      }),
    ];
    return () => {
      cleanups.forEach((cleanup) => cleanup());
      cancelExistingMediaSearch();
      existingSelectRoot.unmount();
      tagSelectRoot.unmount();
      authorSelectRoot.unmount();
    };
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

function ManuscriptChrome({ form, metadata, schedulePreview, writeBeforeSave }) {
  usePageFieldToggles(form, schedulePreview);
  useArticleAuthorsPanel();
  useEffect(() => setupMetadataCollaboration(form, metadata), [form, metadata]);
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
