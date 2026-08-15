import { useState, useEffect } from "react";
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import Select from 'react-select';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import chroma from 'chroma-js';
import Switch from "react-switch";

import { Group, Panel, Separator} from "react-resizable-panels";
import { HeadsetOutline, PrintOutline, ImageOutline, BrushOutline, VideocamOutline, Image, Headset, BodyOutline, PencilOutline, FolderOpen, FolderOpenOutline, Folder, Eye } from 'react-ionicons'


import Tab from 'react-bootstrap/Tab';
import Tabs from 'react-bootstrap/Tabs';
import Table from 'react-bootstrap/Table';
import Button from 'react-bootstrap/Button';
import SvgStoveNameplateBlue from './stove-nameplate-blue.svg';

import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'

import "prosemirror-view/style/prosemirror.css";
import { EditorState } from "prosemirror-state";
import { history } from 'prosemirror-history'
import { Schema } from 'prosemirror-model'
import { toggleMark, joinBackward } from 'prosemirror-commands'
import { undo, redo } from 'prosemirror-history'
import { baseKeymap } from 'prosemirror-commands'
import { keymap } from 'prosemirror-keymap'
import { marks } from 'prosemirror-schema-basic'
import { DOMParser } from "prosemirror-model";
import { autolink } from "prosemirror-autolink";
import { Tooltip } from 'react-tooltip';




import {
  ProseMirror,
  ProseMirrorDoc,
  reactKeys,
} from "@handlewithcare/react-prosemirror";


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
      {role: "author", color: "#77d27cff"}
    ];
  const roleColours = {
    "author": "#e6e6e6",
    "backfield_editor": "#f5c554",
    "copy_editor": "#77c0d2",
    "published_author":  "#c0e5bd"
  }

function AuthorsSelect ({currentAuthors, handleUpdateAuthors, authorType, styleType="edit-field", disabled, isPublished}) {
  if (currentAuthors === "") {
    return <Skeleton width="14em"/>
  }
  
  let initialAuthors = [];
  for (const authorId in currentAuthors) {
    const author = currentAuthors[authorId]
    if (author["author_role"] == authorType) {
      initialAuthors.push({value: author["author"], label: findAuthorName(author["author"])})
    }
  }

  let style = {
    multiValue: (base) => ({
        ...base,
        backgroundColor: isPublished ? roleColours["published_author"] : roleColours[authorType],
    }),
    menu: (base) => ({
      ...base,
      marginTop: "-4px"
    })};

  if (styleType == "edit-field") {
    style = {
      ...style, 
      control: (base) => ({
        ...base,
        border: "none",
        backgroundColor: "inherit",
      }),
      valueContainer: (base) => ({
        ...base,
        padding: "5px",
        ':hover': {
          backgroundColor: "var(--hover-color)"
        }
      }),
      selectContainer: (base) => ({
        ...base,
        padding: "0",
        margin: "0",
      })
      
    }
  } else {
    style = {
      ...style, 
      container: (base) => ({
        ...base,
        maxWidth: "20em",
      })
    }
  }
  
  if (disabled) {
    style = {
      ...style,
      container: (base) => ({
        ...base,
        pointerEvents: "auto",
      }),
      valueContainer: (base) => ({
        ... base,
        ':hover': {
          cursor: "not-allowed",
          backgroundColor: "var(--invalid-hover-color)"
        },
        ':active': {
          pointerEvents: "none",
          backgroundColor: "var(--invalid-hover-color)"
        }
      }),
      multiValueRemove: (base) => ({
        ...base,
        ':hover': {
          cursor: "not-allowed",
          backgroundColor: "inherit"
        },
      })
    }
  }

  return <Select 
    isDisabled = {disabled}
    options={authors} 
    onChange = {handleUpdateAuthors} 
    value={initialAuthors} 
    isMulti 
    styles={style}
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

function isValidUrl(url) {
  const urlRegex = /https?:\/\/..*\...*/g

  return url.match(urlRegex)
}

async function updateAssignmentFolder(page, newAssignmentFolder, updatePage, isLocalOnly=false) {
  if (page.assignment_folder == newAssignmentFolder) return;

  if (newAssignmentFolder.indexOf("http://") != 0 && newAssignmentFolder.indexOf("https://") !=0) {
    newAssignmentFolder = "http://" + newAssignmentFolder;
  }
  if (!isValidUrl(newAssignmentFolder)) {
    toast.error(
      newAssignmentFolder + " is not a valid URL.", 
      {position: 'bottom-left'}
    )
    return;
  }

  page.assignment_folder = newAssignmentFolder

  updatePage(page)

  if (!isLocalOnly) {
    handleRemoteUpdate(page, {"assignment_folder": newAssignmentFolder}, updatePage,
      "Updating assignment folder for " + page.title, 
      "Updated assignment folder for " + page.title, 
      "Failed to update assignment folder for " + page.title)
  }
}


async function updateAuthors(page, newAuthorList, role, updatePage, isLocalOnly=false) {

  page.article_authors = page.article_authors.filter((author) => author.author_role != role)

  for (const author of newAuthorList) {
    page.article_authors.push({article_page: page.pk, author_role: role, author: author.value})
  } 

  console.log(page)

  updatePage(page)

  if (!isLocalOnly) {
    handleRemoteUpdate(page, {"authors": page.article_authors}, updatePage,
      "Updating authors for " + page.title, 
      "Updated authors for " + page.title, 
      "Failed to authors for " + page.title)
  }

}


async function updateArticleStatus(page, newStatus, updatePage, isLocalOnly=false) {
  updatePage({... page, article_status: newStatus.value})
  
  if (!isLocalOnly) {
    handleRemoteUpdate(page, {"article_status": newStatus.value}, updatePage,
      "Updating status for " + page.title + " to " + newStatus.label, 
      "Updated status for " + page.title + " to " + newStatus.label, 
      "Failed to update status for " + page.title + " to " + newStatus.label)
  }
}

async function updateDeadline(page, newDate, updatePage, isLocalOnly=false) {
  updatePage({... page, deadline: newDate.toISOString()})

  if (!isLocalOnly) {
    handleRemoteUpdate(page, {"deadline": newDate.toISOString()}, updatePage,
      "Updating deadline for " + page.title, 
      "Updated deadline for " + page.title, 
      "Failed to update deadline for " + page.title)
  }
}

async function updateBeat(page, newBeat, updatePage, isLocalOnly=false) {
  updatePage({... page, category_page: newBeat.value})

  if (!isLocalOnly) {
  handleRemoteUpdate(page, {"category": newBeat.label}, updatePage,
    "Updating beat for " + page.title + " to " + newBeat.label, 
    "Updated beat for " + page.title + " to " + newBeat.label, 
    "Failed to update beat for " + page.title + " to " + newBeat.label)
  }
}

async function updateSection(page, newSection, updatePage, isLocalOnly=false) {
  updatePage({... page, current_section: newSection.value})

  if (!isLocalOnly) {
    handleRemoteUpdate(page, {"current_section": newSection.value}, updatePage,
      "Updating beat for " + page.title + " to " + newSection.label, 
      "Updated beat for " + page.title + " to " + newSection.label, 
      "Failed to update beat for " + page.title + " to " + newSection.label)
  }
}

async function updateAssignmentMemo(page, newMemo, updatePage, isLocalOnly = false) {
  if (page["assignment_memo"] == newMemo) return;

  updatePage({...page, assignment_memo: newMemo})

  if(!isLocalOnly) {
    handleRemoteUpdate(page, {"assignment_memo": newMemo}, updatePage,
      "Updating assignment memo for " + page.title, 
      "Updated assignment memo for " + page.title, 
      "Failed to assignment memo for " + page.title)
  }

}

async function updateEthicsNotes(page, newEthics, updatePage, isLocalOnly = false) {
  if (page.ethics_notes == newEthics) return;

  updatePage({...page, ethics_notes: newEthics})


  if(!isLocalOnly) {
    handleRemoteUpdate(page, {"ethics_notes": newEthics}, updatePage,
      "Updating ethics notes for " + page.title, 
      "Updated ethics notes for " + page.title, 
      "Failed to update ethics notes for " + page.title)
  }
}

async function handleRemoteUpdate(page, changes, updatePage, pendingText, successText, errorText) {
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

async function remoteCreatePage(page) {
  let headers = {content_type: "application/json"}

  for (const key of Object.keys(requiredHeader)) {
      headers[key] = requiredHeader[key]
  }

  if (page.current_section === "") {
    throw new Error("Pages must have a section")
  }
  return fetch(createPageUrl.replace("1918", page.current_section), { method: "POST", headers: headers, body: JSON.stringify(page),
    credentials: "same-origin"})
    .then(async (response) => {
      console.log("PROCESSING")
      // console.log(response)
      if (response.status != 200) {
        const errorText = await response.text()
        console.log(errorText)
        throw new Error(errorText)
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
    options={statuses.slice(0, -1)} 
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

function beatLabel(beatPk) {

  for (const {label, options} of beatOptions) {
    for (const beat of options) {
      if (+beatPk === beat.value) return beat.label
    }
  }
  return "[No label provided]"
}

function BeatSelect ({beat, updateBeat, styleType="edit-field", disabled}) {

 let style = {
  ...style,
  menu: (base) => ({
    ...base,
    marginTop: "-4px"
  })
 };

  if (styleType == "edit-field") {
    style = {
      ...style, 
      control: (base) => ({
        ...base,
        border: "none",
        backgroundColor: "inherit",
      }),
      valueContainer: (base) => ({
        ...base,
        padding: "5px",
        ':hover': {
          backgroundColor: "var(--hover-color)"
        }
      }),
      selectContainer: (base) => ({
        ...base,
        padding: "0",
        margin: "0",
      }), 
      container: (base) => ({
        ...base,
        maxWidth: "20em",
      })
    }
  }

  if (disabled) {
    style = {
      ...style,
      container: (base) => ({
        ...base,
        pointerEvents: "auto",
      }),
      valueContainer: (base) => ({
        ... base,
        ':hover': {
          cursor: "not-allowed",
          backgroundColor: "var(--invalid-hover-color)"
        },
        ':active': {
          pointerEvents: "none",
          backgroundColor: "var(--invalid-hover-color)"
        }
      }),
      singleValue: (base) => ({
        ...base,
        color: "inherit"
      })
    }
  }

    return <Select 
    isDisabled={disabled}
    options={beatOptions}
    value={beat ? {"value": beat, "label": beatLabel(beat)} : ''}
    onChange={updateBeat}
    styles={style}
    formatGroupLabel={formatGroupLabel}
    components={{
      DropdownIndicator: null, 
      placeholder: "Choose beat..."} }/>
}

function findSection(sectionSlug) {
    for (const s of allSections) {
      if (s.slug == sectionSlug) return s
    }
    return undefined
  }

function SectionSelect ({section, updateSection, styleType="edit-field"}) {

  let style = {};

  if (styleType == "edit-field") {
    style = {
      ...style, 
      control: (base) => ({
        ...base,
        border: "none",
        backgroundColor: "inherit",
      }),
      valueContainer: (base) => ({
        ...base,
        padding: "5px",
        ':hover': {
          backgroundColor: "var(--hover-color)"
        }
      }),
      selectContainer: (base) => ({
        ...base,
        padding: "0",
        margin: "0",
      }), 
      container: (base) => ({
        ...base,
        maxWidth: "20em",
      })
    }
  }

  return <Select 
    options={allSections}
    value={ section ? findSection(section) : ''}
    onChange={updateSection}
    styles={style}
    formatGroupLabel={formatGroupLabel}
    components={{
      DropdownIndicator: null, 
      placeholder: "Choose section..."} }/>
}

function LinkInput ({selectedPage, updatePage, isLocalOnly=false}) {
  const [assignmentFolder, changeAssignmentFolder] = useState(selectedPage.assignment_folder);

  useEffect(() => {
    if (selectedPage.assignment_folder != null) {
      changeAssignmentFolder(selectedPage.assignment_folder)
    } else {
      changeAssignmentFolder('')
    }
  }, [selectedPage]);

  return <div class="edit-field--hyperlink-container">
          <LinkOpenButton url={assignmentFolder} className={"edit-field--hyperlink-open"}/>
          <input class="edit-field--plaintext" 
            placeholder="Assignment folder link..." 
            value={assignmentFolder}
            onChange={e => changeAssignmentFolder(e.target.value)}
            onBlur={(e) => updateAssignmentFolder(selectedPage, e.target.value, updatePage, isLocalOnly)}>
            </input>
          </div>
}

function LinkOpenButton ({url, className, iconSize}) {
  let button;

  if (url != null && url != '') {
    const activeButton = isValidUrl(url)

    if (isValidUrl(url) || isValidUrl("http://" + url)) {
      button = <a href={url} target="_blank" rel="noopener noreferrer">
          <FolderOpen 
            width={iconSize}
            height={iconSize}
          />
        </a>
    } else {
      button = <FolderOpenOutline 
        color={"#d23732"}
        width={iconSize}
        height={iconSize}/>
    }
  } else {
    button = <FolderOpenOutline 
        width={iconSize}
        height={iconSize}/>
  }

  return (<div className={className}>
             {button}
            </div>);
}

function ArticleRow({page, updatePage, selectedArticleId, setSelectedArticleId, setActiveSidebar}) {


    let selectedClass = "";

    if (page.pk === selectedArticleId) {
      selectedClass="row-selected";
    }

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
              </div></td>
            <td class="authors-cell"><AuthorsSelect 
              disabled = {page.live}
              currentAuthors={page.article_authors} 
              handleUpdateAuthors={(newAuthorList) => updateAuthors(page, newAuthorList, responsibleRole[page.article_status].role, updatePage)}
              authorType={responsibleRole[page.article_status].role}
              isPublished={page.live}
              />
            </td>
            <td><DateInput date={page.deadline} handleUpdateDate={(newDate) => updateDeadline(page, newDate, updatePage)} disabled={page.live}/></td>
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
  useEffect(() => {
    for (const [id, page] of allPages) {
      if(page.live && page.article_status != 6) updateArticleStatus(page, statuses[5], updatePage)
      if(!page.live && page.article_status == 6) updateArticleStatus(page, statuses[4], updatePage)
    }
  }, [allPages.size])

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
    fetchNextPage()
  }, [])

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
  const [isLoading, setLoading] = useState(false);

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
  console.log(allPages)

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
    current_section: ''
  });

  useEffect(() => {
    changeTitle(newPage["title"]);
  }, [newPage]);

  function handlePageCreation() {
    console.log(newPage)
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
          assignment_memo: ''
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
      </div>
    </div>
    <div>
      <h4>Assignment Management</h4>
      
      <div className="edit-field--sidebyside">

        <div className="edit-field--side-label">Folder</div>
          <LinkInput selectedPage={newPage} updatePage={(e) => updateNewPage(e)} isLocalOnly={true}/>
        <div className="edit-field--side-label">Status</div> <ArticleStatus status={newPage["article_status"]} updateStatus={(newStatus) => updateArticleStatus(newPage, newStatus, (e) => updateNewPage(e), true)}/>
        <div className="edit-field--side-label">Deadline</div><div className="edit-field--date"><DateInput date={newPage.deadline} handleUpdateDate={(newDate) => updateDeadline(newPage, newDate, (e) => updateNewPage(e), true)}/></div>
      </div>
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
      </div>
    </div>
    <div>
      <h4>Assignment Management</h4>
      
      <div className="edit-field--sidebyside">

        <div className="edit-field--side-label">Folder</div>
          <LinkInput selectedPage={selectedPage} updatePage={updatePage}/>
        <div className="edit-field--side-label">Status</div> <ArticleStatus status={selectedPage["article_status"]} updateStatus={(newStatus) => updateArticleStatus(selectedPage, newStatus, updatePage)}/>
        <div className="edit-field--side-label">Deadline</div><div className="edit-field--date"><DateInput date={selectedPage.deadline} handleUpdateDate={(newDate) => updateDeadline(selectedPage, newDate, updatePage)}/></div>
      </div>
      <h5>Assignment Notes </h5>
      <AssignmentMemo selectedPage={selectedPage} updatePage={updatePage}/>
      <h5>Ethics Notes </h5>
      <EthicsNotes selectedPage={selectedPage} updatePage={updatePage}/>
    </div>
  </div>
}


const doc = {
  content: 'block+',
  toDOM: () => ['article', 0],
}

const text = {
  group: 'inline',
}

const paragraph = {
  content: 'inline*',
  group: 'block',
  parseDOM: [{ tag: 'p' }],
  toDOM: () => ['p', 0],
}

const schema = new Schema({
  nodes: { doc, text, paragraph },
  marks: marks,
})

function EthicsNotes({selectedPage, updatePage, isLocalOnly = false}) {
  return <RichTextEditor onBlurCallback={(e) => updateEthicsNotes(selectedPage, e.target.innerHTML, updatePage, isLocalOnly)} defaultText={selectedPage.ethics_notes}/>
}

function AssignmentMemo({selectedPage, updatePage, isLocalOnly = false}) {
  return <RichTextEditor onBlurCallback={(e) => updateAssignmentMemo(selectedPage, e.target.innerHTML, updatePage, isLocalOnly)} defaultText={selectedPage.assignment_memo}/>
}

function RichTextEditor({onBlurCallback, defaultText}) {
  const domElement = new window.DOMParser().parseFromString(defaultText, "text/html").body;
  const defaultNode = DOMParser.fromSchema(schema).parse(domElement);

  const [editorState, setEditorState] = useState(
    EditorState.create({
        doc: defaultNode,
        schema,
        plugins: [
          // The reactKeys plugin is required for the ProseMirror component to work!
          reactKeys(),
          history(),
          keymap({
            ...baseKeymap,
            'Mod-z': undo,
            'Shift-Mod-z': redo,
            Backspace: joinBackward,
            'Mod-b': toggleMark(schema.marks.strong),
            'Mod-i': toggleMark(schema.marks.em)
          }),
          ...autolink({
            openOnClick: true,
            enableEnterTrigger: true,
            excludedTrailingChars: ['.', ',', '!', '?', ':', ';', ')', ']', '}']
          })
        ],
      })
  )

  useEffect(() => {
    const newState = editorState;
    newState.doc=defaultNode;
    setEditorState(newState);
  }, [defaultText]);
  

    return (
    <ProseMirror
      state={editorState}
      dispatchTransaction={(tr) => {
        setEditorState((s) => s.apply(tr));
      }}
    >
      <div className="edit-field--richtext-editor">
        
      <ProseMirrorDoc 
        onBlur={onBlurCallback}
        style={{
          backgroundColor: "#fdfdfd",
          padding: "10px",
          paddingBottom: "0",
          minHeight: "6lh"
        }}
        />
        <div className="edit-field--richtext-help"><a data-tooltip-id="richtext-info">?</a></div>
        <Tooltip
          id={"richtext-info"}
          place={'top-end'}
          style={{ 
            backgroundColor: "#f6f6f6", 
            fontSize: "small", 
            color: "black", 
            width: "200px", 
            filter: 'drop-shadow(0px 4px 8px rgba(0, 0, 0, 0.2))'
          }}
        >
          <span><strong>Shortcuts</strong></span>
          <ul>
            <li><strong>Bold</strong>. Cmd/Ctrl + B</li>
            <li><i>Italics</i>. Cmd/Ctrl + I</li>
            <li><a href="ubyssey.ca">Link</a>. Paste a link from your clipboard using Cmd/Ctrl + V</li>
          </ul>
        </Tooltip>
        </div>
        
    </ProseMirror>
  );
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

function SectionNavigationSidebar() {
  function SectionGroup({groupName, sections}) {
    const sectionItems = sections.map(section => <li className="section-navigation-item"><a href={"/stove/oven/" + section}>{section}</a></li>)
    return <ul className="section-navigation-grouping">
      <span className="section-navigation-title">{groupName}</span>
      {sectionItems}
    </ul>
  }
  return <div class="navigation-panel">
            <div className="stove-logo-container"><a href="/stove/oven"><SvgStoveNameplateBlue className="stove-logo"/></a></div>
          <SectionGroup groupName="Reportage" sections={["Arts", "Culture", "News", "Opinion", "Sports"]}/>
          <SectionGroup groupName="Visuals" sections={["Graphics", "Photo", "Video"]}/>
          <SectionGroup groupName="Product" sections={["Audio", "Print", "Socials"]}/>
          <SectionGroup groupName="More" sections={["Copy", "Games", "Homepage"]}/>
  </div>
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
        <SectionNavigationSidebar/>
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


function DateInput ({date, handleUpdateDate, disabled}) {
  return <DatePicker
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
  />;
};


const container = document.getElementById('content-tracker');
const root = createRoot(container); // createRoot(container!) if you use TypeScript
root.render(<ContentTracker />);


// https://codesandbox.io/p/sandbox/prosemirror-simple-i8yul?file=%2Fsrc%2Findex.ts%3A12%2C3