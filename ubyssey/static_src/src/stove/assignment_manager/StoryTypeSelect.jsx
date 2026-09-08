import storyTypeOptions from './StoryTypeOptions.json'
import Select from 'react-select';


const formatGroupLabel = (data) => (
  <div style={groupStyles}>
    <span>{data.label}</span>
    <span style={groupBadgeStyles}>{data.options.length}</span>
  </div>
);

export function storyTypeLabel(storyTypeValue) {
for (const {value, label} of storyTypeOptions) {
    if (value === storyTypeValue) return label;
}
return "[No label provided]"
}

export default function StoryTypeSelect ({storyType, updateStoryType, styleType="edit-field", disabled}) {

 let style = {
  ...style,
  menu: (base) => ({
    ...base,
    marginTop: "-4px"
  })
 };

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

  const formatOptionLabel = ({ value, label, description }) => (
    <div style={{ display: "grid", gridTemplateColumns: "auto" }}>
      <div>{label}</div>
      <div style={{ color: "#555555", fontSize: "small" }}>
        <i>{description}</i>
      </div>
    </div>
  );

    return <Select 
    isDisabled={disabled}
    options={storyTypeOptions}
    value={storyType ? {"value": storyType, "label": storyTypeLabel(storyType)} : ''}
    onChange={updateStoryType}
    styles={style}
    formatGroupLabel={formatGroupLabel}
    formatOptionLabel={formatOptionLabel}
    components={{
      DropdownIndicator: null, 
      placeholder: "Choose story type..."}}/>
}