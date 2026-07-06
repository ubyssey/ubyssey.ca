import { useState, useEffect } from "react";
import { createRoot } from 'react-dom/client';
import 'react-data-grid/lib/styles.css';

import { DataGrid } from 'react-data-grid';

function MultiSelect() {
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
      timeIntervals={15}
      timeCaption="time"
      dateFormat="MMMM d, yyyy h:mm aa"
    />;
}

const AuthorsSelect = () => (
  <Select options={authors} isMulti />
)


const columns = [
  { key: 'id', name: 'ID' },
  { key: 'title', name: 'Title' }
];

const rows = [
  { id: 0, title: 'Example' },
  { id: 1, title: 'Demo' }
];

function MainContentTracker() {
    console.log("here")
    return <DataGrid columns={columns} rows={rows} />;
}

function ContentTrackerSidebar() {
    return <></>
}

const ContentTracker = () => {
    return <>
    <MainContentTracker />
    <ContentTrackerSidebar />
    </>
}

const container = document.getElementById('content-tracker');
const root = createRoot(container); // createRoot(container!) if you use TypeScript
root.render(<MainContentTracker />);
