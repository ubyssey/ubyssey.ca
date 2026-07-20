import { useState, useEffect } from "react";
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import Select from 'react-select';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import chroma from 'chroma-js';

import { Group, Panel, Separator} from "react-resizable-panels";
import { HeadsetOutline, PrintOutline, ImageOutline, BrushOutline, VideocamOutline, Image, Headset, BodyOutline, PencilOutline } from 'react-ionicons'


import Tab from 'react-bootstrap/Tab';
import Tabs from 'react-bootstrap/Tabs';
import Table from 'react-bootstrap/Table';
import Button from 'react-bootstrap/Button';


import 'bootstrap/dist/css/bootstrap.min.css';

import { ToastContainer, toast } from "react-toastify";
// import { newDate } from "react-datepicker/dist/dist/date_utils.js";


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

function findAuthorName(authorId) {
  for (let entry in authors) {
    const author = authors[entry]
    if (author["value"] == authorId) {
      return author["label"]
    }
  }
  return "";
}
  const responsibleRole = 
    [
      {role: "author", color: "#e6e6e6"},
      {role: "author", color: "#e6e6e6"},
      {role: "backfield_editor", color: "#f5c554"},
      {role: "author", color: "#e6e6e6"},
      {role: "copy_editor", color: "#77c0d2"},
      {role: "author", color: "#e6e6e6"},
      {role: "author", color: "#e6e6e6"}
    ];
  const roleColours = {
    "author": "#e6e6e6",
    "backfield_editor": "#f5c554",
    "copy_editor": "#77c0d2" 
  }

function AuthorsSelect ({currentAuthors, handleUpdateAuthors, authorType}) {
  let initialAuthors = [];
  for (const authorId in currentAuthors) {
    const author = currentAuthors[authorId]
    if (author["author_role"] == authorType) {
      initialAuthors.push({value: author["author"], label: findAuthorName(author["author"])})
    }
  }


  return <Select 
    options={authors} 
    onChange = {handleUpdateAuthors} 
    value={initialAuthors} 
    isMulti 
    styles={{
      multiValue: (base) => ({
        ...base,
        backgroundColor: roleColours[authorType],
      }),
      container: (base) => ({
        ...base,
        maxWidth: "20em",
      })
    }}
    placeholder = {"Add " + authorType.replace("_", " ") + "..."}
    components={{
      DropdownIndicator: null, 
      ClearIndicator: null
    }}/>
}

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

function resolveAfter2Seconds() {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (getRandomInt(10)) {
        resolve("resolved");
      } else {
        reject("failed")
      }
    }, getRandomInt(5000));
  });
}

async function updateTitle(page, newTitle, updatePage) {

  page.title = newTitle

  updatePage(page)

  handleRemoteUpdate(page, {"title": page.title}, updatePage,
    "Updating title for " + page.title, 
    "Updated title for " + page.title, 
    "Failed to title for " + page.title)

}


async function updateAuthors(page, newAuthorList, role, updatePage) {

  page.article_authors = page.article_authors.filter((author) => author.author_role != role)

  for (const author of newAuthorList) {
    page.article_authors.push({article_page: page.pk, author_role: role, author: author.value})
  } 

  updatePage(page)


  handleRemoteUpdate(page, {"authors": page.article_authors}, updatePage,
    "Updating authors for " + page.title, 
    "Updated authors for " + page.title, 
    "Failed to authors for " + page.title)

}


async function updateArticleStatus(page, newStatus, updatePage) {
  updatePage({... page, article_status: newStatus.value})
  
  handleRemoteUpdate(page, {"article_status": newStatus.value}, updatePage,
    "Updating status for " + page.title + " to " + newStatus.label, 
    "Updated status for " + page.title + " to " + newStatus.label, 
    "Failed to update status for " + page.title + " to " + newStatus.label)
}

async function updateDeadline(page, newDate, updatePage) {
  updatePage({... page, deadline: newDate.toISOString()})

  handleRemoteUpdate(page, {"deadline": newDate.toISOString()}, updatePage,
    "Updating deadline for " + page.title, 
    "Updated deadline for " + page.title, 
    "Failed to update deadline for " + page.title)
}

async function updateBeat(page, newBeat, updatePage) {
  updatePage({... page, category_page: newBeat.value})

  handleRemoteUpdate(page, {"category": newBeat.label}, updatePage,
    "Updating beat for " + page.title + " to " + newBeat.label, 
    "Updated beat for " + page.title + " to " + newBeat.label, 
    "Failed to update beat for " + page.title + " to " + newBeat.label)
}

async function handleRemoteUpdate(page, changes, updatePage, pendingText, successText, errorText) {
  toast.info("UPDATING REMOTE", {
          autoClose: 250})
  toast.promise(
      remoteUpdatePage(page, changes),
      {
        pending: {
          render(){
            return pendingText
          },
          position: 'bottom-left',
        },
        success: {
          render() {return successText},
          autoClose: 1500},
        error: errorText,
        
      }
    )
    .then((result) => {
      console.log(JSON.parse(result))
      updatePage(JSON.parse(result))
    }
    )
    .catch((error) => console.log(error))
}

async function remoteUpdatePage(page, body) {
  let headers = {content_type: "application/json"}

  for (const key of Object.keys(requiredHeader)) {
      headers[key] = requiredHeader[key]
  }

  return fetch(updateEndpoint.replace("1918", page.pk), { method: "POST", headers: headers, body: JSON.stringify(body),
    credentials: "same-origin"})
    .then(async (response) => {
      if (response.status != 200) {
        throw new Error(response)
      } else {
        return response.json()
      }}
    );
  // const payload = await response.json();
}

const formatGroupLabel = (data) => (
  <div style={groupStyles}>
    <span>{data.label}</span>
    <span style={groupBadgeStyles}>{data.options.length}</span>
  </div>
);

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
const statuses = 
    [
      {value: 1, label: "Assigned", color: '#ea968d', textColor: "#691b17"},
      {value: 2, label: "Filed", color: '#f9de9d', textColor: "#80511f"},
      {value: 3, label: "Edited", color: '#f5c554', textColor: "#80511f"},
      {value: 4, label: "Copy", color: '#77c0d2', textColor: "#172448"},
      {value: 5, label: "Ready", color: '#e3e455', textColor: '#264b35'},
      {value: 6, label: "Published", color: '#9ec756', textColor: '#264b35'}
    ];

function ArticleStatus ({status, updateStatus}) {

  
  return <Select 
    className="status-select"
    options={statuses} 
    value={statuses[status-1]} 
    styles={{
      singleValue: (base) => ({
        ...base,
        padding: 5,
        borderRadius: 5,
        background: statuses[status-1].color,
        color: statuses[status-1].textColor,
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
      })
    }}
    onChange={updateStatus}
    components={{
      DropdownIndicator: null, 
      placeholder: "Select status..."}} 
  />;
}

function beatLabel(beatPk) {

  for (const {label, options} of beatOptions) {
    for (const beat of options) {
      if (beatPk === beat.value) return beat.label
    }
  }
  return "[No label provided]"
}

function BeatSelect ({beat, updateBeat}) {
  return <Select 
    options={beatOptions}
    value={beat ? {"value": beat, "label": beatLabel(beat)} : undefined}
    onChange={updateBeat}
    formatGroupLabel={formatGroupLabel}
    components={{
      DropdownIndicator: null, 
      placeholder: "Choose beat..."} }/>
}

function ArticleRow({page, updatePage, selectedArticleId, setSelectedArticleId}) {


    let selectedClass = "";

    if (page.pk === selectedArticleId) {
      selectedClass="row-selected";
    }

    return <tr key={page.pk} className={selectedClass}>
            <td class="slug-cell">
              <button class="edit-button" onClick={() => setSelectedArticleId(page.pk)}><PencilOutline
                color={'#00000'} 
              /></button>
              <a class="slug-link" href={articleUrl.replace("1918", page.pk)}>{page["title"]}</a> </td>
            <td class="authors-cell"><AuthorsSelect 
              currentAuthors={page.article_authors} 
              handleUpdateAuthors={(newAuthorList) => updateAuthors(page, newAuthorList, responsibleRole[page.article_status].role, updatePage)}
              authorType={responsibleRole[page.article_status].role}
              />
            </td>
            <td><DateInput date={page.deadline} handleUpdateDate={(newDate) => updateDeadline(page, newDate, updatePage)}/></td>
            <td><BeatSelect beat={page.category_page} updateBeat={(newBeat) => updateBeat(page, newBeat, updatePage)}/></td>
            <td><ArticleStatus status={page["article_status"]} updateStatus={(newStatus) => updateArticleStatus(page, newStatus, updatePage)}/></td>
            <td><Image color={'#257e4d'} height="1.5em" width="1.5em" /> <BrushOutline color={'#00000'} height="1.5em" width="1.5em" /><VideocamOutline color={'#00000'} height="1.5em" width="1.5em" /></td>
            <td><PrintOutline color={'#00000'} height="1.5em" width="1.5em" /><Headset color={'#faa33a'} height="1.5em" width="1.5em" /></td>
    </tr>
}

function ArticleList({allPages, updatePage, selectedArticleId, setSelectedArticleId}) {
    toast("Rerender",{
          autoClose: 250})


  const rows = []

  for (const [id, page] of allPages) { // [id, page]
    rows.push(
      ArticleRow({updatePage: updatePage, page: page, selectedArticleId: selectedArticleId, setSelectedArticleId: setSelectedArticleId})
    )
  }
  
  return (
    <div>
    <h1>{pageSection} Articles</h1>
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

function MoreArticlesButton({addPages, pkInPages}) {
  const [isLoading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [allPagesLoaded, setAllPagesLoaded] = useState(false)

  useEffect(() => {

    function fetchNextPage() {
      return fetch(loadArticlesUrl.replace("1918", currentPage + 1), { method: "GET", headers: headers, credentials: "same-origin"})
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
            return json
        })
        .catch((error) => console.log(error));
    }

    if (isLoading) {
      fetchNextPage().then(() => {
        setLoading(false);
      });
    }
  }, [isLoading]);

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



function MainViewSelector({allPages, addPages, updatePage, selectedArticleId, setSelectedArticleId}) {
  return (
    <Tabs
      defaultActiveKey="list"
      transition={false}
      id="noanim-tab-example"
      className="mb-3"
    >
      <Tab eventKey="list" title="List">
        <ArticleList allPages={allPages} 
          updatePage={updatePage}
          selectedArticleId={selectedArticleId}
          setSelectedArticleId={setSelectedArticleId}/>
        <MoreArticlesButton addPages={addPages} pkInPages={(pk) => allPages.get(pk) != undefined }/>
      </Tab>
      <Tab eventKey="calendar" title="Calendar" disabled>
        Tab content for Calendar
      </Tab>
    </Tabs>
  );
}

function MainPanel({allPages, addPages, updatePage, selectedArticleId, setSelectedArticleId}) {
  console.log(allPages)

  return (
    <div className="main-panel">
      <MainViewSelector 
          allPages={allPages} 
          addPages={addPages}
          updatePage={updatePage}
          selectedArticleId={selectedArticleId}
          setSelectedArticleId={setSelectedArticleId}/>
    </div>
  )
}

function EditSidebar({selectedPage, updatePage}) {
  if (!selectedPage) {
    return <div>No article selected</div>
  }

  const [title, changeTitle] = useState(selectedPage["title"]);

  useEffect(() => {
    changeTitle(selectedPage["title"]);
  }, [selectedPage]);
  return <div>
    <div><h2>{selectedPage["title"]}</h2></div>
    <textarea 
      style={{
        width: "100%",
      }}
      value={title} // ...force the input's value to match the state variable...
      onChange={e => changeTitle(e.target.value.replace("\n", ""))}
      onBlur={(e) => updateTitle(selectedPage, e.target.value, updatePage)}></textarea>
    <div>
      <h3>Authors</h3>
      <div>Reportage <AuthorsSelect 
        currentAuthors={selectedPage.article_authors} 
        handleUpdateAuthors={(newAuthorList) => updateAuthors(selectedPage, newAuthorList, "author", updatePage)}
        authorType={"author"}
        />
      </div>
      <div>Backfield Editing <AuthorsSelect 
        currentAuthors={selectedPage.article_authors} 
        handleUpdateAuthors={(newAuthorList) => updateAuthors(selectedPage, newAuthorList, "backfield_editor", updatePage)}
        authorType={"backfield_editor"}
        />
      </div>
      <div>Copy Editing <AuthorsSelect 
        currentAuthors={selectedPage.article_authors} 
        handleUpdateAuthors={(newAuthorList) => updateAuthors(selectedPage, newAuthorList, "copy_editor", updatePage)}
        authorType={"copy_editor"}
        />
      </div>
    </div>
    <div>
      <h3>Assignment Management</h3>
      <div>Deadline<br/><DateInput date={selectedPage.deadline} handleUpdateDate={(newDate) => updateDeadline(selectedPage, newDate, updatePage)}/></div>
      <div>Status<ArticleStatus status={selectedPage["article_status"]} updateStatus={(newStatus) => updateArticleStatus(selectedPage, newStatus, updatePage)}/></div>
    </div>
    <div>
      <h3>Organization</h3>
      <div>Beat<BeatSelect beat={selectedPage.category_page} updateBeat={(newBeat) => updateBeat(selectedPage, newBeat, updatePage)}/></div>
    </div>
   
  </div>
}

function SidebarViewsSelector({selectedPage, updatePage, createPage}) {
  return (
    <Tabs
      defaultActiveKey="edit"
      transition={false}
      id="noanim-tab-example"
      className="mb-3"
    >
      <Tab eventKey="create" title="Create" disabled>
        Tab content for Create
      </Tab>
      <Tab eventKey="edit" title="Edit">
        <EditSidebar 
          selectedPage={selectedPage}
          updatePage={updatePage} />
      </Tab>
      <Tab eventKey="view" title="View" disabled>
        Tab content for View
      </Tab>
    </Tabs>
  );
}

function Sidebar({selectedPage, updatePage, createPage}) {
  return <div className="metadata-editor">
      <SidebarViewsSelector
        selectedPage={selectedPage}
        updatePage={updatePage}
        createPage={createPage}/>
    </div>;
}

function ContentTracker() {
  const [allPages, setAllPages] = useState(
    pages
  );



  function updatePage(newPage) {
    const updatedPages = new Map(allPages)
    updatedPages.set(newPage.pk, newPage)
    setAllPages(updatedPages)

    // setAllPages(allPages.set(newPage.pk, newPage))
    // setSelectedArticleId(5)
  }

  function addPages(newPages) {
    const updatedPages = new Map(allPages)
    for (const page of newPages) {
      updatedPages.set(page.pk, page)
    }
    setAllPages(updatedPages);
  }

  const [selectedArticleId, setSelectedArticleId] = useState(
    -1
  );

  return (
    <div className="content-tracker">
      <Group className="grouping">
      <Panel className="panel" minSize="40%" defaultSize="80%">
        <MainPanel 
          allPages={allPages} 
          addPages={addPages}
          updatePage={updatePage}
          selectedArticleId={selectedArticleId}
          setSelectedArticleId={setSelectedArticleId}
        />
      </Panel>
      <Separator className="sidebar-resize-handle"/>
      <Panel className="panel content-sidebar" collapsible minSize={275} maxSize={"40vw"}>
        <Sidebar 
          selectedPage={allPages.get(selectedArticleId)}
          updatePage={updatePage}
          createPage={(page) => {addPages([page])}}
        />
        </Panel>
    </Group>
    <ToastContainer />
    </div>
  );
}


function DateInput ({date, handleUpdateDate}) {
  return <DatePicker
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
  />;
};


const container = document.getElementById('content-tracker');
const root = createRoot(container); // createRoot(container!) if you use TypeScript
root.render(<ContentTracker />);
