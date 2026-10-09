import { fetchRevisions, restoreRevision, saveRevision } from "./api.js";

// TODO: potentially rename when we fix prosemirror/yjs history

// Lazy loading Revision History
async function loadRevisionHistory(form, historySelect) {
  if (!form.dataset.historyUrl || !historySelect) return;

  try {
    const revisions = await fetchRevisions(form.dataset.historyUrl);

    // Current draft option in revision dropdown
    const currentOption = document.createElement("option");
    currentOption.value = "";
    currentOption.textContent = "Current draft";

    const options = revisions.map((revision) => {
      const option = document.createElement("option");
      option.value = revision.id;
      option.textContent = revision.label;
      return option;
    });

    historySelect.replaceChildren(currentOption, ...options);
    historySelect.disabled = false;
  } catch (error) {
    console.error(error);
    historySelect.options[0].textContent = "Failed to fetch history";
  }
}

export function setupRevisionHistory(form, { formDataBeforeRestore, onHistoryModeChange, onPreviewRevision }) {
  const historyButtons = document.querySelectorAll("[data-history-button]");
  const historySelect = document.querySelector("[data-history-select]");
  const restoreButton = document.querySelector("[data-history-restore]");
  const returnButton = document.querySelector("[data-history-return]");
  if (!form) return;
  loadRevisionHistory(form, historySelect);
  // Updates 2500ms after full preview
  form.addEventListener("submit", () => {
    const delay = 2500;
      window.setTimeout(() => {
        loadRevisionHistory(form, historySelect);
      }, delay);
  });

  form.addEventListener("editor:revision-saved", () => loadRevisionHistory(form, historySelect));

  const selectedRevision = () => historySelect?.value || "";
  const selectedRevisionIsCurrent = () => !historySelect || historySelect.value === "";
  const updateHistoryMode = () => {
    onHistoryModeChange(!selectedRevisionIsCurrent());
    if (restoreButton) restoreButton.disabled = selectedRevisionIsCurrent();
  };

  historySelect.addEventListener("change", (event) => {
    event.stopPropagation();
    updateHistoryMode();
    onPreviewRevision(historySelect.value, selectedRevisionIsCurrent());
  });

  returnButton.addEventListener("click", () => {
    historySelect.selectedIndex = 0;
    historySelect.dispatchEvent(new Event("change", { bubbles: true }));
  });

  restoreButton.addEventListener("click", async () => {
    const revisionId = selectedRevision();
    if (!form.dataset.restoreUrl || selectedRevisionIsCurrent()) return;
    if (!window.confirm("Restore this version as the current draft?")) return;

    const originalText = restoreButton.textContent;
    restoreButton.disabled = true;
    restoreButton.textContent = "Restoring...";
    try {
      const formData = formDataBeforeRestore();
      formData.set("revision", revisionId);
      const payload = await restoreRevision(form.dataset.restoreUrl, formData);
      if (payload.errors) {
        const message = Object.entries(payload.errors)
          .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(", ") : messages}`)
          .join("\n");
        alert(message);
        return;
      }
      window.location.reload();
    } catch (error) {
      console.error(error);
      alert("Failed to restore version.");
    } finally {
      restoreButton.textContent = originalText;
      updateHistoryMode();
    }
  });

  updateHistoryMode();

  for (const btn of historyButtons) {
    btn.addEventListener("click", () => { onPreviewRevision(btn.dataset.revisionId, false); });
  }
}

export function setupManualRevisionSave(form, { formDataForSave }) {
  const saveButton = form?.querySelector("[data-save-revision]");
  if (!saveButton || !form.dataset.saveRevisionUrl) return;

  saveButton.addEventListener("click", async () => {
    const originalText = saveButton.textContent;
    let saved = false;
    saveButton.disabled = true;
    saveButton.textContent = "Saving...";

    try {
      const payload = await saveRevision(form.dataset.saveRevisionUrl, formDataForSave());
      if (payload.errors) {
        const message = Object.entries(payload.errors)
          .map(([field, messages]) => {
            const text = Array.isArray(messages) ? messages.join(", ") : messages;
            return field === "__all__" ? text : field + ": " + text;
          })
          .join("\n");
        alert(message);
        return;
      }
      saved = true;
      saveButton.textContent = "Saved";

      form.dispatchEvent(new CustomEvent("editor:revision-saved"));

      window.setTimeout(() => {
        if (!saveButton.disabled) saveButton.textContent = originalText;
      }, 2000);
    } catch (error) {
      console.error(error);
      alert("Failed to save revision");
    } finally {
      saveButton.disabled = false;

      if (!saved) saveButton.textContent = originalText;
    }
  });
}

export function setupWagtailHandoff(form, { formDataForSave, beforeSave = () => {} }) {
  const wagtailButton = form?.querySelector("[data-view-wagtail]");
  if (!wagtailButton || !form.dataset.saveRevisionUrl || !wagtailButton.dataset.wagtailUrl) return;

  wagtailButton.addEventListener("click", async () => {
    const originalText = wagtailButton.textContent;
    wagtailButton.disabled = true;
    wagtailButton.textContent = "Saving...";

    try {
      await beforeSave();
      const formData = formDataForSave();
      formData.set("handoff_to_wagtail", "1");
      const payload = await saveRevision(form.dataset.saveRevisionUrl, formData);
      
      if (payload.errors) {
        const message = Object.entries(payload.errors)
          .map(([field, messages]) => {
            const text = Array.isArray(messages) ? messages.join(", ") : messages;
            return field === "__all__" ? text : field + ": " + text;
          })
          .join("\n");
        alert(message);
        return;
      }

      form.dispatchEvent(new CustomEvent("editor:revision-saved"));
      window.location.assign(wagtailButton.dataset.wagtailUrl);
    } catch (error) {
      console.error(error);
      alert("Failed to save revision");
    } finally {
      wagtailButton.textContent = originalText;
      wagtailButton.disabled = false;
    }
  });
}
