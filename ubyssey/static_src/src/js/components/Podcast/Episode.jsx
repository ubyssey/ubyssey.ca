import React from 'react'

class Episode extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      open: window.location ? window.location.hash.includes(props.id) : false,
      cacheData: window.location ? window.location.hash.includes(props.id) : false,
      maxHeight: 10000
    }
  }

  handleClick() {
    this.setState(prevstate => ({
      open: !prevstate.open,
      cacheData: true,
      maxHeight: document.getElementById(this.props.id).clientHeight
    }))
  }

  render() {
    const {description, file, image, publishedAt, id, title} = this.props
    const openStyle = this.state.open ? {maxHeight: this.state.maxHeight} : {maxHeight: '150px'}
    return (
      <div className="c-episode-container" style={openStyle}>
        <a name={id} ></a> 
        <div id={this.props.id}>
          <div className='c-episode-flex-wrapper-top'>
              <h3 onClick={() => this.handleClick()}>{title}</h3>
              <h4>{publishedAt}</h4>
          </div>
          <div className={this.state.open ? 'c-episode-flex-wrapper-mid-col' : 'c-episode-flex-wrapper-mid-row'}>
              <p className='description'>
                  {description}
              </p>
          </div>
          <div className='c-episode-content'>
            <div className='c-episode-flex-wrapper-bottom'>
              <div className='image' style={this.state.cacheData ? {backgroundImage: "url(" + image + ")"} : {}} ></div>
              {this.state.cacheData && 
                <audio controls >
                  <source src={file} />
                </audio>
              }{ !this.state.cacheData &&
                <audio controls >
                  <source src='' />
                </audio>
              }
            </div>
          </div>
        </div>
        <div className='c-episode-obscure' onClick={() => this.handleClick()}>
            <span>Show {this.state.open ? 'Less' : 'More'}</span>
        </div>
      </div>
    )
  }
}

export default Episode
