import Tab from 'react-bootstrap/Tab';
import Tabs from 'react-bootstrap/Tabs';

import { useState, useEffect } from "react";
import Deadline from "./Deadline.jsx";
import EthicsNotes from "./EthicsNotes.jsx";
import AssignmentMemo from "./AssignmentMemo.jsx";
import SectionSelect from "./SectionSelect.jsx";
import {updateArticleStatus, updateAuthors, updateBeat, updateStoryType, updateSection, updateTitle, remoteCreatePage} from "./remoteManagement.js";
import StoryTypeSelect  from "./StoryTypeSelect.jsx";
import BeatSelect from "./BeatSelect.jsx";
import LinkInput  from "./LinkInput.jsx";
import AuthorsSelect from "./AuthorSelect.jsx";
import ArticleStatus from "./ArticleStatus.jsx";

import { toast } from "react-toastify";



export const SIDEBAR_TYPES = {
  CREATE: "create",
  EDIT: "edit",
  PREVIEW: "preview"
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
      value={title} 
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
      value={title} 
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
      <Tab eventKey={SIDEBAR_TYPES.CREATE} title="Create">
        <CreateSidebar 
          createPage={createPage} />
      </Tab>
      <Tab eventKey={SIDEBAR_TYPES.EDIT} title="Edit">
        <EditSidebar 
          selectedPage={selectedPage}
          updatePage={updatePage} />
      </Tab>
      <Tab eventKey={SIDEBAR_TYPES.PREVIEW} title="Preview" disabled>
        Tab content for View
      </Tab>
    </Tabs>
  );
}

export default function StorySidebar({selectedPage, updatePage, createPage, activeSidebar, setActiveSidebar}) {
  return <div className="metadata-editor">
      <SidebarViewsSelector
        selectedPage={selectedPage}
        updatePage={updatePage}
        createPage={createPage}
        activeSidebar={activeSidebar}
        setActiveSidebar={setActiveSidebar}/>
    </div>;
}