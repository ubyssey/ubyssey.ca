import RichTextEditor from "./RichTextEditor.jsx"
import {updateAssignmentMemo} from "./remoteManagement.js";



export default function AssignmentMemo({selectedPage, updatePage, isLocalOnly = false}) {
  return <RichTextEditor onBlurCallback={(e) => updateAssignmentMemo(selectedPage, e.target.innerHTML, updatePage, isLocalOnly)} defaultText={selectedPage.assignment_memo}/>
}