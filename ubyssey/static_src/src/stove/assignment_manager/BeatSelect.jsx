import Select from 'react-select';

const formatGroupLabel = (data) => (
  <div style={groupStyles}>
    <span>{data.label}</span>
    <span style={groupBadgeStyles}>{data.options.length}</span>
  </div>
);

const groupStyles = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};
const groupBadgeStyles = {
  backgroundColor: '#EBECF0',
  borderRadius: '2em',
  color: '#172B4D',
  display: 'inline-block',
  fontSize: 12,
  fontWeight: 'normal',
  lineHeight: '1',
  minWidth: 1,
  padding: '0.16666666666667em 0.5em',
  textAlign: 'center',
};



function beatLabel(beatPk) {

  for (const {label, options} of beatOptions) {
    for (const beat of options) {
      if (+beatPk === beat.value) return beat.label
    }
  }
  return "[No label provided]"
}


export default function BeatSelect ({beat, updateBeat, styleType="edit-field", disabled}) {

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

    return <Select 
    isDisabled={disabled}
    options={beatOptions}
    value={beat ? {"value": beat, "label": beatLabel(beat)} : ''}
    onChange={updateBeat}
    styles={style}
    formatGroupLabel={formatGroupLabel}
    components={{
      DropdownIndicator: null, 
      placeholder: "Choose beat..."} }/>
}