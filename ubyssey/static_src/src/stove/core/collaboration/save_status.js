// Topbar save status indicator

function formatSavedAt(date) {
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function setupPageSaveStatus(collaboration, onChange = () => {}) {
  const savedStatus = document.querySelector("[data-page-saved]");
  let saveFailed = false;

  const updateSavingStatus = (_update, origin) => {
    if (origin === collaboration.provider) return;
    savedStatus.textContent = "Saving...";
    onChange();
  };

  const updateSavedStatus = () => {
    if (saveFailed) return;
    const savedAt = new Date();
    savedStatus.dataset.lastSavedAt = savedAt.toISOString();
    savedStatus.textContent = "Saved: " + formatSavedAt(savedAt);
    onChange();
  };

  const saveFailedHandler = () => {
    saveFailed = true;
    savedStatus.textContent = "Failed to save. Undo your last change, contact webmaster if this isn't resolved.";
    onChange();
  };

  const saveSucceededHandler = () => {
    saveFailed = false;
    updateSavedStatus();
  };

  document.addEventListener("editor-save-failed", saveFailedHandler);
  document.addEventListener("editor-save-succeeded", saveSucceededHandler);
  collaboration.ydoc.on("update", updateSavingStatus);
  collaboration.provider?.on("persistence-ack", updateSavedStatus);
}
