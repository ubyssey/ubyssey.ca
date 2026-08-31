import Select from 'react-select';
import statuses from './statuses.json'


const articleStatusStyles = {
  control: (styles) => ({ ...styles, backgroundColor: 'white' }),
  option: (styles, { data, isDisabled, isFocused, isSelected }) => {
    const color = chroma(data.color);
    return {
      ...styles,
      backgroundColor: isDisabled
        ? undefined
        : isSelected
        ? data.color
        : isFocused
        ? color.alpha(0.1).css()
        : undefined,
      color: isDisabled
        ? '#ccc'
        : isSelected
        ? chroma.contrast(color, 'white') > 2
          ? 'white'
          : 'black'
        : data.color,
      cursor: isDisabled ? 'not-allowed' : 'default',

      ':active': {
        ...styles[':active'],
        backgroundColor: !isDisabled
          ? isSelected
            ? data.color
            : color.alpha(0.3).css()
          : undefined,
      },
    };
  }
}

export default function ArticleStatus ({status, updateStatus}) {

  
  return <Select 
    className="status-select"
    options={Object.values(statuses).slice(0, -1)} 
    value={statuses[status]} 
    styles={{
      singleValue: (base) => ({
        ...base,
        padding: 5,
        borderRadius: 5,
        background: statuses[status].color,
        color: statuses[status].textColor,
        fontWeight: "bold",
        textAlign: "center",
      }),
      valueContainer: (base) => ({
        ...base,
        padding: 0,
      }),
      control: (base) => ({
        ...base,
        border: "none",
        background: "none",
        boxShadow: "none",
      }),
      menu: (base) => ({
        ...base,
        marginTop: "-4px"
      })
    }}
    onChange={updateStatus}
    isDisabled= {status==6}
    components={{
      DropdownIndicator: null, 
      placeholder: "Select status..."}}  
  />;
}