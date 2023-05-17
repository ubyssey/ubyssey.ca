
import React from 'react'
import { ArticlePreview } from './'
import DispatchAPI from '../../api/dispatch'

class ArticlesSuggested extends React.Component{
  constructor(props) {
    super(props)

    var articles = props.articles
    articles.unshift(props.currentArticle.id)

    this.articlesTable = {};
    this.articlesTable[this.props.currentArticle.id] = 0;

    this.state = {
      articles: [props.currentArticle],
      loading: false
    }
  }

  componentDidMount() {
    for (let id of this.props.articles) {
      this.getArticle(id)
    }
  }

  getArticle(id) {
    DispatchAPI.articles.rendered(id)
    .then((response) => {
      const articles = [...this.state.articles, response]
      this.setState({articles})
    })
  }

  render() {
    const articles = this.state.articles.map((article, index) => {
      // only show 3 suggested articles
      if (index !== 0 && article.headline !== this.props.currentArticle.headline) {
        let featuredImage = article.featured_image
        if(featuredImage) {
          featuredImage = featuredImage.image.url
        }

        return (
          <ArticlePreview
            articleId={article.id}
            headline={article.headline}
            url={article.url}
            authorString={article.authors_string}
            publishTime={article.published_at}
            featuredImageUrl={featuredImage}
            key={index} />
        )
      }
    });

    return (
      <div className='sa-container-outer'>
        <h2 className='bottom-banner__title'>Suggested Articles</h2>
        <div className={'sa-container-inner'}>
          {articles.filter((article) => {if (article) {return article}}).slice(0, 3)}
        </div>
      </div>
    );
  }
}

export default ArticlesSuggested;
