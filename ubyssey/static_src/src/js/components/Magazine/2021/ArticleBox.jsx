import React from "react"

function ArticleBox(props) {
  const background = props.image ? { backgroundImage: `url(${props.image})` } : null
  const transition = { transitionDelay: `${props.index * 0.125}s` }
  const boxStyle = Object.assign({}, background, transition)
  return (
    <div className={`article-grid ${props.subsection}`}>
      <a
        className={`o-article-box o-article-box--grid ${!props.transition ? "show" : ""}`}
        href={props.url + "#" + props.subsection}
        style={boxStyle}>
        <h2>{props.headline}</h2>
      </a>
    </div>
  );
}

export default ArticleBox
