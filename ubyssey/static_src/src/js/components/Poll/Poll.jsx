import React from 'react'
import DispatchAPI from '../../api/dispatch'

import Cookies from 'js-cookie'
import PollAnswer from './PollAnswer.jsx'

const COLOR_OPACITY = .8

class Poll extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      answers: [],
      answerIds: [],
      votes: [],
      checkedAnswers: [],
      hasVoted: false,
      pollQuestion: '',
      loading: true,
      totalVotes: 0,
      showResults: false,
      pollOpen: true,
    }
  }

  getCookieName() {
    return 'poll_id_' + String(this.props.id)
  }

  getCookie(field) {
    let cookie = Cookies.get(this.getCookieName())
    if (typeof cookie === 'string' && cookie !== '') {
      cookie = JSON.parse(cookie)
      if (field) {
        return cookie[field]
      }
      return cookie
    }
    return cookie
  }

  setCookie(voteId, answerId, init) {
    if (this.state.pollOpen || init) {
      Cookies.set(
        this.getCookieName(),
        {poll_id: this.props.id, vote_id: voteId, answer_id: answerId},
        { path: '/' }
      )
    }
  }

  componentDidMount() {
    const answerId = Number(this.getCookie('answer_id'))
    this.update(answerId)
  }

  update(answerId) {
    DispatchAPI.polls.get(this.props.id)
    .then ((response)=> {
      let answers = []
      let votes = []
      let answerIds = []
      let voteId = this.getCookie('vote_id')

      let checkedAnswers = this.state.checkedAnswers || []
      let hasVoted = this.state.hasVoted

      for (let answer of response.answers) {
        answers.push(answer['name'])
        votes.push(answer['vote_count'])
        answerIds.push(answer['id'])
      }

      if (answerId) {
        checkedAnswers = this.state.checkedAnswers.concat(this.state.answerIds.indexOf (answerId))
        hasVoted = true
      }

      let totalVotes = response.total_votes
      this.setState({
        answers: answers,
        answerIds: answerIds,
        votes: votes,
        voteId: voteId,
        pollQuestion: response.question,
        loading: false,
        totalVotes: totalVotes,
        showResults: response.show_results,
        pollOpen: response.is_open,
        checkedAnswers: checkedAnswers,
        hasVoted: hasVoted
      })
    })
  }

  changeAnswers(e, index) {
    if (!this.state.hasVoted) {
      let deselect = false
      let newCheckedAnswers = this.state.checkedAnswers

      if (this.state.checkedAnswers.includes(index)) {
        newCheckedAnswers.splice(this.state.checkedAnswers.indexOf (index), 1)
        deselect = true
      }

      if (!this.props.many) {
        newCheckedAnswers = []
        newCheckedAnswers.push(index)
      }

      else if (this.props.many) {
        newCheckedAnswers.push(index)
      }

      this.setState({
        checkedAnswers: newCheckedAnswers,
        hasVoted: true
      }, () => {
        if (!deselect) {
          this.vote();
        }
      })
    }
  }

  vote() {
    for (let index of this.state.checkedAnswers) {
      const payload = {
        poll_id: this.props.id,
        vote_id: this.state.voteId,
        answer_id: this.state.answerIds[this.state.checkedAnswers[0]]
      }
      DispatchAPI.polls.vote(this.props.id, payload).then (response => {
        this.setCookie(response.id, this.state.answerIds[index])
        this.update()
      })
    }
  }

  getPollResult(index) {
    if (this.state.showResults) {
      let width = 0

      if (this.state.totalVotes !== 0) {
        width = String((100*this.state.votes[index]/this.state.totalVotes).toFixed(0)) + '%'
      }

      return width
    }
  }

  renderPollClosed() {
    return (
      <div className='poll-overlay'>
        <div className='poll-overlay-blur' />
        <div className='poll-overlay-content'>
          <span><h2>This poll is currently closed</h2></span>
        </div>
      </div>
    )
  }

  renderLoadingPoll() {
    return (
      <span dangerouslySetInnerHTML={{__html: this.props.loaderHTML}}></span>
    )
  }

  renderShowResults(totalVotes) {
    return (
      <div>
        <div className='poll-total'>Total Votes: {totalVotes}</div>
        <button className='c-button c-button--small' onClick={() => this.setState({hasVoted: false})}>Change Vote</button>
      </div>
    )
  }

  renderNoResults() {
    return (
      <div className='poll-overlay'>
        <div className='poll-overlay-blur' />
        <div className='poll-overlay-content'>
          <h3>Thank you for your opinion</h3>
          <p>Poll results hidden from public</p>
        </div>
      </div>
    )
  }

  render() {
    const {answers, checkedAnswers, hasVoted, pollQuestion, many,
      loading, totalVotes, showResults, pollOpen} = this.state

    const pollResult = hasVoted ? 'poll-results' : 'poll-voting'
    const buttonStyle = hasVoted ? 'poll-button-voted': 'poll-button-no-vote'
    const showResult = showResults ? (hasVoted ? COLOR_OPACITY : 0) : 0
    const notShowResult = showResults ? (hasVoted ? 0 : COLOR_OPACITY) : COLOR_OPACITY
    
    return (
      <div className='poll-wrapper'>
        {!loading &&
          <div className={['c-info-box', 'poll-container', pollResult].join(' ')}>
            <div className='poll-inner-container'>
              <h1>{pollQuestion}</h1>
              <form className='poll-answer-form'>
                {answers.map((answer, index) =>{
                  let isSelected = checkedAnswers.includes(index) ? 'poll-selected' : 'poll-not-selected'
                  let buttonSelected = checkedAnswers.includes(index) ? 'poll-button-selected' : 'poll-button-not-selected'
                  let answerPercentage = this.getPollResult(index)
                  return (
                    <PollAnswer
                      key={index}
                      many={many}
                      index={index}
                      answer={answer}
                      hasVoted={hasVoted}
                      showResults={showResults}
                      checkedAnswers={checkedAnswers}
                      answerPercentage={answerPercentage}
                      changeAnswers={(e) => this.changeAnswers(e, index)}
                      />
                  )
                })}
              </form>
            </div>
            { !pollOpen && this.renderPollClosed() }
            { (pollOpen && hasVoted && !showResults) && this.renderNoResults() }
          </div>
        }
        { (pollOpen && hasVoted && showResults) && this.renderShowResults(totalVotes) }

        { loading && this.renderLoadingPoll() }
      </div>
    )
  }
}

export default Poll
