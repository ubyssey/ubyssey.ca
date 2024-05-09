import React from 'react'
import Ribbon from './Ribbon.jsx'

function Mvp(props) {
  const {player, primaryColor, isSelected} = props
  const playerImage = {backgroundImage: 'url("' + player.image.medium + '")', border: '.25rem solid ' + primaryColor}
  const mvpStyle={backgroundColor: primaryColor + '30', border: '.25rem solid' + primaryColor}
  return (
    <div className='c-n-content-box-container' style={isSelected ? {right: 0}: {}}>
      <div className='c-n-content-box c-n-mvp' style={mvpStyle}>
        <h1>Player To Watch</h1>
        <div className='c-n-headshot'>
          <div className='c-n-headshot--image-container'>
            <div className='c-n-headshot--image'
              style={playerImage}>
            </div>
          </div>
          <Ribbon html={player.name} 
            isDesktop={props.isDesktop} 
            primaryColor={primaryColor}/>
        </div>

        {player.content.map((paragraph) => {
          return(<p>{paragraph}</p>)
        })}
      </div>
    </div>
  );
}

export default Mvp;