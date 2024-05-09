import React, { Component } from 'react'

export default class sideBar extends Component {

    state = {
        dropdown_clicked: false,
    }


    handleClick = () => {
        this.setState({ dropdown_clicked: !this.state.dropdown_clicked })
    }

    render() {
        return (
            <div>
                <ul className={this.props.click ? 'nav-menu active' : 'nav-menu'} onClick={() => this.props.menu_clicked()}>
                    <li className='nav-item' style={{ color: 'white' }} onClick={() => this.props.dropdown_clicked('Editorial')}> <h4>EDITORIAL</h4></li>
                    <li className='nav-item' style={{ color: 'white' }} onClick={() => this.props.dropdown_clicked('Memory_leak')}> <h4>MEMORY LEAK</h4></li>
                    <li className='nav-item' style={{ color: 'white' }} onClick={() => this.props.dropdown_clicked('Seg_fault')}> <h4>SEG FAULT </h4> </li>
                    <li className='nav-item' style={{ color: 'white' }} onClick={() => this.props.dropdown_clicked('System_failure')}> <h4>SYSTEM FAILURE</h4></li>
                </ul>

            </div>
        )
    }
}
