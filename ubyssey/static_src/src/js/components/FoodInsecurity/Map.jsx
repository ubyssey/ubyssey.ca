import React from 'react'
import {defs, base, roads, locations} from './mapPath.js'

class Map extends React.Component {
  constructor(props) {
    super(props)
    this.MAP_WIDTH = this.props.isDesktop ? 500 : 320
    this.MAP_HEIGHT = this.props.isDesktop ? 640 : (640/500)*this.MAP_WIDTH
    this.viewBox = [0, 0, this.MAP_WIDTH/2, this.MAP_HEIGHT/2]
    this.myLatestTap = new Date().getTime();
    this.state = {
      viewBox: this.viewBox,
      zoom: false,
      scale: 4
    }
  }

  setScale(value) {
    this.setState({
      scale: value
    })
  }

  detectDoubleTap(e) {
    if(!this.props.isDesktop) {
      var now = new Date().getTime();
      var timesince = now - this.myLatestTap;
      if((timesince < 500) && (timesince > 0)){
        this.zoomMap(e)
      }
    
      this.myLatestTap = new Date().getTime();
    }
  }

  zoomMap(e) {
    e.preventDefault()
    const map = document.getElementById('interactive-map')
    let mX = e.clientX - map.getBoundingClientRect().left
    let mY = e.clientY - map.getBoundingClientRect().top

    // get difference between click point and center of map
    mX = mX - this.MAP_WIDTH/2
    mY = mY - this.MAP_HEIGHT/2

    //normalize click point to be centered in zoomed SVG
    mX = (mX + (this.state.scale - 1)*this.viewBox[2]/this.state.scale)/2 
    mY = (mY + (this.state.scale - 1)*this.viewBox[3]/this.state.scale)/2

    const newViewBox = [mX, mY, this.viewBox[2]/this.state.scale, this.viewBox[3]/this.state.scale]

    if (!this.state.zoom) {
      this.setState({
        viewBox: newViewBox,
        zoom: true
      })
    } else {
      this.setState({
        viewBox: [0, 0, this.viewBox[2], this.viewBox[3]],
        zoom: false
      })
    }
  }

  selectPoint(e, point) {
    e.persist()
    if(!this.state.zoom) {
      this.zoomMap(e)
    }
    this.props.selectPoint(point)
  }

  reset() {
    this.setState({
      viewBox: [0, 0, this.viewBox[2], this.viewBox[3]],
      zoom: false
    })
    this.props.resetPoint()
  }

  renderMap() {
    return(
      <svg xmlns="http://www.w3.org/2000/svg" 
        className='c-i-map'
        width={this.MAP_WIDTH}
        height={this.MAP_HEIGHT}
        id='interactive-map'
        viewBox={this.state.viewBox.join(' ')}
        onClick={(e)=> this.detectDoubleTap(e)}
        onDoubleClick={(e) => this.zoomMap(e)}>
        <defs dangerouslySetInnerHTML={{__html: defs}}></defs>
        <title>UBC Map</title>
        <g id="Ocean">
          <rect className="cls-1" width={this.state.viewBox[2]} height={this.state.viewBox[3]}/>
        </g>
        <g id="Base" dangerouslySetInnerHTML={{__html: base}}></g>
        <g id="Roads" dangerouslySetInnerHTML={{__html: roads}}></g>
        <g id="Locations">
          {Object.keys(locations).map((location) => {
            let point = []
            this.props.pointData.map((data) => {
              if(data.location.split(' ').join('').toLowerCase() === location) {
                point = point.concat(data)
              }
            })
            return(
              <svg xmlns="http://www.w3.org/2000/svg" 
                style={{overflow: 'auto'}}>
                <title style={{textTransform: 'capitalize'}}>{point.name}</title>
                <polygon className='cls-5' 
                  id={name}
                  points={locations[location]} 
                  onClick={(e) => {this.selectPoint(e, point)}}/>
              </svg>
            )
          })}
        </g>
      </svg>
    )
  }

  renderMobile(currentPoint) {
    const contentStyle = currentPoint ? {transform: 'translateY(-350px)', opacity: 1}:{transform: 'translateY(0)'}
    return (
      <div className='c-i-map' height={this.MAP_HEIGHT}>
        <div className='c-i-map__image-container' style={{backgroundColor: '#292b71'}}>
          {this.renderMap()}
          <div className='c-i-map__content-container' style={contentStyle}>
            <span> <i className='fa fa-arrow-down' onClick={() => this.reset()}> Back </i> </span>

            {currentPoint && currentPoint.map((point) => {
              return(
                <div className='c-i-map__content'>
                  <div className='c-i-map__content-header'>
                    <span className='c-i-map__content-title'>{point.name}</span> 
                    
                  </div>
                  <div className='c-i-map__content-subtitle'>{point.location}</div>
                  {point.content.map((paragraph) => {
                    return <p>{paragraph}</p>
                  })} 
                </div>
              )
            })} 
          </div>
        </div>
      </div>
    )
  }

  renderDesktop(currentPoint) {
    const contentStyle = currentPoint ? {transform: 'translate(0)', width: '350px', opacity: 1}:{transform: 'translate(-350px)', width: 0}
    return (
      <div className='c-i-map' height={this.MAP_HEIGHT}>
        <div className='c-i-map__image-container' style={{backgroundColor: '#292b71'}}>
          {this.renderMap()}
          <div className='c-i-map__instructions'>Double Click to Zoom | Click to Select</div>
        </div>
        <div className='c-i-map__content-container' style={contentStyle}>
          {currentPoint && currentPoint.map((point) => {
            return(
              <div className='c-i-map__content'>
                <span className='c-i-map__content-title'>{point.name}</span> 
                <div className='c-i-map__content-subtitle'>{point.location}</div>
                {point.content.map((paragraph) => {
                  return <p>{paragraph}</p>
                })} 
                
              </div>
            )
          })}
          <i className='fa fa-arrow-left' onClick={() => this.reset()}> Back </i>
        </div>
      </div>
    )
  }

  render() {
    const currentPoint = this.props.currentPoint
    return (
      <div>
        {this.props.isDesktop && this.renderDesktop(currentPoint)}
        {!this.props.isDesktop && this.renderMobile(currentPoint)}
        {!this.props.isDesktop && <div className='c-i-map__instructions'>Double Tap to Zoom | Tap to Select </div> }
      </div>
      

    )
  }
}

export default Map


