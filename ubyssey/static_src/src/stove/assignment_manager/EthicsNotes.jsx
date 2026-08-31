import RichTextEditor from "./RichTextEditor.jsx";
import {updateEthicsNotes} from "./remoteManagement.js";



export default function EthicsNotes({selectedPage, updatePage, isLocalOnly = false}) {
  return <RichTextEditor onBlurCallback={(e) => updateEthicsNotes(selectedPage, e.target.innerHTML, updatePage, isLocalOnly)} defaultText={selectedPage.ethics_notes}/>
}