import DatePicker from 'react-datepicker';

export default function DateInput ({date, handleUpdateDate, disabled, className}) {
  return <div className={className}><DatePicker
    disabled={disabled}
    selected={date ? new Date(date) : undefined}
    onChange={(newDate) => {
      handleUpdateDate(newDate)
    } }
    showTimeSelect
    timeFormat="h:mm aa"
    timeIntervals={30}
    timeCaption="time"
    dateFormat="MMMM d, h:mm aa"
    placeholderText="Add deadline"
  /></div>;
};