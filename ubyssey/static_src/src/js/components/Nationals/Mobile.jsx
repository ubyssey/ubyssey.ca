import React from 'react'
import Mvp from './Mvp.jsx'
import TeamContent from './TeamContent.jsx'

class Mobile extends React.Component {
  constructor(props){
    super(props)
    this.preId = 'c-n-team-'
    this.state = {
      heights: this.props.teamData.map(() => {return '100%'})
    }
  }

  componentDidMount() {
    let newHeights = this.state.heights.map((height, index) => {
      let temp = 0
      for (const element of document.getElementById('c-n-team-' + index).children) {
        temp += element.clientHeight + 32
      }
      return temp
    })
    this.setState({
      heights: newHeights
    })
  }

  renderTeamHeader(team) {
    return(
      <div className='c-n-team-header'
        style={{backgroundColor: team.colors[0]}}
        onClick={() => {this.props.selectTeam(team)}}>
        <div className='c-n-image-container'>
          <div className='c-n-image' style={{backgroundImage: 'url("' + team.image.thumbnail + '")'}} />
        </div> 
        <span className='c-n-title'>{team.name}</span>
      </div>
    )
  }

  renderTeamContent(index, team, isSelected) {
    const teamId = this.preId + index
    return(
      <div id={teamId} style={{height: isSelected ? this.state.heights[index]: 0}}>
        <TeamContent ref='teamContent' 
          team={team} 
          isDesktop={this.props.isDesktop} />
        <Mvp ref='mvp'
          player={team.player}
          primaryColor={team.colors[0]}
          isDesktop={this.props.isDesktop}/>
      </div>
    )
  }

  render() {
    const {selectedTeam, teamData} = this.props
    return (
      <div className='c-n-content-container'>
        {teamData.map((team, index) => {
          return(
            <div className='c-n-team-container' >
              {this.renderTeamHeader(team)}
              {this.renderTeamContent(index, team, (selectedTeam ? selectedTeam.name === team.name: false))}
            </div>
          )
        })}
      </div>
    )
  }
}

var styles = {
  map: {
    position: 'relative',
    height: 'auto',
    width: '90vw',
    margin: '2rem auto',
  },
  logo: {
    top: '0',
    left: '0',
    transform: 'translate(-50%, 0%)',
    transition: 'all 0.1s ease-out 0s'
  },
  title: {
    fontSize: '1.8rem',
    fontWeight: 400,
    fontFamily: "'Roboto', Helvetica, Arial, sans-serif",
    textAlign: 'center'
  }
}

export default Mobile


