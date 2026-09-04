import { useState, useEffect } from "react";

import Switch from "react-switch";

import { HeadsetOutline, PrintOutline, ImageOutline, BrushOutline, VideocamOutline,PencilOutline, Eye} from 'react-ionicons'

import Table from 'react-bootstrap/Table';
import Button from 'react-bootstrap/Button';

import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'

import {getDeadlineDate} from "./Deadline.jsx";
import DateInput from "./DateInput.jsx";
import deadlineOptions from './DeadlineOptions.json'
import {updateArticleStatus, updateAuthors, updateBeat, updateDeadline, updateSection} from "./remoteManagement.js";
import {storyTypeLabel} from "./StoryTypeSelect.jsx";
import BeatSelect from "./BeatSelect.jsx";
import {LinkOpenButton} from "./LinkInput.jsx";
import AuthorsSelect from "./AuthorSelect.jsx";
import ArticleStatus from "./ArticleStatus.jsx";
import STATUSES from './statuses.json'
import SectionSelect from "./SectionSelect.jsx";

function ArticleRow({page, updatePage}) {


    let selectedClass = "";

    let hasStoryType = storyTypeLabel(page["story_type"]) != "[No label provided]";

    return <tr key={page.pk} className={selectedClass}>
            <td className="slug-cell">
                <span class="slug-link--container">
              <a className="slug-link" href={articleUrl.replace("1918", page.pk)}>
              {page["title"]}
              </a>
              </span> 
              <div className="slug-cell--button-panel">
              <LinkOpenButton url={page.assignment_folder} className={"slug-cell--hyperlink-open"} iconSize={"18px"}/>
              </div>
              <div className={`slug-cell--story-type ${hasStoryType ? "slug-cell--story-type-active" : "slug-cell--story-type-empty"}`}>{hasStoryType ? storyTypeLabel(page["story_type"]) : ""}</div>
              </td>
            <td className="authors-cell"><AuthorsSelect 
              disabled = {page.live}
              currentAuthors={page.article_authors} 
              handleUpdateAuthors={(newAuthorList) => updateAuthors(page, newAuthorList, "copy_editor", updatePage)}
              authorType={"copy_editor"}
              isPublished={page.live}
              />
            </td>
            <td className="authors-cell"><AuthorsSelect 
              disabled = {true}
              currentAuthors={page.article_authors} 
              handleUpdateAuthors={(newAuthorList) => updateAuthors(page, newAuthorList, "backfield_editor", updatePage)}
              authorType={"backfield_editor"}
              isPublished={page.live}
              />
            </td>
            <td className="section-cell"><SectionSelect section={page.current_section} updateSection={(newSection) => updateSection(page, newSection, updatePage)} styleType={"edit-field"} disabled={true}/></td>
            <td className="beat-cell"><BeatSelect beat={page.category_page} updateBeat={(newBeat) => updateBeat(page, newBeat, updatePage)} disabled={true}/></td>
            <td>
              <StatusAdvancement page={page} updateStatus={(newStatus) => updateArticleStatus(page, newStatus, updatePage)} />
            </td>
    </tr>
}

function StatusAdvancement({page, updateStatus}) {
  if (page.article_status == 4) {
    return <div className="status-advancement--container">
      <div onClick={() => updateStatus(STATUSES[3])} className='status-advancement--button status-advancement--return-edits-button'>Return</div>
      <div onClick={() => updateStatus(STATUSES[5])} className='status-advancement--button status-advancement--mark-ready-button'>Advance</div>
    </div>
  } 

  if (page.article_status == 5) {
    return <div className="status-advancement--label-container">
    <div className="status-advancement--label status-advancement--label-ready"> Copyedited </div>
    <div onClick={() => updateStatus(STATUSES[4])} className='status-advancement--button status-advancement--return-copy-button'>Return to copy</div>
    </div>
  }

  return <div className="status-advancement--label-container">
    <div className="status-advancement--label status-advancement--label-editing"> Backfield Editing </div>
    <div onClick={() => updateStatus(STATUSES[4])} className='status-advancement--button status-advancement--advance-copy-button'>Advance to copy</div>
  </div>
}



function ArticleList({allPages, updatePage}) {

  const rows = []
  
  for (const [id, page] of allPages) { // [id, page]
    rows.push(
      ArticleRow({updatePage: updatePage, page: page})
    )
  }

  if (rows.length == 0) return <div class="article-list"><Skeleton className={"article-list--skeleton"} height="1.5lh" width="82em"/><Skeleton className={"article-list--skeleton"} height="3lh" width="82em" count={10}/></div>

  return (
    <div class="article-list">
    <Table striped bordered hover>
       <thead>
            <tr class="table-header">
                <th class="slug-header">Headline</th>
                <th class="byline-header byline-header--copy">Copy Editor</th>
                <th class="byline-header byline-header--backfield">Backfield Editor</th>
                <th class="section-header">Section</th>
                <th class="beat-header">Beat</th>
                <th class="status-header">Manage Status</th>
            </tr>
        </thead>
        <tbody>
          {rows}
        </tbody>
      
    </Table>
    </div>
  )
}

function MoreArticlesButton({addPages, clearPages, pkInPages, isOnlyUserFilter, isLoading, setLoading}) {
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
      params.append("article_status", 4);
      params.append("include_published", "false");
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
  }, [isOnlyUserFilter])

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

function QueryFilterPanel({isOnlyUserFilter, setOnlyUserFilter, isLoading}) {
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
  </div>
}

export default function StoryTable({updatePage, clearPages, allPages, addPages}) {
  const [isOnlyUserFilter, setOnlyUserFilter] = useState(false);
  const [isLoading, setLoading] = useState(true);
  return <><h1>Copy View</h1>
        <QueryFilterPanel 
          isOnlyUserFilter={isOnlyUserFilter} 
          setOnlyUserFilter={setOnlyUserFilter}
          isLoading={isLoading}/>
        <ArticleList allPages={allPages} 
          updatePage={updatePage}/>
        <MoreArticlesButton 
          addPages={addPages} 
          clearPages={clearPages}
          pkInPages={(pk) => allPages.get(pk) != undefined } 
          isOnlyUserFilter={isOnlyUserFilter}
          isLoading={isLoading}
          setLoading={setLoading}/>
        </>
}