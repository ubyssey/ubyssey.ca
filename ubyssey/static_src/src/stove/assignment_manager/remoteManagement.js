import { toast } from "react-toastify";
import { isValidUrl } from "./LinkInput.jsx";

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
}

export async function updateTitle(page, newTitle, updatePage) {

  page.title = newTitle

  updatePage(page)

  handleRemoteUpdate(page, {"title": page.title}, updatePage,
    "Updating title for " + page.title, 
    "Updated title for " + page.title, 
    "Failed to title for " + page.title)
}

export async function updateArticleStatus(page, newStatus, updatePage, isLocalOnly=false) {
  updatePage({... page, article_status: newStatus.value})
  
  if (!isLocalOnly) {
    handleRemoteUpdate(page, {"article_status": newStatus.value}, updatePage,
      "Updating status for " + page.title + " to " + newStatus.label, 
      "Updated status for " + page.title + " to " + newStatus.label, 
      "Failed to update status for " + page.title + " to " + newStatus.label)
  }
}

export async function updateAssignmentMemo(page, newMemo, updatePage, isLocalOnly = false) {
  if (page["assignment_memo"] == newMemo) return;

  updatePage({...page, assignment_memo: newMemo})

  if(!isLocalOnly) {
    handleRemoteUpdate(page, {"assignment_memo": newMemo}, updatePage,
      "Updating assignment memo for " + page.title, 
      "Updated assignment memo for " + page.title, 
      "Failed to assignment memo for " + page.title)
  }

}

export async function updateAuthors(page, newAuthorList, role, updatePage, isLocalOnly=false) {

  page.article_authors = page.article_authors.filter((author) => author.author_role != role)

  for (const author of newAuthorList) {
    page.article_authors.push({article_page: page.pk, author_role: role, author: author.value})
  } 

  updatePage(page)

  if (!isLocalOnly) {
    handleRemoteUpdate(page, {"authors": page.article_authors}, updatePage,
      "Updating authors for " + page.title, 
      "Updated authors for " + page.title, 
      "Failed to authors for " + page.title)
  }

}

export async function updateBeat(page, newBeat, updatePage, isLocalOnly=false) {
  updatePage({... page, category_page: newBeat.value})

  if (!isLocalOnly) {
  handleRemoteUpdate(page, {"category": newBeat.label}, updatePage,
    "Updating beat for " + page.title + " to " + newBeat.label, 
    "Updated beat for " + page.title + " to " + newBeat.label, 
    "Failed to update beat for " + page.title + " to " + newBeat.label)
  }
}

export async function updateDeadlineList(page, newDeadlineList, updatePage, isLocalOnly=false) {
  updatePage({... page, deadline_list: newDeadlineList})

  if (!isLocalOnly) {
    handleRemoteUpdate(page, {"deadline_list": newDeadlineList}, updatePage,
      "Updating deadline for " + page.title, 
      "Updated deadline for " + page.title, 
      "Failed to update deadline for " + page.title)
  }
}

export async function updateEthicsNotes(page, newEthics, updatePage, isLocalOnly = false) {
  if (page.ethics_notes == newEthics) return;

  updatePage({...page, ethics_notes: newEthics})


  if(!isLocalOnly) {
    handleRemoteUpdate(page, {"ethics_notes": newEthics}, updatePage,
      "Updating ethics notes for " + page.title, 
      "Updated ethics notes for " + page.title, 
      "Failed to update ethics notes for " + page.title)
  }
}


export async function updateDeadline(page, newDeadline, updatePage, isLocalOnly=false) { //TODO
  let {date, description, completed} = newDeadline
  let deadlineList = [...page.deadline_list]
  let updated = false

  if (typeof date !== "string") {
    date=date.toISOString()
  }

  deadlineList = deadlineList.map(deadline => {
    if (deadline.description !== description) {
      return deadline
    } else {
      updated=true;
      deadline.date = date;
      deadline.completed = completed;
      return deadline;
    }
  })
  if (!updated) {
    deadlineList = [... deadlineList,
      {
        completed: completed,
        date: date,
        description: description
      }
    ]
  }

  updateDeadlineList(page, deadlineList, updatePage, isLocalOnly)

}

export async function updateAssignmentFolder(page, newAssignmentFolder, updatePage, isLocalOnly=false) {
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

export async function updateSection(page, newSection, updatePage, isLocalOnly=false) {
  updatePage({... page, current_section: newSection.value})

  if (!isLocalOnly) {
    handleRemoteUpdate(page, {"current_section": newSection.value}, updatePage,
      "Updating beat for " + page.title + " to " + newSection.label, 
      "Updated beat for " + page.title + " to " + newSection.label, 
      "Failed to update beat for " + page.title + " to " + newSection.label)
  }
}

export async function updateStoryType(page, newStoryType, updatePage, isLocalOnly=false) {
  updatePage({... page, story_type: newStoryType.value})

  if (!isLocalOnly) {
  handleRemoteUpdate(page, {"story_type": newStoryType.value}, updatePage,
    "Updating story type for " + page.title + " to " + newStoryType.label, 
    "Updated story type for " + page.title + " to " + newStoryType.label, 
    "Failed to update story type for " + page.title + " to " + newStoryType.label)
  }
}

export async function remoteCreatePage(page) {
  let headers = {content_type: "application/json"}

  for (const key of Object.keys(requiredHeader)) {
      headers[key] = requiredHeader[key]
  }

  if (!page.current_section) {
    throw new Error("Pages must have a section")
  }
  return fetch(createPageUrl.replace("1918", page.current_section), { method: "POST", headers: headers, body: JSON.stringify(page),
    credentials: "same-origin"})
    .then(async (response) => {
      if (response.status != 200) {
        const errorText = await response.text()
        throw new Error(errorText)
      } else {
        return response.json()
      }}
    );
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