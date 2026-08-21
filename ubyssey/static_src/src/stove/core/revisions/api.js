// Revisions API

export async function fetchRevisions(url) {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(`History request failed with status ${response.status}`);
  }

  return payload.revisions || [];
}

export async function restoreRevision(url, formData) {
  const response = await fetch(url, {
    method: "POST",
    body: formData,
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "X-Requested-With": "XMLHttpRequest",
    },
  });
  const payload = await response.json();

  if (!response.ok && !payload.errors) {
    return { errors: { revision: ["Failed to restore version."] } };
  }

  return payload;
}
