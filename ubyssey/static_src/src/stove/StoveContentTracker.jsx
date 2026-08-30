import { useState, useEffect } from "react";
import { createRoot } from 'react-dom/client';

import Switch from "react-switch";

import { Group, Panel, Separator} from "react-resizable-panels";
import { HeadsetOutline, PrintOutline, ImageOutline, BrushOutline, VideocamOutline, Image, Headset, BodyOutline, PencilOutline, FolderOpen, FolderOpenOutline, Folder, Eye, SquareOutline, CheckboxOutline, CloseOutline } from 'react-ionicons'


import Tab from 'react-bootstrap/Tab';
import Tabs from 'react-bootstrap/Tabs';
import Table from 'react-bootstrap/Table';
import Button from 'react-bootstrap/Button';

import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'

import Deadline, {getDeadlineDate} from "./assignment_manager/Deadline.jsx";
import DateInput from "./assignment_manager/DateInput.jsx";
import deadlineOptions from './assignment_manager/DeadlineOptions.json'
import EthicsNotes from "./assignment_manager/EthicsNotes.jsx";
import AssignmentMemo from "./assignment_manager/AssignmentMemo.jsx";
import SectionSelect from "./assignment_manager/SectionSelect.jsx";
import {updateArticleStatus, updateAuthors, updateBeat, updateStoryType, updateSection, updateDeadline, updateTitle, remoteCreatePage} from "./assignment_manager/remoteManagement.js";
import StoryTypeSelect, {storyTypeLabel} from "./assignment_manager/StoryTypeSelect.jsx";
import BeatSelect from "./assignment_manager/BeatSelect.jsx";
import LinkInput, {LinkOpenButton} from "./assignment_manager/LinkInput.jsx";
import AuthorsSelect from "./assignment_manager/AuthorSelect.jsx";
import ArticleStatus from "./assignment_manager/ArticleStatus.jsx";
import statuses from './assignment_manager/statuses.json'
import NavigationSidebar from "./assignment_manager/NavigationSidebar.jsx";

import 'bootstrap/dist/css/bootstrap.min.css';

import { ToastContainer, toast } from "react-toastify";

function ArticleRow({page, updatePage, selectedArticleId, setSelectedArticleId, setActiveSidebar}) {


    let selectedClass = "";

    if (page.pk === selectedArticleId) {
      selectedClass="row-selected";
    }

    let hasStoryType = storyTypeLabel(page["story_type"]) != "[No label provided]";

    function setSidebar(mode) {
      setSelectedArticleId(page.pk)
      setActiveSidebar(mode)
    }


    return <tr key={page.pk} className={selectedClass}>
            <td class="slug-cell">
                <span class="slug-link--container">
              <a class="slug-link" href={articleUrl.replace("1918", page.pk)}>
              {page["title"]}
              </a>
              </span> 
              <div className="slug-cell--button-panel">
              <button class="slug-cell--edit-button" onClick={() => setSidebar(SIDEBAR.EDIT)}><PencilOutline
                color={'#00000'} 
                height={"18px"}
                width={"18px"}
              /></button>
              <button class="slug-cell--preview-button" onClick={() => setSidebar(SIDEBAR.PREVIEW)}><Eye 
                className
                height={"18px"}
                width={"18px"}/>
              </button>
              
              <LinkOpenButton url={page.assignment_folder} className={"slug-cell--hyperlink-open"} iconSize={"18px"}/>
              </div>
              <div className={`slug-cell--story-type ${hasStoryType ? "slug-cell--story-type-active" : "slug-cell--story-type-empty"}`}>{hasStoryType ? storyTypeLabel(page["story_type"]) : ""}</div>
              </td>
            <td class="authors-cell"><AuthorsSelect 
              disabled = {page.live}
              currentAuthors={page.article_authors} 
              handleUpdateAuthors={(newAuthorList) => updateAuthors(page, newAuthorList, statuses[page.article_status].role, updatePage)}
              authorType={statuses[page.article_status].role}
              isPublished={page.live}
              />
            </td>
            <td><DateInput date={getDeadlineDate(page, deadlineOptions.DRAFT_IN)} handleUpdateDate={(newDate) => updateDeadline(page, {date: newDate, description: deadlineOptions.DRAFT_IN, completed: false}, updatePage)} disabled={page.live}/></td>
            <td><BeatSelect beat={page.category_page} updateBeat={(newBeat) => updateBeat(page, newBeat, updatePage)} disabled={page.live}/></td>
            <td><ArticleStatus status={page["article_status"]} updateStatus={(newStatus) => updateArticleStatus(page, newStatus, updatePage)}/></td>
            <td>
              <ImageOutline color={'#000000'} height="1.5em" width="1.5em" /> 
              <BrushOutline color={'#000000'} height="1.5em" width="1.5em" />
              <VideocamOutline color={'#000000'} height="1.5em" width="1.5em" /></td> {/*#257e4d*/}
            <td>
              <PrintOutline color={'#000000'} height="1.5em" width="1.5em" />
              <HeadsetOutline color={'#000000'} height="1.5em" width="1.5em" /></td> {/*#faa33a*/}
    </tr>
}




function ArticleList({allPages, updatePage, selectedArticleId, setSelectedArticleId, setActiveSidebar}) {

  const rows = []
  
  for (const [id, page] of allPages) { // [id, page]
    rows.push(
      ArticleRow({updatePage: updatePage, page: page, selectedArticleId: selectedArticleId, setSelectedArticleId: setSelectedArticleId, setActiveSidebar: setActiveSidebar})
    )
  }

  if (rows.length == 0) return <div class="article-list"><Skeleton className={"article-list--skeleton"} height="1.5lh" width="82em"/><Skeleton className={"article-list--skeleton"} height="3lh" width="82em" count={10}/></div>

  return (
    <div class="article-list">
    <Table striped bordered hover>
       <thead>
            <tr class="table-header">
                <th class="slug-header">Slug</th>
                <th class="byline-header">Assigned To</th>
                <th class="deadline-header">Deadline</th>
                <th class="beat-header">Beat</th>
                <th class="status-header">Status</th>
                <th class="visuals-header">Visuals</th>
                <th class="media-header">Media</th>
            </tr>
        </thead>
        <tbody>
          {rows}
        </tbody>
      
    </Table>
    </div>
  )
}

function MoreArticlesButton({addPages, clearPages, pkInPages, isOnlyUserFilter, isIncludingPublished, isLoading, setLoading}) {
  const [currentPage, setCurrentPage] = useState(0);
  const [allPagesLoaded, setAllPagesLoaded] = useState(false)

  function loadPageJson(pk) {
    return fetch(loadPageUrl.replace("1918", pk), {method: "GET", headers: headers, credentials: "same-origin"}).then((response) => {
          return response.json()
        })
  }

  function fetchNextPage() {
      const params = new URLSearchParams();
      if (isOnlyUserFilter) params.append("username", currentUser);
      if (!isIncludingPublished) params.append("include_published", "false")

        return fetch(loadArticlesUrl.replace("1918", currentPage + 1) + "?" + params, { method: "GET", headers: headers, credentials: "same-origin"})
        .then(async (response) => {
          if (response.status != 200) {
            throw new Error(response)
          } else {
            setCurrentPage(currentPage + 1)
            return response.json()
          }})
        .then((json) => {
            const newPages = JSON.parse(json);

            if (newPages.length === 0) {
              setAllPagesLoaded(true)
            } else if (pkInPages(newPages[0].pk)) {
              setAllPagesLoaded(true)
            } else {
              addPages(newPages)
            }
            return newPages
        }).then((pages) => {
          let pagePromises = []
          for (const page of pages) {
            pagePromises = [...pagePromises, loadPageJson(page.pk) ]
          }
          const chunkSize = 5;
          const chunkPromises = [];
          for (let i = 0; i < pagePromises.length; i += chunkSize) {
            chunkPromises.push(
              Promise.all(pagePromises.slice(i, i + chunkSize)).then((pages) => {
                let jsonPages = []
                for (const page of pages) {
                  jsonPages.push(JSON.parse(page))
                }
                addPages(jsonPages)
              return jsonPages;
            }));
          }
          return Promise.all(chunkPromises)
        })
        .catch((error) => console.log(error));
    }

  useEffect(() => {

    if (isLoading) {
      fetchNextPage().then(() => {
        setLoading(false);
      });
    }
  }, [isLoading]);

  useEffect(() => {
    setLoading(true)
    setAllPagesLoaded(false)
    setCurrentPage(0)
    clearPages()
  }, [isOnlyUserFilter, isIncludingPublished])

  let headers = {content_type: "application/json"}

  for (const key of Object.keys(requiredHeader)) {
      headers[key] = requiredHeader[key]
  }
  const handleClick = () => setLoading(true);

  
  return (
    <Button
      variant="secondary"
      disabled={isLoading || allPagesLoaded}
      onClick={!(isLoading || allPagesLoaded) ? handleClick : null}
    >
      {isLoading ? 'Loading…' : (allPagesLoaded ? 'All pages loaded' : 'Click to load')}
    </Button>
  );
}

function QueryFilterPanel({isOnlyUserFilter, setOnlyUserFilter, isIncludingPublished, setIsIncludingPublished, isLoading}) {
  return <div className="query-panel">
    <div className="query-toggle query-item">
      <span className="query-label">Assigned to me </span>
      <Switch 
      checked={isOnlyUserFilter}
      onChange={setOnlyUserFilter}
      height={21}
      width={42}
      checkedIcon={null}
      uncheckedIcon={null}
      disabled={isLoading}
      />
    </div>
    <div className="query-toggle query-item">
      <span className="query-label">Include published</span> 
      <Switch 
      checked={isIncludingPublished}
      onChange={setIsIncludingPublished}
      height={21}
      width={42}
      checkedIcon={null}
      uncheckedIcon={null}
      disabled={isLoading}
      />
    </div>
  </div>
}

const SIDEBAR = {
  CREATE: "create",
  EDIT: "edit",
  PREVIEW: "preview"
}

function MainViewSelector({allPages, addPages, updatePage, clearPages, selectedArticleId, setSelectedArticleId, setActiveSidebar}) {
  const [isOnlyUserFilter, setOnlyUserFilter] = useState(false);
  const [isIncludingPublished, setIsIncludingPublished] = useState(false);
  const [isLoading, setLoading] = useState(true);

  return (
    <Tabs
      defaultActiveKey="list"
      transition={false}
      id="noanim-tab-example"
      className="mb-3"
    >
      <Tab eventKey="list" title="List" >
        <h1>{pageSection} Articles</h1>
        <QueryFilterPanel 
          isOnlyUserFilter={isOnlyUserFilter} 
          setOnlyUserFilter={setOnlyUserFilter}
          isIncludingPublished={isIncludingPublished}
          setIsIncludingPublished={setIsIncludingPublished}
          isLoading={isLoading}/>
        <ArticleList allPages={allPages} 
          updatePage={updatePage}
          selectedArticleId={selectedArticleId}
          setSelectedArticleId={setSelectedArticleId}
          setActiveSidebar={setActiveSidebar}/>
        <MoreArticlesButton 
          addPages={addPages} 
          clearPages={clearPages}
          pkInPages={(pk) => allPages.get(pk) != undefined } 
          isOnlyUserFilter={isOnlyUserFilter}
          isIncludingPublished={isIncludingPublished}
          isLoading={isLoading}
          setLoading={setLoading}/>
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

function CreateSidebar({createPage}) {
  const [title, changeTitle] = useState("");
  const [newPage, updateNewPage] = useState({
    title: title,
    article_authors: [],
    article_status: 1,
    assignment_memo: '',
    ethics_notes: '',
    current_section: '',
    deadline_list: [],
    story_type: ""
  });

  useEffect(() => {
    changeTitle(newPage["title"]);
  }, [newPage]);

  function handlePageCreation() {
    toast.promise(
      remoteCreatePage(newPage),
      {
        pending: {
          render(){
            return "Creating page " + newPage.title
          },
          position: 'bottom-left',
        },
        success: {
          render() {return "Created page " + newPage.title},
          autoClose: 1500},
        error: {
          render({data}) {
            return "Failed to create page " + newPage.title + ": " + data.message
          }
          
        }
        
      }
    ).then((pageJson) => {
        createPage(JSON.parse(pageJson))
        changeTitle("")
        updateNewPage({
          article_authors: [],
          article_status: 1,
          ethics_notes: '',
          assignment_memo: '',
          deadline_list: [],
          story_type: ""
        })
      })
      .catch(async (error) => {
        console.log(error)
      })
    
    
  }

  return <div className="edit-content">
    <textarea 
      style={{
        width: "100%",
      }}
      className="edit-field--title"
      placeholder="Add title..."
      value={title} // ...force the input's value to match the state variable...
      onChange={e => changeTitle(e.target.value.replace("\n", ""))}
      onBlur={e => updateNewPage({
        ...newPage, title: e.target.value
      })}></textarea>
    <div>
      <h4>Authors</h4>
      <div className="edit-field--sidebyside">
        <div className="edit-field--side-label">Reportage</div> <AuthorsSelect 
        currentAuthors={newPage.article_authors} 
        handleUpdateAuthors={(newAuthorList) => updateAuthors(newPage, newAuthorList, "author", (e) => updateNewPage({...e}), true)}
        authorType={"author"}
        styleType={"edit-field"}
        />
      <div className="edit-field--side-label">Backfield</div> <AuthorsSelect 
        currentAuthors={newPage.article_authors} 
        handleUpdateAuthors={(newAuthorList) => updateAuthors(newPage, newAuthorList, "backfield_editor", (e) => updateNewPage({...e}), true)}
        authorType={"backfield_editor"}
        styleType={"edit-field"}
        />
      <div className="edit-field--side-label">Copy</div> <AuthorsSelect 
        currentAuthors={newPage.article_authors} 
        handleUpdateAuthors={(newAuthorList) => updateAuthors(newPage, newAuthorList, "copy_editor", (e) => updateNewPage({...e}), true)}
        authorType={"copy_editor"}
        styleType={"edit-field"}
        />
      </div>
    </div>
    <div>
      <h4>Organization</h4>

      <div className="edit-field--sidebyside">
        <div className="edit-field--side-label">Section</div><SectionSelect section={newPage.current_section} updateSection={(newSection) => updateSection(newPage, newSection, (e) => updateNewPage(e), true)} styleType={"edit-field"}/>
        <div className="edit-field--side-label">Beat</div><BeatSelect beat={newPage.category_page} updateBeat={(newBeat) => updateBeat(newPage, newBeat, (e) => updateNewPage(e), true)} styleType={"edit-field"}/>
        <div className="edit-field--side-label">Type</div><StoryTypeSelect storyType={newPage.story_type} updateStoryType={(newStoryType) => updateStoryType(newPage, newStoryType, (e) => updateNewPage(e), true)} styleType={"edit-field"}/>
      </div>
    </div>
    <div>
      <h4>Assignment Management</h4>
      
      <div className="edit-field--sidebyside">

        <div className="edit-field--side-label">Folder</div>
          <LinkInput selectedPage={newPage} updatePage={(e) => updateNewPage(e)} isLocalOnly={true}/>
        <div className="edit-field--side-label">Status</div> <ArticleStatus status={newPage["article_status"]} updateStatus={(newStatus) => updateArticleStatus(newPage, newStatus, (e) => updateNewPage(e), true)}/>
      </div>
        <Deadline
          page={newPage}
          updatePage={updateNewPage}
          isLocalOnly={true}
          />
      <h5>Assignment Notes </h5>
      <AssignmentMemo selectedPage={newPage} updatePage={(e) => updateNewPage(e)} isLocalOnly={true}/>
      <h5>Ethics Notes </h5>
      <EthicsNotes selectedPage={newPage} updatePage={(e) => {
        updateNewPage(e)
      }} isLocalOnly={true}/>
    </div>
    <button onClick={handlePageCreation}>Create</button>
  </div>
}

function EditSidebar({selectedPage, updatePage}) {
  if (!selectedPage) {
    return <div>No article selected</div>
  }

  const [title, changeTitle] = useState(selectedPage["title"]);

  useEffect(() => {
    changeTitle(selectedPage["title"]);
  }, [selectedPage]);

  return <div className="edit-content">
    <textarea 
      style={{
        width: "100%",
      }}
      className="edit-field--title"
      value={title} // ...force the input's value to match the state variable...
      onChange={e => changeTitle(e.target.value.replace("\n", ""))}
      onBlur={(e) => updateTitle(selectedPage, e.target.value, updatePage)}></textarea>
    <div>
      <h4>Authors</h4>
      <div className="edit-field--sidebyside">
        <div className="edit-field--side-label">Reportage</div> <AuthorsSelect 
        currentAuthors={selectedPage.article_authors} 
        handleUpdateAuthors={(newAuthorList) => updateAuthors(selectedPage, newAuthorList, "author", updatePage)}
        authorType={"author"}
        styleType={"edit-field"}
        />
      <div className="edit-field--side-label">Backfield</div> <AuthorsSelect 
        currentAuthors={selectedPage.article_authors} 
        handleUpdateAuthors={(newAuthorList) => updateAuthors(selectedPage, newAuthorList, "backfield_editor", updatePage)}
        authorType={"backfield_editor"}
        styleType={"edit-field"}
        />
      <div className="edit-field--side-label">Copy</div> <AuthorsSelect 
        currentAuthors={selectedPage.article_authors} 
        handleUpdateAuthors={(newAuthorList) => updateAuthors(selectedPage, newAuthorList, "copy_editor", updatePage)}
        authorType={"copy_editor"}
        styleType={"edit-field"}
        />
      </div>
    </div>
    <div>
      <h4>Organization</h4>

      <div className="edit-field--sidebyside">
        <div className="edit-field--side-label">Section</div><SectionSelect section={selectedPage.current_section} updateSection={(newSection) => updateSection(selectedPage, newSection, updatePage)} styleType={"edit-field"}/>
        <div className="edit-field--side-label">Beat</div><BeatSelect beat={selectedPage.category_page} updateBeat={(newBeat) => updateBeat(selectedPage, newBeat, updatePage)} styleType={"edit-field"}/>
        <div className="edit-field--side-label">Type</div><StoryTypeSelect storyType={selectedPage.story_type} updateStoryType={(newStoryType) => updateStoryType(selectedPage, newStoryType, updatePage)} styleType={"edit-field"}/>
      </div>
    </div>
    <div>
      <h4>Assignment Management</h4>
      
      <div className="edit-field--sidebyside">

        <div className="edit-field--side-label">Folder</div>
          <LinkInput selectedPage={selectedPage} updatePage={updatePage}/>
        <div className="edit-field--side-label">Status</div> <ArticleStatus status={selectedPage["article_status"]} updateStatus={(newStatus) => updateArticleStatus(selectedPage, newStatus, updatePage)}/>
      </div>
      <Deadline page={selectedPage} updatePage={updatePage}/>
      <h5>Assignment Notes </h5>
      <AssignmentMemo selectedPage={selectedPage} updatePage={updatePage}/>
      <h5>Ethics Notes </h5>
      <EthicsNotes selectedPage={selectedPage} updatePage={updatePage}/>
    </div>
  </div>
}

function SidebarViewsSelector({selectedPage, updatePage, createPage, activeSidebar, setActiveSidebar}) {
  return (
    <Tabs
      activeKey={activeSidebar}
      onToggle={(e) => console.log(e)}
      onClick={(e) => {
        let element = e.target
        let dataset = e.target.dataset;
        if (dataset != null) {
          let value = dataset.rrUiEventKey
          if (value != null) {
            setActiveSidebar(value)
          }
        }
      }}
      transition={false}
      id="noanim-tab-example"
      className="mb-3"
    >
      <Tab eventKey={SIDEBAR.CREATE} title="Create">
        <CreateSidebar 
          createPage={createPage} />
      </Tab>
      <Tab eventKey={SIDEBAR.EDIT} title="Edit">
        <EditSidebar 
          selectedPage={selectedPage}
          updatePage={updatePage} />
      </Tab>
      <Tab eventKey={SIDEBAR.PREVIEW} title="Preview" disabled>
        Tab content for View
      </Tab>
    </Tabs>
  );
}

function Sidebar({selectedPage, updatePage, createPage, activeSidebar, setActiveSidebar}) {
  return <div className="metadata-editor">
      <SidebarViewsSelector
        selectedPage={selectedPage}
        updatePage={updatePage}
        createPage={createPage}
        activeSidebar={activeSidebar}
        setActiveSidebar={setActiveSidebar}/>
    </div>;
}



function ContentTracker() {
  const [allPages, setAllPages] = useState(
    pages
  );
  const [activeSidebar, setActiveSidebar] = useState(SIDEBAR.CREATE);

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
          <Sidebar 
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
root.render(<ContentTracker />);