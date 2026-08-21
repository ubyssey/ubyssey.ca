import { fetchRevisions, restoreRevision } from "./api.js";

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
