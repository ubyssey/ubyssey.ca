import { useEffect, useState } from "react";
import { createRoot } from 'react-dom/client';
import { useViewport } from 'react-viewport-hooks';


import { Group, Panel, Separator, usePanelRef} from "react-resizable-panels";


import Tab from 'react-bootstrap/Tab';
import Tabs from 'react-bootstrap/Tabs';


import NavigationSidebar from "./NavigationSidebar.jsx";
import StorySidebar, {SIDEBAR_TYPES} from "./StorySidebar.jsx";
import StoryTable from "./StoryTable.jsx";

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
  const [editSidebarCollapsed, setEditSidebarCollapsed] = useState(true);

  const sidebarRef = usePanelRef()
  const tableRef = usePanelRef()

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

  const { vw } = useViewport();

  let layout = 'standard';
  if (vw < 1200) {
      layout = 'collapsed';
  }

  const openSidebar = () => {
    const sidebarPanel = sidebarRef.current;
    sidebarPanel.resize("450px");
  }
  const closeSidebar = () => {
    const sidebarPanel = sidebarRef.current;
    const tablePanel = tableRef.current;
    tablePanel?.expand();
    sidebarPanel?.collapse();
  }
  const toggle = () => {
    const sidebarPanel = sidebarRef.current;
    console.log(sidebarPanel?.isCollapsed())
    if (sidebarPanel?.isCollapsed()) {
      openSidebar()
    } else {
      closeSidebar()
    }
  };

  useEffect(openSidebar, [selectedArticleId])

  return (
      <div className="content-tracker">
        <Group className="grouping">
        <NavigationSidebar/>
        <Panel className="panel main-content-panel" 
            minSize={ layout == 'standard' ? "900px" : "0px" }
            collapsible = {layout == 'collapsed'}
            collapsedSize={"0px"}
            defaultSize="80%"
            panelRef={tableRef}>
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
        <button onClick={toggle} className="sidebar-button">{!editSidebarCollapsed ? "X" : "+"}</button>
        { layout == 'standard' ? <Separator className="sidebar-resize-handle"/> : ''}
        <Panel className={layout == 'standard' ? `panel content-sidebar` : `panel content-sidebar content-sidebar--overtop`}
          collapsible minSize={275 }
          onResize={(size) => setEditSidebarCollapsed(size.inPixels === 0)}
          panelRef={sidebarRef}
          defaultSize={"450px"}>
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