import React from 'react';
import ReactDOM from 'react-dom';
import Crossword, { useIpuz } from '@jaredreisinger/react-crossword';


function CrosswordRenderer() {
    const dataElement = document.getElementById('crossword-puzzle-data');
    const streamData = dataElement
      ? JSON.parse(dataElement.textContent)
      : [];

    console.log(dataElement)
    console.log(streamData);

    const ipuzFormat = typeof streamData === 'string'
      ? JSON.parse(streamData)
      : streamData;
  
    const crosswordData = useIpuz(ipuzFormat);
  
    return (
      <div style= {{height : '50%', width: '50%'}}>
        <Crossword data={crosswordData} theme={{ columnBreakpoint: '0px' }}/>
      </div>
    );
  }


const container = document.getElementById('crossword-renderer');

if (container) {
    ReactDOM.render(<CrosswordRenderer/>, container);
}