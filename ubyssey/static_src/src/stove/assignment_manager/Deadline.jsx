import { useState, useEffect } from "react";
import { SquareOutline, CheckboxOutline, CloseOutline } from 'react-ionicons'
import "react-datepicker/dist/react-datepicker.css";
import deadlineOptions from './DeadlineOptions'
import DateInput from "./DateInput.jsx";
import { updateDeadline, updateDeadlineList } from "./remoteManagement.js";

import { CloudUploadOutline, CloudUpload, NewspaperOutline, Newspaper, ColorWandOutline, ColorWand, GlobeOutline, Globe, MicOutline, Mic, StarOutline, Star} from 'react-ionicons'



export function getDeadlineDate(page, deadlineDescription) {
  for (const deadline of page.deadline_list) {
    if (deadline.description == deadlineDescription) {
      return deadline.date;
    }
  }
  return null;
}

function getDeadlineByDescription(page, deadlineDescription) {
  for (const deadline of page.deadline_list) {
    if (deadline.description == deadlineDescription) {
      return deadline;
    }
  }
  return null;
}

export function hasAdditionalDeadlines(page) {
  for (const deadline of page.deadline_list) {
    if (deadline.description != deadlineOptions.DRAFT_IN) {
      return true;
    }
  }
  return false;
}

export function getEarliestUncompletedDeadline(page) {
  let earliestUncompleteDeadline = {date: 8.64e15}
  for (const currDeadline of page.deadline_list) {
    if (!currDeadline.completed && new Date(currDeadline.date).valueOf() < new Date(earliestUncompleteDeadline.date).valueOf()) {
      earliestUncompleteDeadline = currDeadline
    }
  }
  if (earliestUncompleteDeadline.description != null) return earliestUncompleteDeadline;
  return null;
}

export function getDeadlineIcon(deadline) {
  const overdue = new Date(deadline.date).valueOf() < Date.now()

  switch (deadline.description) {
    case deadlineOptions.DRAFT_IN:
      return overdue && deadline.date?
        <Newspaper 
          color={'#dc4f3e'} /> :
        <NewspaperOutline/>
    case deadlineOptions.RESEARCH:
      return overdue ?
        <Globe
          color={'#dc4f3e'}/> :
        <GlobeOutline />
    case deadlineOptions.QUESTIONS:
      return overdue ?
        <div
          style={{
            color: '#dc4f3e',
            fontWeight: "bold"
          }}> ? </div> :
        <div
          style={{
            fontWeight: "bold"
          }}> ? </div>
    case deadlineOptions.SOURCES:
      return overdue ?
        <Mic
          color={'#dc4f3e'}/> :
        <MicOutline />
    case deadlineOptions.EDITING:
      return overdue ?
        <ColorWand
          color={'#dc4f3e'}/> :
        <ColorWandOutline />
    case deadlineOptions.PUBLISHING:
      return overdue ?
        <CloudUpload
          color={'#dc4f3e'}/> :
        <CloudUploadOutline />
    default:
      return overdue ?
        <Star
          color={'#dc4f3e'}
          />
          :
          <StarOutline />
  }
}

function DeadlineCheckbox({completed, updateChecked, invalid = false}) {
  return <div className={`edit-field--checkbox ${invalid ? "edit-field--checkbox-invalid" : ""}`}
    onClick={()=>updateChecked(!completed)}>
    {completed ? <CheckboxOutline height="1lh"/> : <SquareOutline height={"1lh"}/>}
  </div>
}

function DeadlineClear({clearDeadline}) {

  return <div className={`edit-field--date-clear`}
    onClick={clearDeadline}>
      <CloseOutline height="1lh" />
  </div>
}

function DeadlineItem({deadline, updateDeadline, clearDeadline, canEditName=false, overrideDescription=false}) {
  let description, completed, date;
  if (deadline != null) {
    description = deadline.description;
    completed = deadline.completed;
    date = deadline.date;
  } else {
    description = ""
    completed = false
    date = null
  }

  return <div className={`edit-field--sidebyside ${completed ? "edit-field--checked" : ""}`}>
    <div 
      className="edit-field--side-label edit-field--deadline-entry edit-field--deadline-label"
      >
      <DeadlineCheckbox
        completed = {completed}
        updateChecked={(newValue) => updateDeadline({date: date, description: description, completed: newValue})}
        invalid = {!date}
        />
      <div className={`edit-field--label-text ${canEditName ? "edit-field--label-editable" : ""}`} contentEditable={canEditName}>{overrideDescription ? "Deadline" : description.toString()}</div></div>
    <div className={`edit-field--date ${date || canEditName ? "edit-field--date-clearable" : ""}`} >
          <DateInput 
            date={date} 
            handleUpdateDate={(newDate) => updateDeadline({date: newDate, description: description, completed: completed})}
            disabled={completed}/>
          {date || canEditName ? <DeadlineClear 
            clearDeadline={() => clearDeadline(deadline)}/> : ""}
    </div>
  </div>
}

function AddDeadlineItem({addDeadline}) {

  function processInput(e) {
    if (e.target.value) addDeadline({description: e.target.value, date: null, completed: false})
    e.target.value = ""
  }

  return <div className={`edit-field--add-deadline`} >
        <input 
          className="edit-field--add-deadline-input" 
          type="text" 
          placeholder="Add..." 
          onBlur={processInput}
          onKeyDown={ (event) => {
            if (event.key == "Enter") processInput(event)
          }}></input></div>

}

export default function Deadline({page, updatePage, isLocalOnly=false}) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => setExpanded(false), [page.pk])

  function clearDeadline(deadline) {
    let newDeadlineList = []
    for (const existingDeadline of page.deadline_list) {
      if (existingDeadline.description != deadline.description) newDeadlineList.push(existingDeadline)
    }
    updateDeadlineList(page, newDeadlineList, updatePage, isLocalOnly)
  }

  if (page.deadline_list.length <= 1 && !expanded) {
    return <div className="edit-field--deadlines">
        <DeadlineItem 
          deadline={getDeadlineByDescription(page, deadlineOptions.DRAFT_IN)}
          updateDeadline={(newDeadline) => updateDeadline(page, {...newDeadline, description: deadlineOptions.DRAFT_IN}, updatePage, isLocalOnly)}
          overrideDescription={true}
          clearDeadline={clearDeadline}
        />
      <div className="edit-field--more-deadlines" onClick={() => setExpanded(true)}>More...</div></div>
  }
  const deadlineHtml = []

  if (expanded) {
    let standardDeadlines = {}
    for (const [key, label] of Object.entries(deadlineOptions)) {
      standardDeadlines[key] = getDeadlineByDescription(page, label)
    }
    for (const [key, deadline] of Object.entries(standardDeadlines)) {
      deadlineHtml.push(
        <DeadlineItem 
          deadline={deadline ? deadline : {description: deadlineOptions[key], completed: false, date: null}}
          updateDeadline={(newDeadline) => updateDeadline(page, newDeadline, updatePage, isLocalOnly)}
          overrideDescription={false}
          clearDeadline={clearDeadline}
        />
      )
    }
  }

  const deadlinesToDisplay = expanded ?
    page.deadline_list.filter(({description}) => !Object.values(deadlineOptions).includes(description)) :
    page.deadline_list
  for (const deadline of deadlinesToDisplay) {
    deadlineHtml.push(
      <DeadlineItem 
          deadline={deadline}
          updateDeadline={(newDeadline) => updateDeadline(page, newDeadline, updatePage, isLocalOnly)}
          overrideDescription={false}
          canEditName={!Object.values(deadlineOptions).includes(deadline.description)}
          clearDeadline={clearDeadline}
        />)
  }
  return <>
    <h5>Deadlines</h5>
    <div className="edit-field--deadlines">

        {deadlineHtml} 

      {!expanded ? 
        <div className="edit-field--more-deadlines" onClick={() => setExpanded(true)}>More...</div> : 
        <AddDeadlineItem addDeadline={(newDeadline) => updatePage({...page, deadline_list: [...page.deadline_list, newDeadline]})}/>}
    </div>
    </>;

}


