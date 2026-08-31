// Preview HTML fetcher helper

export async function fetchPreviewHtml(url, formData, signal = null) {
  const response = await fetch(url, {
    method: "POST",
    body: formData,
    credentials: "same-origin",
    signal,
  });
  const payload = await response.json();
  if (!formData.get("revision")) {
    const eventName = response.ok ? "manuscript-save-succeeded" : "manuscript-save-failed";
    document.dispatchEvent(new Event(eventName));
  }
  return response.ok && payload.html ? payload.html : null;
}
