import { useEffect, useState } from "react";
import AsyncSelect from "react-select/async";

async function fetchOptions(optionsUrl, inputValue, selectedId = "") {
  const url = new URL(optionsUrl, window.location.origin);
  url.searchParams.set("q", inputValue.trim());
  if (selectedId) url.searchParams.set("selected", selectedId);

  const response = await fetch(url, {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  
  if (!response.ok) throw new Error(`Page Search Failed: ${response.status}`);
  const payload = await response.json();
  return payload.options || [];
}

export function PageChooser({ value, optionsUrl, onChange }) {
  const [selected, setSelected] = useState(null);
  const valueId = value == null ? "" : String(value);
  const loadOptions = (inputValue) => fetchOptions(optionsUrl, inputValue);

  useEffect(() => {
    if (!valueId) {
      setSelected(null);
      return;
    }

    let active = true;
    fetchOptions(optionsUrl, "", valueId).then((options) => {
      if (active) {
        setSelected(options.find((option) => option.value === valueId));
      }
    });
    return () => { active = false; };
  }, [valueId, optionsUrl]);

  return (
    <AsyncSelect
      cacheOptions
      defaultOptions
      value={selected}
      className="pm-page-chooser"
      classNamePrefix="pm-page-chooser"
      loadOptions={loadOptions}
      // Allows modal to grow based on dropdown
      styles={{ menu: (base) => ({ ...base, position: "relative" }) }}
      placeholder="Search pages..."
      loadingMessage={() => "Loading pages..."}
      noOptionsMessage={({ inputValue }) => (inputValue ? "No matching pages" : "No pages found")}
      isClearable
      onChange={(option) => {
        setSelected(option);
        onChange(option ? Number(option.value) : null);
      }}
    />
  );
}
