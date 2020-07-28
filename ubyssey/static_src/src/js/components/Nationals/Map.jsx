import React from 'react'

class Map extends React.Component {
  constructor(props){
    super(props)
  }

  resetMap() {
    this.props.resetMap()
  }

  renderLogos(team) {
    let logoStyle = {transform: 'translate(-50%, -50%)',}

    if (this.props.selectedTeam && team.name === this.props.selectedTeam.name) {
      Object.assign(logoStyle, {height: '60%', top: '30%', left: '50%', zIndex: 10})
    } else if (this.props.selectedTeam) {
      Object.assign(logoStyle, {zIndex: 0, top: team.location[0] + '%', left: team.location[1] + '%'})
    } else {
      Object.assign(logoStyle, {top: team.location[0] + '%', left: team.location[1] + '%'})
    }

    return(
      <img className='c-nationals-map-marker'
        src={team.image.thumbnail} 
        alt=""
        onClick={() => {this.props.selectTeam(team)}}
        style={logoStyle}/>
    )
  }

  render() {
    return (
      <div id='c-nationals-map' >
        <svg xmlns="http://www.w3.org/2000/svg" 
          className='c-n-map'
          viewBox={this.props.mapViewBox.join(' ')}
          onClick={() => {this.resetMap()}}
          dangerouslySetInnerHTML={{__html: this.props.mapPath}} />

        {this.props.teamData.map((team) => {
          return(this.renderLogos(team))
        })}
      </div>
    )
  }
}

export default Map


