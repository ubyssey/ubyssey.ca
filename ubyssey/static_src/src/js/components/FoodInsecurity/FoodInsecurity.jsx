import React from 'react'
import Map from './Map.jsx'
import { desktopSize } from '../../utils'

class FoodInsecurity extends React.Component {
  constructor(props){
    super(props)

    this.state = {
      currentPoint: null
    }
  }

  resetPoint() {
    this.setState({
      currentPoint: null
    })
  }

  selectPoint(point) {
    if(point.length === 0)
      point = null
    const element = document.getElementsByClassName('food-insecurity')
    const topOffset = element[0].getBoundingClientRect().top + document.documentElement.scrollTop
    window.scroll({
      top: topOffset - 48,
      left: 0,
      behavior: 'smooth'
    });
    this.setState({
      currentPoint: point
    })
  }


  render() {
    const isDesktop = window.innerWidth > desktopSize ? true: false
    return (
      <div className={'c-i-container'}>
        <span className='c-i-title'>Affordable Food Map</span>
        <div className='c-i-desktop'>
          <Map 
            isDesktop = {isDesktop}
            pointData={this.props.pointData} 
            mapImage={this.props.map}
            currentPoint={this.state.currentPoint}
            resetPoint={() => this.resetPoint()}
            selectPoint={(point) => this.selectPoint(point)}/> 
        </div>
      </div>
    )
  }
}


export default FoodInsecurity


