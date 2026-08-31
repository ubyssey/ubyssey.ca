import { useState } from "react";
import { createRoot } from 'react-dom/client';

import { Group, Panel, Separator} from "react-resizable-panels";


import Tab from 'react-bootstrap/Tab';
import Tabs from 'react-bootstrap/Tabs';


import NavigationSidebar from "./assignment_manager/NavigationSidebar.jsx";
import StorySidebar, {SIDEBAR_TYPES} from "./assignment_manager/StorySidebar.jsx";
import StoryTable from "./assignment_manager/StoryTable.jsx";

import 'bootstrap/dist/css/bootstrap.min.css';

import { ToastContainer } from "react-toastify";

function MainViewSelector({allPages, addPages, updatePage, clearPages, selectedArticleId, setSelectedArticleId, setActiveSidebar}) {

  return (
    <Tabs
      defaultActiveKey="list"
      transition={false}
      id="noanim-tab-example"
      className="mb-3"
    >
      <Tab eventKey="list" title="List" >
        <StoryTable 
          updatePage={updatePage}
          selectedArticleId={selectedArticleId}
          setActiveSidebar={setActiveSidebar}
          clearPages={clearPages}
          allPages={allPages}
          setSelectedArticleId={setSelectedArticleId}
          addPages={addPages}
        />
      </Tab>
      <Tab eventKey="calendar" title="Calendar" disabled>
        Tab content for Calendar
      </Tab>
    </Tabs>
  );
}

function MainPanel({allPages, addPages, updatePage, clearPages, selectedArticleId, setSelectedArticleId, setActiveSidebar}) {
  return (
    <div className="main-panel">
      <MainViewSelector 
          allPages={allPages} 
          addPages={addPages}
          updatePage={updatePage}
          clearPages={clearPages}
          selectedArticleId={selectedArticleId}
          setSelectedArticleId={setSelectedArticleId}
          setActiveSidebar={setActiveSidebar}/>
    </div>
  )
}



function StoriesTracker() {
  const [allPages, setAllPages] = useState(
    pages
  );
  const [activeSidebar, setActiveSidebar] = useState(SIDEBAR_TYPES.CREATE);

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

  const [selectedArticleId, setSelectedArticleId] = useState(
    -1
  );

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
              selectedArticleId={selectedArticleId}
              setSelectedArticleId={setSelectedArticleId}
              setActiveSidebar={setActiveSidebar}
            />
        </Panel>
        <Separator className="sidebar-resize-handle"/>
        <Panel className="panel content-sidebar" collapsible minSize={275} maxSize={"40vw"}>
          <StorySidebar 
            selectedPage={allPages.get(selectedArticleId)}
            updatePage={updatePage}
            createPage={(page) => {
              const newPages = new Map()
              newPages.set(page.pk, page)
              setAllPages(new Map([...newPages, ...allPages]))
            }}
            activeSidebar={activeSidebar}
            setActiveSidebar={setActiveSidebar}
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