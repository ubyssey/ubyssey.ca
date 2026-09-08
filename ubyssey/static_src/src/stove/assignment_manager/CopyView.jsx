import { useState } from "react";
import { createRoot } from 'react-dom/client';

import { Group, Panel } from "react-resizable-panels";





import NavigationSidebar from "./NavigationSidebar.jsx";
import CopyTable from "./CopyTable.jsx";

import 'bootstrap/dist/css/bootstrap.min.css';

import { ToastContainer } from "react-toastify";

function MainViewSelector({allPages, addPages, updatePage, clearPages}) {

  return (
        <CopyTable 
          updatePage={updatePage}
          clearPages={clearPages}
          allPages={allPages}
          addPages={addPages}
        />
  );
}

function MainPanel({allPages, addPages, updatePage, clearPages}) {
  return (
    <div className="main-panel">
      <MainViewSelector 
          allPages={allPages} 
          addPages={addPages}
          updatePage={updatePage}
          clearPages={clearPages}/>
    </div>
  )
}



function StoriesTracker() {
  const [allPages, setAllPages] = useState(
    pages
  );

  function updatePage(newPage) {
    const updatedPages = new Map(allPages)
    updatedPages.set(newPage.pk, newPage)
    setAllPages(updatedPages)
  }

  function addPages(newPages) {
      setAllPages(currentPages => {
        const updatedPages = new Map(currentPages)
        for (const page of newPages) {
          updatedPages.set(page.pk, page)
        }
        return updatedPages;
    });

  }

  function clearPages() {
    setAllPages(new Map)
  }


  return (
      <div className="content-tracker">
        <Group className="grouping">
        <NavigationSidebar/>
        <Panel className="panel main-content-panel" minSize="1100px" defaultSize="80%">
            <MainPanel 
              allPages={allPages} 
              addPages={addPages}
              updatePage={updatePage}
              clearPages={clearPages}
            />
        </Panel>
      </Group>
      <ToastContainer />
      </div>
  );
}

const container = document.getElementById('content-tracker');
const root = createRoot(container); 
root.render(<StoriesTracker />);