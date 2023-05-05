import React, { Component } from 'react'
import SideBar from './sideBar'
import Editorial from './editorial'
import MemoryLeak from './memoryLeak'
import SegFault from './segFault'
import SystemFailure from './systemFailure'
import Loading from './loading'

export default class Magazine extends Component {
    state = {
        isloading: true,
        menu_clicked: false,
        section: "editorial",
        section_display: "Editorial",
        memoryLeak_right: true,
        segFault_right: true,
        systemFailure_right: true,


        pre_memoryLeak_right: '',
        pre_segFault_right: '',
        pre_systemFailure_right: '',

    }

    componentDidMount() {

        setTimeout(
            function () {
                this.setState({ isloading: false });
            }
                .bind(this),
            1500
        );

    }


    menu_clicked = () => {
        this.setState({ menu_clicked: !this.state.menu_clicked })
    }

    dropdown_clicked = (section_display) => {
        this.setState({ section_display: section_display })
    }


    nav_clicked = (section) => {
        if (section === 'System_failure') {

            if (!this.state.memoryLeak_right && this.state.systemFailure_right) {

                //moving 'System_failure' nav to the left will show System failure section
                this.setState(prevState => ({
                    section_display: 'System_failure',
                    section: section,
                    systemFailure_right: false,
                    segFault_right: false,
                    pre_memoryLeak_right: prevState.memoryLeak_right,
                    pre_segFault_right: prevState.segFault_right,
                    pre_systemFailure_right: prevState.systemFailure_right,

                }))
            } else if (!this.state.segFault_right && this.state.systemFailure_right) {

                //moving 'System_failure' nav to the left will show System failure section
                this.setState(prevState => ({
                    section_display: 'System_failure',
                    section: section,
                    systemFailure_right: false,
                    pre_memoryLeak_right: prevState.memoryLeak_right,
                    pre_segFault_right: prevState.segFault_right,
                    pre_systemFailure_right: prevState.systemFailure_right,
                }))

            } else if (!this.state.systemFailure_right && !this.state.memoryLeak_right && !this.state.segFault_right) {

                //moving 'System_failure' nav to the right will show Seg Fault section
                this.setState(prevState => ({
                    section_display: 'Seg_fault',
                    section: section,
                    systemFailure_right: true,
                    pre_memoryLeak_right: prevState.memoryLeak_right,
                    pre_segFault_right: prevState.segFault_right,
                    pre_systemFailure_right: prevState.systemFailure_right,
                }))
            }
            else {
                //moving all navs to the left
                this.setState(prevState => ({
                    section_display: 'System_failure',
                    section: section,
                    systemFailure_right: false,
                    segFault_right: false,
                    memoryLeak_right: false,
                    pre_memoryLeak_right: prevState.memoryLeak_right,
                    pre_segFault_right: prevState.segFault_right,
                    pre_systemFailure_right: prevState.systemFailure_right,
                }))
            }

        } else if (section === 'Seg_fault') {
            if (this.state.segFault_right & this.state.memoryLeak_right & this.state.systemFailure_right) {

                //Moving 'Seg_fault' from the right to the left will show 'Seg_fault'
                this.setState(prevState => ({
                    section_display: 'Seg_fault',
                    section: section,
                    segFault_right: !this.state.segFault_right,
                    memoryLeak_right: !this.state.memoryLeak_right,
                    pre_memoryLeak_right: prevState.memoryLeak_right,
                    pre_segFault_right: prevState.segFault_right,
                    pre_systemFailure_right: prevState.systemFailure_right,
                }))
            }

            else if (this.state.segFault_right & !this.state.memoryLeak_right) {
                //Moving 'Seg_fault' from the right to the left will show 'Seg_fault'
                this.setState(prevState => ({
                    section_display: 'Seg_fault',
                    section: section,
                    segFault_right: !this.state.segFault_right,
                    pre_memoryLeak_right: prevState.memoryLeak_right,
                    pre_segFault_right: prevState.segFault_right,
                    pre_systemFailure_right: prevState.systemFailure_right,
                }))
            }
            else if (!this.state.segFault_right && this.state.systemFailure_right) {

                //Moving 'Seg_fault' from the left to the right will show 'Memory Leak'
                this.setState(prevState => ({
                    section_display: 'Memory_leak',
                    section: section,
                    segFault_right: !this.state.segFault_right,
                    pre_memoryLeak_right: prevState.memoryLeak_right,
                    pre_segFault_right: prevState.segFault_right,
                    pre_systemFailure_right: prevState.systemFailure_right,
                }))

            } else if (!this.state.segFault_right && !this.state.systemFailure_right) {
                //Moving 'Seg_fault' from the left to the right will show 'Memory Leak'
                this.setState(prevState => ({
                    section_display: 'Memory_leak',
                    section: section,
                    segFault_right: !this.state.segFault_right,
                    systemFailure_right: !this.state.systemFailure_right,
                    pre_memoryLeak_right: prevState.memoryLeak_right,
                    pre_segFault_right: prevState.segFault_right,
                    pre_systemFailure_right: prevState.systemFailure_right,
                }))

            }

        } else if (section === 'Memory_leak') {
            if (this.state.memoryLeak_right) {
                //Moving 'Memory leak' from the right to the left will show 'Memory Leak'
                this.setState(prevState => ({
                    section_display: 'Memory_leak',
                    section: section,
                    memoryLeak_right: false,
                    pre_memoryLeak_right: prevState.memoryLeak_right,
                    pre_segFault_right: prevState.segFault_right,
                    pre_systemFailure_right: prevState.systemFailure_right,
                }))

            } else if (this.state.segFault_right && this.state.systemFailure_right) {
                //Moving 'Memory leak' from the left to the right will show 'Editorial'
                this.setState(prevState => ({
                    section_display: 'Editorial',
                    section: section,
                    memoryLeak_right: true,
                    pre_memoryLeak_right: prevState.memoryLeak_right,
                    pre_segFault_right: prevState.segFault_right,
                    pre_systemFailure_right: prevState.systemFailure_right,
                }))

            } else if (this.state.systemFailure_right) {
                //Moving 'Memory leak' from the left to the right will show 'Editorial'
                this.setState(prevState => ({
                    section_display: 'Editorial',
                    section: section,
                    memoryLeak_right: true,
                    segFault_right: true,
                    pre_memoryLeak_right: prevState.memoryLeak_right,
                    pre_segFault_right: prevState.segFault_right,
                    pre_systemFailure_right: prevState.systemFailure_right,
                }))

            }
            else {
                //Moving all nav from the left to the right will show 'Editorial'
                this.setState(prevState => ({
                    section_display: 'Editorial',
                    section: section,
                    systemFailure_right: !this.state.systemFailure_right,
                    segFault_right: !this.state.segFault_right,
                    memoryLeak_right: !this.state.memoryLeak_right,
                    pre_memoryLeak_right: prevState.memoryLeak_right,
                    pre_segFault_right: prevState.segFault_right,
                    pre_systemFailure_right: prevState.systemFailure_right,
                }))

            }

        }

    }

    nav_position = (animation1, animation2, animation3, nav1, nav2, nav3) => {
        return (
            <ul className="nav">

                <li className={`${nav1} ${animation1}`} onClick={() => this.nav_clicked('Memory_leak')} style={{ color: 'white' }}> <h3>MEMORY LEAK</h3></li>

                <li className={`${nav2} ${animation2}`} onClick={() => this.nav_clicked('Seg_fault')} style={{ color: 'white' }}> <h3>SEG FAULT </h3> </li>

                <li className={`${nav3} ${animation3}`} onClick={() => this.nav_clicked('System_failure')} style={{ color: 'white' }}> <h3>SYSTEM FAILURE</h3></li>

            </ul>
        )

    }


    nav_render = () => {

        if (this.state.section === 'editorial') {
            return (
                this.nav_position(" ", " ", " ", "nav1_right", "nav2_right", "nav3_right")
            )
        }

        if (this.state.section === 'editorial2') {
            return (
                this.nav_position("animation_right1 ", "animation_right2", "animation_right3", "nav1_left", "nav2_left", "nav3_left")
            )
        }


        if (this.state.section === 'System_failure') {

            if (!this.state.systemFailure_right) {

                if (this.state.pre_memoryLeak_right && this.state.pre_segFault_right && this.state.pre_systemFailure_right) {
                    return (
                        this.nav_position("animation_left1", "animation_left2", "animation_left3", "nav1_right", "nav2_right", "nav3_right")
                    )
                } else if (this.state.pre_segFault_right && this.state.pre_systemFailure_right) {
                    return (
                        this.nav_position(" ", "animation_left2", "animation_left3", "nav1_left", "nav2_right", "nav3_right")
                    )
                } else if (this.state.pre_systemFailure_right) {
                    return (
                        this.nav_position(" ", " ", "animation_left3", "nav1_left", "nav2_left", "nav3_right")
                    )

                }
            }
            if (this.state.systemFailure_right) {
                return (
                    this.nav_position("", "", "animation_right3", "nav1_left", "nav2_left", "nav3_left")
                )
            }

        }




        else if (this.state.section === 'Seg_fault') {

            if (!this.state.segFault_right) {
                if (this.state.pre_memoryLeak_right && this.state.pre_systemFailure_right && this.state.pre_segFault_right) {

                    return (this.nav_position("animation_left1", "animation_left2", " ", "nav1_right", "nav2_right", "nav3_right"))
                }
                else {
                    return (
                        this.nav_position(" ", "animation_left2", "", "nav1_left", "nav2_right", "nav3_right")
                    )
                }
            }

            if (this.state.segFault_right) {
                if (!this.state.pre_memoryLeak_right && !this.state.pre_systemFailure_right && !this.state.pre_systemFailure_right) {
                    return (this.nav_position(" ", "animation_right2", "animation_right3", "nav1_left", "nav2_left", "nav3_right"))
                } else {
                    return (
                        this.nav_position(" ", "animation_right2", "", "nav1_left", "nav2_left", "nav3_right")
                    )
                }

            }
        }


        else if (this.state.section === 'Memory_leak') {

            if (!this.state.memoryLeak_right) {
                return (
                    this.nav_position("animation_left1", "", "", "nav1_right", "nav2_right", "nav3_right")
                )
            }


            else if (this.state.memoryLeak_right) {

                if (!this.state.pre_memoryLeak_right && !this.state.pre_segFault_right && !this.state.pre_systemFailure_right) {

                    return (this.nav_position("animation_right1 ", "animation_right2", "animation_right3", "nav1_left", "nav2_left", "nav3_left"))

                } else if (!this.state.pre_memoryLeak_right && !this.state.pre_segFault_right) {

                    return (this.nav_position("animation_right1", "animation_right2", " ", "nav1_left", "nav2_left", "nav3_right"))

                } else if (!this.state.pre_memoryLeak_right) {

                    return (this.nav_position("animation_right1", " ", "", "nav1_left", "nav2_right", "nav3_right"))
                }

            }
        }


    }


    render() {

        const nav = this.nav_render()

        return (
            this.state.isloading ? <Loading /> :

                <div>
                    <h1 className="mag_title" style={{ color: 'white', fontSize: '70px' }}>SYSTEM REBOOT REQUIRED. </h1>

                    <div className="horizontal_line"></div>

                    <button className="menu_button" onClick={() => this.menu_clicked()}>Menu</button>

                    <SideBar click={this.state.menu_clicked} menu_clicked={this.menu_clicked} dropdown_clicked={this.dropdown_clicked} />

                    {nav}

                    {this.state.section_display === "Editorial" && <Editorial />}
                    {this.state.section_display === "Memory_leak" && <MemoryLeak title={"Memory Leak"} articles={this.props.articles['Memory-Leak']} />}
                    {this.state.section_display === "Seg_fault" && <SegFault title={"Seg Fault"} articles={this.props.articles['Seg-Fault']} />}
                    {this.state.section_display === "System_failure" && <SystemFailure title={"System Failure"} articles={this.props.articles['System-Failure']} />}


                    <footer className="footer">
                        <a style={{ color: 'white' }} href='https://www.ubyssey.ca/'> BACK TO UBYSSEY.CA</a>
                    </footer>



                </div>
        )
    }







}