import { useState, useEffect } from "react";
import { FolderOpen, FolderOpenOutline} from 'react-ionicons'
import {updateAssignmentFolder} from './remoteManagement';

export function isValidUrl(url) {
  const urlRegex = /https?:\/\/..*\...*/g

  return url.match(urlRegex)
}



export default function LinkInput ({selectedPage, updatePage, isLocalOnly=false}) {
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

export function LinkOpenButton ({url, className, iconSize}) {
  let button;

  if (url != null && url != '') {

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