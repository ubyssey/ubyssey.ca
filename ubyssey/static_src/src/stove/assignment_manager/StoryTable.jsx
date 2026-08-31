import { useState, useEffect } from "react";

import Switch from "react-switch";

import { HeadsetOutline, PrintOutline, ImageOutline, BrushOutline, VideocamOutline,PencilOutline, Eye} from 'react-ionicons'

import Table from 'react-bootstrap/Table';
import Button from 'react-bootstrap/Button';

import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'

import Deadline, {getDeadlineIcon, getEarliestUncompletedDeadline, getDeadlineByDescription} from "./Deadline.jsx";
import DateInput from "./DateInput.jsx";
import deadlineOptions from './DeadlineOptions.json'
import {updateArticleStatus, updateAuthors, updateBeat, updateDeadline} from "./remoteManagement.js";
import {storyTypeLabel} from "./StoryTypeSelect.jsx";
import BeatSelect from "./BeatSelect.jsx";
import {LinkOpenButton} from "./LinkInput.jsx";
import AuthorsSelect from "./AuthorSelect.jsx";
import ArticleStatus from "./ArticleStatus.jsx";
import statuses from './statuses.json'
import {SIDEBAR_TYPES} from "./StorySidebar.jsx";
import { Tooltip } from "react-tooltip";

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

    let earliestIncompleteDeadline = getEarliestUncompletedDeadline(page)
    if (earliestIncompleteDeadline == null) {
      earliestIncompleteDeadline = getDeadlineByDescription(page, deadlineOptions.DRAFT_IN)
      if (earliestIncompleteDeadline == null) {
        earliestIncompleteDeadline = {description: deadlineOptions.DRAFT_IN, date: null}
      }
    }

    return <tr key={page.pk} className={selectedClass}>
            <td class="slug-cell">
                <span class="slug-link--container">
              <a class="slug-link" href={articleUrl.replace("1918", page.pk)}>
              {page["title"]}
              </a>
              </span> 
              <div className="slug-cell--button-panel">
              <button class="slug-cell--edit-button" onClick={() => setSidebar(SIDEBAR_TYPES.EDIT)}><PencilOutline
                color={'#00000'} 
                height={"18px"}
                width={"18px"}
              /></button>
              <button class="slug-cell--preview-button" onClick={() => setSidebar(SIDEBAR_TYPES.PREVIEW)}><Eye 
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
            <td className={`deadline-cell`}>
              <div className="deadline-cell--container">
              <DateInput className='deadline-cell--date-input' date={earliestIncompleteDeadline.date} handleUpdateDate={(newDate) => updateDeadline(page, {date: newDate, description: earliestIncompleteDeadline.description, completed: false}, updatePage)} disabled={page.live}/> 
                 <div className='deadline-cell--extended-indicator' data-tooltip-id={`deadline-additional-${page.pk}`}>{getDeadlineIcon(earliestIncompleteDeadline)}</div>
              </div>
              
              <Tooltip
                id={`deadline-additional-${page.pk}`}
                place={'right'}
                style={{ 
                  backgroundColor: "#f6f6f6", 
                  color: "black", 
                  width: "300px", 
                  filter: 'drop-shadow(0px 4px 8px rgba(0, 0, 0, 0.2))',
                  zIndex: 100
                }}
                opacity={0.98}
                delayHide={150}
              >
                { page.deadline_list.length != 0 ?
                <Deadline
                  page={page}
                  updatePage={updatePage}
                  />
                  
                  : "Add a deadline for when this story's draft should be submitted" }
              </Tooltip>
              
            </td>
              
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

export default function StoryTable({updatePage, selectedArticleId, setSelectedArticleId, setActiveSidebar, clearPages, allPages, addPages}) {
  const [isOnlyUserFilter, setOnlyUserFilter] = useState(false);
  const [isIncludingPublished, setIsIncludingPublished] = useState(false);
  const [isLoading, setLoading] = useState(true);
  return <><h1>{pageSection} Articles</h1>
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
        </>
}