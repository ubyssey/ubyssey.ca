import React from 'react'

class ArticlePreview extends React.Component{

  createMarkup(content) {
    return {__html: content};
  }

  render() {
    const msec = Date.parse(this.props.publishTime)
    const publishedDate = new Date(msec)
    const imageStyle = {backgroundImage: `url(${this.props.featuredImageUrl})`}

    return (
      <article
        id={'suggested-article-' + String(this.props.articleId)}
        className='o-article o-article--suggested'>
          {this.props.featuredImageUrl &&
            <a href={this.props.url}>
              <div
                className='o-article__image'
                style={imageStyle}></div>
            </a>}
          <div className='o-article__meta'>
            <h3 className='o-article__headline'>
              <a href={this.props.url} dangerouslySetInnerHTML={this.createMarkup(this.props.headline)}/>
            </h3>
            <div className='o-article__byline'>
              <span className='o-article__author'>{this.props.authorString}</span> &nbsp;&middot;&nbsp; <span className='o-article__published'>{publishedDate.toDateString().slice(4)}</span>
            </div>
          </div>
      </article>
    )
  }
}

export default ArticlePreview;
