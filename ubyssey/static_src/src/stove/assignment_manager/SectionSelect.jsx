import Select from 'react-select';



function findSection(sectionSlug) {
    for (const s of allSections) {
      if (s.slug == sectionSlug) return s
    }
    return undefined
  }

export default function SectionSelect ({section, updateSection, styleType="edit-field", disabled=false}) {

  let style = {};

  if (styleType == "edit-field") {
    style = {
      ...style, 
      control: (base) => ({
        ...base,
        border: "none",
        backgroundColor: "inherit",
      }),
      valueContainer: (base) => ({
        ...base,
        padding: "5px",
        ':hover': {
          backgroundColor: "var(--hover-color)"
        }
      }),
      selectContainer: (base) => ({
        ...base,
        padding: "0",
        margin: "0",
      }), 
      container: (base) => ({
        ...base,
        maxWidth: "20em",
      })
    }
  }

  if (disabled) {
    style = {
      ...style,
      container: (base) => ({
        ...base,
        pointerEvents: "auto",
      }),
      valueContainer: (base) => ({
        ... base,
        ':hover': {
          cursor: "not-allowed",
          backgroundColor: "var(--invalid-hover-color)"
        },
        ':active': {
          pointerEvents: "none",
          backgroundColor: "var(--invalid-hover-color)"
        }
      }),
      singleValue: (base) => ({
        ...base,
        color: "inherit"
      })
    }
  }

  return <Select 
    options={allSections}
    value={ section ? findSection(section) : ''}
    isDisabled={disabled}
    onChange={updateSection}
    styles={style}
    components={{
      DropdownIndicator: null, 
      placeholder: "Choose section..."} }/>
}