import React from 'react'
import Ribbon from './Ribbon.jsx'

function TeamContent(props) {
  const ribbonHtml = `        
  <span className='c-n-team-stat'>Win ${props.team.stats[0]} | </span>
  <span className='c-n-team-stat'>Loss ${props.team.stats[1]} | </span>
  <span className='c-n-team-stat'>Tie ${props.team.stats[2]}</span>  
  `
  const ribbonStyle = props.isDesktop ? {width: '50%', minWidth: '20rem', top: 0}: {width: '100%', top: 0}
  const primaryColor = props.isDesktop ? props.team.colors[0] : '#ffffff'
  return (
    <div className='c-n-content-box-container' style={props.isSelected ? {left: '0px'}: {}}>
      <div className='c-n-content-box' style={{backgroundColor: primaryColor + '30', borderColor: primaryColor}}>
        <h1>{props.team.name}</h1>
        <Ribbon html={ribbonHtml} 
            style={ribbonStyle}
            isDesktop={props.isDesktop} 
            primaryColor={props.team.colors[0]}/>
  
        {props.team.content.map((paragraph) => {
          return(<p>{paragraph}</p>)
        })}
      </div>
    </div>
  );
}

export default TeamContent