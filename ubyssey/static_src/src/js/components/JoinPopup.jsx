import { useState, useEffect } from "react";

export default function JoinPopup() {
    let [popupState, setPopupState] = useState("hidden");

    function interact() {
        const stateTransitions = {
            "minimal": "active",
            "active": "hidden",
        }
        setPopupState(stateTransitions[popupState]);
    }

    useEffect(() => {
        setTimeout(() => setPopupState("minimal"), 1500);
    }, []);

    return (
        <div className={"c-join-popup " + popupState}>
            <div className="c-join-popup--lip">
                <div className="c-join-popup--lip-container">
                    <p><i>The Ubyssey</i> has been UBC’s student newspaper since 1918. Our mission is to report on UBC and its community. Want to join the likes of</p>
                    <button onClick={interact} className="c-join-popup--button"><ion-icon name="chevron-up"></ion-icon></button>
                </div>
            </div>
            <div className="c-join-popup--inner">
                <div class="c-join-popup--inner-text">
                    <h1><a href="https://join.ubyssey.ca/">JOIN THE UBYSSEY</a></h1>
                    <p class="c-join-popup--open-positions">Open positions: Opinion columnist, Humour writer, Video editor</p>
                </div>
            </div>
        </div>
    )
}