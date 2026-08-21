// Fetches author options

let authorOptionsRequest = null;

export function fetchAuthorOptions(form) {
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
