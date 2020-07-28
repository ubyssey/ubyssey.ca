import React from 'react';

function GallerySlide(props) {
  const slideStyle = { width: props.width };
  const imageStyle = { backgroundImage: `url('${props.src}')` };

  return (
    <li className="slide" style={slideStyle}>
      <div className="inner">
        <div className="image">
          <div>
            <div className="img" style={imageStyle}></div>
          </div>
        </div>
        <div className='slide-meta'>
          { props.caption &&
            <p className="slide-caption" dangerouslySetInnerHTML={{__html: props.caption}}></p> }
          { props.credit &&
            <p className="slide-credit" dangerouslySetInnerHTML={{__html: props.credit}}></p> }
        </div>
      </div>
    </li>
  );
}

export default GallerySlide;
