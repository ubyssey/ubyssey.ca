import React from 'react';
import ReactDOM from 'react-dom';
import { useRef, useContext } from 'react';
import Crossword,  { useIpuz } from '@jaredreisinger/react-crossword';
import { CrosswordProvider, CrosswordGrid,
        DirectionClues, CrosswordContext } from '@jaredreisinger/react-crossword';

function ButtonsBar({ crosswordRef }) {
    const { clues, selectedDirection, selectedNumber, selectedPosition, gridData } = useContext(CrosswordContext);
    const cell = gridData[selectedPosition.row]?.[selectedPosition.col];
    const clue = clues?.[selectedDirection].find((clue)=> clue.number === selectedNumber);

    // FOR NOW CHECK WILL JUST REMOVE A LETTER IF ITS WRONG DOING THE OTHER STUFF REQUIRED RENDERING SOMETHING ON TOP OF THE CROSSWORD GRID
    // The library lacks the functionality to change an individual square so more is required.
    // Also there is currently no timer

    return (
        <>
            <button onClick={() => {
                const row = selectedPosition.row;
                const col = selectedPosition.col;
                const curCell = gridData[row]?.[col];

                if (curCell.answer != curCell.guess) crosswordRef.current?.setGuess(row, col, '');

            }}>Check Cell</button>

            <button onClick={() => {
                const across = selectedDirection === 'across';
                if (!clue) return;
                for (let i = 0; i < clue.answer.length; i++) {

                    const row = selectedPosition.row + (across ? 0 : i);
                    const col = selectedPosition.col + (across ? i : 0);
                    const curCell = gridData[row]?.[col];

                    if (!curCell) break;

                    if (curCell.answer != curCell.guess) crosswordRef.current?.setGuess(row, col, '');
            }}}>Check Word</button>

            <button onClick={() => {
                let i = 0;
                let j = 0;
                gridData.forEach((row) => {
                    
                    row.forEach((cell) => {
                    
                        if (cell.used && cell.guess && cell.answer !== cell.guess) {
                            crosswordRef.current?.setGuess(cell.row, cell.col, '');
                        }
                    });
                });
            }}
            >Check Grid</button>

            <button onClick={() => cell && crosswordRef.current?.setGuess(selectedPosition.row, selectedPosition.col, cell.answer)}>Reveal Cell</button>
            <button onClick={() => {
                const across = selectedDirection === 'across';
                if (!clue) return;
                for (let i = 0; i < clue.answer.length; i++) {

                    const row = selectedPosition.row + (across ? 0 : i);
                    const col = selectedPosition.col + (across ? i : 0);
                    const curCell = gridData[row]?.[col]

                    if (!curCell) break;

                    crosswordRef.current?.setGuess(row, col, curCell.answer);
            }}}
            >Reveal Word</button>
            <button onClick={() => crosswordRef.current?.fillAllAnswers()}>Reveal Grid</button>
        </>
    )
    
}

function CrosswordRenderer() {

    const crosswordRef = useRef(null);

    const dataElement = document.getElementById('crossword-puzzle-data');
    const streamData = dataElement
      ? JSON.parse(dataElement.textContent)
      : [];

    const ipuzFormat = typeof streamData === 'string'
      ? JSON.parse(streamData)
      : streamData;
  
    const crosswordData = useIpuz(ipuzFormat);
  
    return (
      <div style= {{height : '50%', width: '50%'}}>
        <CrosswordProvider 
            ref={crosswordRef}
            data={crosswordData}
            storageKey={document.getElementById('page-title').textContent} 
            theme={{ columnBreakpoint: '0px' }}
            // Do something on correct likely more a design thing like a you win hooray screen
            onCrosswordComplete={(correct) => {
                if (correct) {
                    // stop timer goes here
                    alert('Solved');
                } else {
                    alert('Some answers are incorrect');
                }
            }}

        >
            <ButtonsBar crosswordRef={crosswordRef} />
            <CrosswordGrid />
            <DirectionClues direction="across" />
            <DirectionClues direction="down" />
        </CrosswordProvider>
        
      </div>
    );
  }


const container = document.getElementById('crossword-renderer');

if (container) {
    ReactDOM.render(<CrosswordRenderer/>, container);
}