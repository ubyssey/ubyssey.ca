import React from 'react'

function Ribbon(props) {
  const secondaryColor = props.primaryColor + 'ce'
  const ribbonPrimary = {backgroundColor: props.primaryColor}
  const ribbonAfter = {borderColor: secondaryColor, borderRightColor: 'transparent'}
  const ribbonBefore = {borderColor: secondaryColor, borderLeftColor: 'transparent'}
  
  return (
    <div className="non-semantic-protector" style={props.style}> 
      <span className="ribbon-before" style={ribbonBefore}></span>
      <span className="ribbon" style={ribbonPrimary}>
        <strong className="ribbon-content" dangerouslySetInnerHTML={{__html: props.html}}></strong>
      </span>
      <span className="ribbon-after" style={ribbonAfter}></span>
    </div>
  );
}

export default Ribbon;