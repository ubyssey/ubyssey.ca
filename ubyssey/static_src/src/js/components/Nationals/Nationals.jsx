import React from 'react'
import Map from './Map.jsx'
import Desktop from './Desktop.jsx'
import Mobile from './Mobile.jsx'
import { desktopSize } from '../../utils'
import { mapPath } from './mapPath.js'

class Nationals extends React.Component {
  constructor(props){
    super(props)
    this.mapViewBox = [0, 0, 820, 376]
    this.state = {
      selectedTeam: null
    }
  }

  selectTeam(team) {
    if (this.state.selectedTeam && this.state.selectedTeam.name === team.name) {
      team = null
    }
    this.setState({
      selectedTeam: team
    })
  }
  
  resetTeam() {
    this.setState({
      selectedTeam: null
    })
  }

  render() {
    const isDesktop = window.innerWidth > desktopSize ? true: false
    return (
      <div className={'c-n-container'}>
        { isDesktop && 
          <div className='c-n-desktop'>
            <Map teamData={this.props.teamData} 
              resetMap={() => {this.resetTeam()}}
              selectedTeam={this.state.selectedTeam}
              mapViewBox={this.mapViewBox}
              mapPath={mapPath}
              selectTeam={(team) => this.selectTeam(team)}/> 
            <Desktop teamData={this.props.teamData} 
              isDesktop={isDesktop}
              selectedTeam={this.state.selectedTeam}/>
          </div>
        }{ !isDesktop && 
          <div>
            <div id='c-nationals-map' >
              <svg xmlns="http://www.w3.org/2000/svg" 
                className='c-n-map'
                viewBox={this.mapViewBox.join(' ')}
                dangerouslySetInnerHTML={{__html: mapPath}} />
            </div>
            <Mobile selectedTeam={this.state.selectedTeam}
              teamData={this.props.teamData}
              isDesktop={isDesktop}
              selectTeam={(team) => this.selectTeam(team)}/> 
          </div>
        }
      </div>
    )
  }
}


export default Nationals


