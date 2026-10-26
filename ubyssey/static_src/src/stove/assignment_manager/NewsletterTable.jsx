import { useState, useEffect } from "react";

import Table from 'react-bootstrap/Table';
import Button from 'react-bootstrap/Button';

import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'

import {beatLabel} from "./BeatSelect.jsx";
import AuthorsSelect, {findAuthorName, findAuthorRole} from "./AuthorSelect.jsx";
import STATUSES from './statuses.json'
import SectionSelect, {findSection} from "./SectionSelect.jsx";
import { toast } from "react-toastify";
import { Tooltip } from 'react-tooltip';



function ArticleRow({page, updatePage, scheduled = false, scheduledPublish}) {
    let selectedClass = "";

    return <><tr key={page.pk} className={selectedClass}>
            <td className="slug-cell" data-tooltip-id={`headline-copy-${page.pk}`}>
              <a className="slug-link" href={articleUrl.replace("1918", page.pk)}>
              {page["title"]}
              </a>
              </td>
            <td className="authors-cell cell-interactible-ignore-children" onClick={() => copyToClipboard(authorString(page.article_authors), "Authors")}><AuthorsSelect 
              disabled = {true}
              currentAuthors={page.article_authors} 
              handleUpdateAuthors={() => {}}
              authorType={"author"}
              isPublished={page.live}
              />
            </td>
            <td className="section-cell cell-interactible-ignore-children" data-tooltip-id={`section-copy-${page.pk}`} onClick={() => copyToClipboard(sectionBeatString(page), "Section | Beat")}>
              <SectionSelect section={page.current_section} updateSection={() => {}} styleType={"edit-field"} disabled={true}/>
              </td>
            <td className><StatusAdvancement page={page} scheduled={scheduled} scheduledPublish={scheduledPublish}/></td>
    </tr>
              <Tooltip
                  id={`headline-copy-${page.pk}`}
                  place={'right'}
                  data
                  style={{ 
                    backgroundColor: "#f6f6f6", 
                    color: "black", 
                    width: "300px", 
                    filter: 'drop-shadow(0px 4px 8px rgba(0, 0, 0, 0.2))',
                    zIndex: 100
                  }}
                  opacity={0.98}
                  delayHide={50}
                  clickable={true}
                >
                  <div className="tooltip-selection-option" onClick={() => copyToClipboard(page.title, "Section | Beat")}
                    ><strong>Headline</strong><br/>{page.title}</div>
                  <div className="tooltip-selection-option" onClick={() => copyToClipboard(getDeck(page), "Section | Beat")}
                    ><strong>Deck</strong><br/><span
                    dangerouslySetInnerHTML={{__html: getDeck(page)}}></span></div>
                  <div className="tooltip-selection-option" onClick={() => copyToClipboard(page.lede, "Section | Beat")}
                    ><strong>Standfirst</strong><br/>{page.lede}</div>
                  <div className="tooltip-selection-option" onClick={() => copyToClipboard(getPublishedUrl(page), "Section | Beat")}
                    ><strong>Published Url</strong><br/>{getPublishedUrl(page)}</div>
                  {page.featured_media ? 
                    <div className="tooltip-selection-option" onClick={() => downloadFeaturedImage(page)}
                    ><strong>Download Featured Image</strong><br/></div> : 

                    <div className="tooltip-selection-option">
                      <strong>[NO MEDIA]</strong><br/></div>
                    }
                  
           
                </Tooltip>
              <Tooltip
                  id={`section-copy-${page.pk}`}
                  place={'right'}
                  data
                  style={{ 
                    backgroundColor: "#f6f6f6", 
                    color: "black", 
                    width: "300px", 
                    filter: 'drop-shadow(0px 4px 8px rgba(0, 0, 0, 0.2))',
                    zIndex: 100
                  }}
                  opacity={0.98}
                  delayHide={400}
                  clickable={true}
                >
                  <div className="tooltip-selection-option" onClick={() => copyToClipboard(sectionBeatString(page), "Section | Beat")}
                    dangerouslySetInnerHTML={{__html: sectionBeatString(page)}}
                    ></div>
                  { page.live ? <div className="tooltip-selection-option" onClick={() => copyToClipboard(sectionDateString(page), "Section | Beat")}
                    dangerouslySetInnerHTML={{__html: sectionDateString(page)}}

                    ></div> : ""}
                </Tooltip>
                </>
}

async function downloadFeaturedImage(page) {
  let headers = {content_type: "application/json"}

  for (const key of Object.keys(requiredHeader)) {
      headers[key] = requiredHeader[key]
  }
  toast.promise(
    fetch(featuredMediaUrl.replace("1918", page.pk), {method: "GET", headers: headers, credentials: "same-origin"}).then(async (response) => {
          if (response.status != 200) {
            throw new Error(response)
          } else {
            return response.json()
          }})
        .then((json) => {
          if (json["media-url"]) return window.location.protocol + "//" + window.location.host + json["media-url"]
          throw new Error("No featured image")
        })
        .then((url) => {
          const a = document.createElement('a');
          a.href = url;
          a.download = "download"; 
          
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }),
        {
        pending: {
          render(){
            return "Downloading image for " + page.title
          },
          position: 'bottom-left',
        },
        success: {
          render() {return "Downloaded image for  " + page.title},
          autoClose: 1500},
        error: {
          render({data}) {
            return "Failed to download image for  " + page.title + " because " + data.message
          }
          
        }
      }
      )
  return ""
}

function getPublishedUrl(page) {
  if (page.url_path) return page.url_path.replace("/ubyssey/", window.location.protocol + "//" + window.location.host + "/")
  return "No url"
}

function getDeck(page) {
  try {
    return JSON.parse(page.header)[0].value["above_cut_lede"].replace(/<\/?p( ([a-z0-9 ="\-])*)?>/g, '')
  } catch (e) {
  }
  if (page.above_cut_lede) return page.above_cut_lede;
  return "No deck"
}

function sectionBeatString(page) {
  try {
    const result = "<strong>" + findSection(page.current_section).label.toUpperCase() + "</strong>"
    if (page.category_page) return  result + " | " + beatLabel(page.category_page).toUpperCase()
    else return result
  } catch (e) {
    return page.current_section
  }
}

function sectionDateString(page) {
  try {
    const result ="<strong>" + findSection(page.current_section).label.toUpperCase() + "</strong>"
    if (page.first_published_at) return result + " | " + humanizeDate(new Date(page.first_published_at))
    else return result;
  } catch (e) {
    return page.current_section
  }
}

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
const shortMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

function humanizeDate(date, shortMonth = false) {
  return (shortMonth ? shortMonths[date.getMonth()] : months[date.getMonth()]) + " " + date.getDate() + ", " + date.getFullYear()
}

function authorString(currentAuthors) {
  const reportageAuthors = currentAuthors.filter((author)=>author.author_role=="author")
  if (reportageAuthors.length == 1) {
    const authorName = findAuthorName(reportageAuthors[0].author)
    const role = findAuthorRole(reportageAuthors[0].author)
    if (role) return authorName + ", <i>" + role + "</i>";
    else return authorName
  }

  if (reportageAuthors.length == 2) {
    return findAuthorName(reportageAuthors[0].author) + " & " + findAuthorName(reportageAuthors[1].author)
  }

  if (reportageAuthors.length >= 3) {
    const authorNames = reportageAuthors.map((author) => findAuthorName(author.author))
    return authorNames.slice(0, -1).join(', ') + ' & ' + authorNames[authorNames.length - 1];
  }

  return "Quyen"
}

function StatusAdvancement({page, updateStatus, scheduled = false, scheduledPublish}) {
  if (page.live) {

    if (scheduled) {
      return <div className="status-advancement--label-container">
        <div className="status-advancement--label status-advancement--label-published status-advancement--label-homepage"> Published | Home </div>
        <div onClick={() => updateStatus(STATUSES[4])} className='status-advancement--button status-advancement--label-published status-advancement--label-homepage'>
          {scheduledPublish ? 
            humanizeDate(scheduledPublish, true) : "Not Scheduled"}
        </div>
      </div>
    }

    return <div className="status-advancement--label-container">
    <div className="status-advancement--label status-advancement--label-published"> 
      Published
     </div>
    <div onClick={() => updateStatus(STATUSES[4])} className='status-advancement--button status-advancement--label-published'>
    {humanizeDate(new Date(page["last_published_at"]), true)}
    </div>
    </div>
  }

  if (scheduled) {
      return <div className="status-advancement--label-container">
        <div className="status-advancement--label status-advancement--label-published status-advancement--label-homepage"> Ready | Home </div>
        <div onClick={() => copyToClipboard("hello there", "Clicked!")} className='status-advancement--button status-advancement--label-published status-advancement--label-homepage'>
          {scheduledPublish ? 
            humanizeDate(scheduledPublish, true) : "Not Scheduled"}
        </div>
      </div>
    }

  return <div className="status-advancement--label-container">
    <div className="status-advancement--label status-advancement--label-ready"> Ready </div>
    <div className='status-advancement--button status-advancement--label-ready'>
      Ready
    </div>
  </div>

}

async function copyToClipboard(text, title) {
  const data = {
    "text/html": text,
    "text/plain": text.replace(/<\/?[a-z]+( ([a-zA-Z0-9 ="\-:/\.])*)?>/g, ''),
  };
  const htmlClipboardItem = new ClipboardItem(data);
  
  toast.promise(
    navigator.clipboard.write([htmlClipboardItem]),
    {
        pending: {
          render(){
            return "Copying " + title
          },
          position: 'bottom-left',
        },
        success: {
          render() {return "Copied " + title},
          autoClose: 1500},
        error: {
          render() {
            return "Failed to copy " + title
          }
          
        }
        
      }
    )
}



function ArticleList({allPages, updatePage, currentlyCurated, scheduledPublish}) {

  const rows = []

  for (const id of currentlyCurated) {
    if (allPages.get(id))
      rows.push(
        ArticleRow({updatePage: updatePage, page: allPages.get(id), scheduled: true, scheduledPublish: scheduledPublish})
      )
  }
  
  for (const [id, page] of allPages) {
    if (currentlyCurated.includes(id)) continue;

    rows.push(
      ArticleRow({updatePage: updatePage, page: page, scheduled: false, scheduledPublish: scheduledPublish})
    )
  }

  if (rows.length == 0) return <div class="article-list"><Skeleton className={"article-list--skeleton"} height="1.5lh" width="82em"/><Skeleton className={"article-list--skeleton"} height="3lh" width="82em" count={10}/></div>

  return (
    <div class="article-list">
    <Table striped bordered hover>
       <thead>
            <tr class="table-header">
                <th class="slug-header">Headline</th>
                <th class="byline-header byline-header--copy">Author</th>
                <th class="section-header">Section</th>
                <th class="status-header">Status</th>
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
      params.append("article_status", 5);
      params.append("include_published", "true");
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
  </div>
}

export default function StoryTable({updatePage, clearPages, allPages, addPages}) {
  const [isOnlyUserFilter, setOnlyUserFilter] = useState(false);
  const [isLoading, setLoading] = useState(true);
  const [currentlyCurated, setCurrentlyCurated] = useState([])
  const [scheduledPublish, setScheduledPublish] = useState()

  useEffect(() => {
    fetch(scheduledStoriesUrl).then((response) => response.json().then((json) => {
        setCurrentlyCurated(json["curated"])
        if (json["homepageSchedule"] != null) setScheduledPublish(new Date(json["homepageSchedule"]))
    }));
  }, [])


  return <><h1 className="story-table-title">Newsletter</h1>
        <QueryFilterPanel 
          isOnlyUserFilter={isOnlyUserFilter} 
          setOnlyUserFilter={setOnlyUserFilter}
          isLoading={isLoading}/>
        <ArticleList allPages={allPages} 
          updatePage={updatePage}
          currentlyCurated={currentlyCurated}
          scheduledPublish={scheduledPublish}/>
        <MoreArticlesButton 
          addPages={addPages} 
          clearPages={clearPages}
          pkInPages={(pk) => allPages.get(pk) != undefined } 
          isOnlyUserFilter={isOnlyUserFilter}
          isLoading={isLoading}
          setLoading={setLoading}/>
        </>
}