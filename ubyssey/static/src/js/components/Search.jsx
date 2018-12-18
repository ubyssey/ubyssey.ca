import React from 'react'
import LRU from 'lru-cache'
import DispatchAPI from '../api/dispatch'

class Search extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      results: [],
      cache: LRU(this.props.cacheOptions), // entries are {q: results}
      q: '',
      prevQ: ''
    }
  }

  componentDidMount() {
    this.refs.search.getDOMNode().focus()
  }

  updateQuery(event) {
    this.setState(
      {
        prevQ: this.state.q,
        q: event.target.value
      },
      this.search
    )
  }

  search() {
    const q = this.state.q
    if (q.length > 0) {
      if (q.length > 1 && q.length > this.state.prevQ.length && this.state.results.length == 0) {
        // We've already typed one char and got no results, so
        // adding more chars to query (making it more specific) cannot help.
        return
      }

      if (this.state.cache.has(q)) {
        this.setState({ results: this.state.cache.get(q) })
      } else {
        DispatchAPI.articles.search(q).then(response => {
          this.setState(prevState => {
            prevState.results = response.results
            prevState.cache.set(q, response.results)
            return prevState
          })
        })
      }
    } else {
      this.setState({ results: [] })
    }
  }

  render() {
    const results = this.state.results.map((item, i) => (
      <li key={i}>
        <a href={item.url}>{item.headline}</a>
      </li>
    ))

    return (
      <div className="u-container">
        <form method="get" action="/archive/">
          <label htmlFor="author-search">
            <i className="fa fa-search" />
          </label>
          <input
            ref="search"
            className={this.state.results.length > 0 ? 'open' : ''}
            name="q"
            id="search-bar"
            type="text"
            autoComplete="off"
            onChange={e => this.updateQuery(e)}
            value={this.state.q}
            placeholder="Search The Ubyssey..."
          />
        </form>
        <ul className={'results' + (this.state.results.length > 0 ? ' open' : '')}>{results}</ul>
      </div>
    )
  }
}

Search.defaultProps = {
  cacheOptions: {
    max: 150
  }
}

export default Search
