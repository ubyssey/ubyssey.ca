import Select from 'react-select';
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'

const roleColours = {
    "author": "#e6e6e6",
    "backfield_editor": "#f5c554",
    "copy_editor": "#77c0d2",
    "published_author":  "#c0e5bd"
}

function findAuthorName(authorId) {
  for (let entry in authors) {
    const author = authors[entry]
    if (author["value"] == authorId) {
      return author["label"]
    }
  }
  return "";
}





export default function AuthorsSelect ({currentAuthors, handleUpdateAuthors, authorType, styleType="edit-field", disabled, isPublished}) {
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