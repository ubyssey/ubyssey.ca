// Preview HTML fetcher helper

export async function fetchPreviewHtml(url, formData, signal = null) {
  const response = await fetch(url, {
    method: "POST",
    body: formData,
    credentials: "same-origin",
    signal,
  });

  if (!formData.get("revision") && !response.ok) {
    document.dispatchEvent(new Event("editor-save-failed"));
  }

  const payload = await response.json();

  return {
    html: response.ok && payload.html ? payload.html : null,
  };
}
