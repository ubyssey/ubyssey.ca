import { useState, useEffect } from "react";
import { createRoot } from 'react-dom/client';
import Select from 'react-select';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import chroma from 'chroma-js';


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
const chosenColor = '#FFD230'

const colourStyles = {
    control: (styles) => ({ ...styles, backgroundColor: chosenColor }),
    option: (styles, { data, isDisabled, isFocused, isSelected }) => {
    const chromaColor = chroma('#FFD230');
    return {
      ...styles,
      backgroundColor: isDisabled
        ? undefined
        : isSelected
        ? chosenColor
        : isFocused
        ? chromaColor.alpha(0.1).css()
        : undefined,
      color: isDisabled
        ? '#ccc'
        : isSelected
        ? chroma.contrast(chromaColor, 'white') > 2
          ? 'white'
          : 'black'
        : chosenColor,
      cursor: isDisabled ? 'not-allowed' : 'default',

      ':active': {
        ...styles[':active'],
        backgroundColor: !isDisabled
          ? isSelected
            ? chosenColor
            : chromaColor.alpha(0.3).css()
          : undefined,
      },
    };
  },
};


const AuthorsSelect = () => (
  <Select options={authors} isMulti />
)



const formatGroupLabel = (data) => (
  <div style={groupStyles}>
    <span>{data.label}</span>
    <span style={groupBadgeStyles}>{data.options.length}</span>
  </div>
);


function MultiSelect() {
    console.log("huh?")
    return (
        <div className="w-tabs" data-tabs="">
           <AuthorsSelect />
           <Select options={beatOptions} formatGroupLabel={formatGroupLabel} styles={colourStyles}/>
           <ShowTime />
        </div>
    );
}


const ShowTime = () => {
  const [selectedDateTime, setSelectedDateTime] = useState(
    new Date()
  );

  return <DatePicker
    selected={selectedDateTime}
    onChange={setSelectedDateTime}
    showTimeSelect
    timeFormat="HH:mm"
    timeIntervals={30}
    timeCaption="time"
    dateFormat="MMMM d, yyyy h:mm aa"
  />;
};

const container = document.getElementById('content-tracker-select');
const root = createRoot(container); // createRoot(container!) if you use TypeScript
root.render(<MultiSelect />);
