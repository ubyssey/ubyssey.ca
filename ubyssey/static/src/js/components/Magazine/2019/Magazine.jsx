import React from "react"
import ArticleBox from "./ArticleBox.jsx"
import Header from "./Header.jsx"
import { editorial } from "./contents.js"
import {colors} from "./colors.js"

// should match with css transisitions (ms)
const fadeDelay = 500
// view width (px)
const desktopSize = 960

class Magazine extends React.Component {
  constructor(props) {
    super(props)
    this.subsections = ["editorial"].concat(Object.keys(this.props.articles))
    this.state = {
      subsection: null,
      nextSubsection: null,
      transition: false,
      isDesktop: true,
      show: false,
    }
  }

  componentDidMount() {
    window.addEventListener("resize", () => {
      this.updateSize()
    })
    this.updateSize()
  }

  componentDidUpdate() {
    if (!this.state.show) {
      setTimeout(() => {
        this.setState({
          show: true,
        })
      }, 100)
    }
  }

  componentWillUnmount() {
    window.removeEventListener("resize", () => {
      this.updateSize()
    })
  }

  updateSize() {
    this.setState({
      isDesktop: document.body.clientWidth > desktopSize,
    })
  }

  selectSubsection(subsection) {
    this.setState(
      {
        transition: true, //hide
        nextSubsection: subsection,
      },
      () => {
        if (!this.state.nextSubsection) {
          window.scrollTo(0, 0, "smooth")
        }
        setTimeout(() => {
          this.setState(
            {
              subsection: this.state.nextSubsection,
            },
            () => {
              setTimeout(() => {
                this.setState({
                  transition: false, //show
                })
              }, 10)
            }
          )
        }, fadeDelay)
      }
    )
  }

  renderSubsection() {
    const slideUp = (this.state.transition && !this.state.subsection) || this.state.subsection ? "slide-up" : " "
    const show = this.state.show ? "show" : ""
    if(this.state.subsection === "editorial") this.image = null
    if(this.state.subsection === "resolve") this.image = this.props.resolveImage
    if(this.state.subsection === "redefine") this.image = this.props.redefineImage
    if(this.state.subsection === "reclaim") this.image = this.props.reclaimImage

    return (
      <div className={`article-grid-wrapper ${slideUp}`}>
        <Header
          subsections={this.subsections}
          title={this.props.title}
          nextSubsection={this.state.nextSubsection}
          transition={this.state.transition}
          selected={this.state.subsection}
          isDesktop={this.state.isDesktop}
          selectSubsection={(subsection) => this.selectSubsection(subsection)}
        />

        {this.state.subsection && (
          <div className={`subsection-container ${show}`}>
            <div className="subsection-image" style={{ backgroundImage: `url(${this.image})` }}>
              {this.state.subsection === 'editorial' && this.renderCredits()}
              {this.state.subsection !== 'editorial' && 
                <div className={`subsection-image-text ${this.state.subsection}`}> 
                  {!this.state.isDesktop && <div className="scroll-show"><i className="down"/><i className="down"/></div>}
                  {this.state.subsection}
                  {!this.state.isDesktop && <div className="scroll-show"><i className="down"/><i className="down"/></div>}
                </div>
              }
            </div>

            <div className="article-grid-scroll"> 
            {this.state.subsection === 'editorial' && 
              <div className="editorial-content">
                <div className="title">{editorial.title}</div>
                {editorial.paragraphs.map((paragraph) => {
                  return <p>{paragraph}</p>
                })}
              </div>
            }
            {this.state.subsection !== 'editorial' && 
              <div className="article-grid-container">
                {this.state.subsection !== 'editorial' && this.props.articles[this.state.subsection].map((box, index) => {
                  return (
                    <ArticleBox
                      index={index}
                      subsection={this.state.subsection}
                      transition={this.state.transition}
                      url={box.url}
                      image={box.featured_image}
                      headline={box.headline}
                    />
                  )
                })}
              </div>
              }
              <footer className="c-footer u-container u-container--extra-large">
                <div className="c-footer__left"><a className="o-link" href="">The Ubyssey Magazine</a></div>
                <div className="c-footer__center">&copy; The Ubyssey</div>
                <div className="c-footer__right"><a className="o-link" href="https://www.ubyssey.ca/">Back to ubyssey.ca</a></div>
              </footer>
            </div>
          </div>
        )}
      </div>
    )
  }

  renderCredits() {
    return (
      <div className="c-cover__credits">
        <h1>Editor-in-Chief</h1>
        <h2>Lucy Fox</h2>
        <h1>Written Content Editors</h1>
        <h2>Charlotte Alden</h2>
        <h2>Mitchell Ballachay</h2>
        <h2>Andrew Ha</h2>
        <h2>Emma Livingstone</h2>
        <h2>Riya Talitha</h2>
        <h1>Illustrations Editor</h1>
        <h2>Kristine Ho</h2>
        <h1>Design Editor</h1>
        <h2>Claire Lloyd</h2>
        <h1>Web Design</h1>
        <h2>Rowan Baker-French</h2>
      </div>
    )
  }

  renderCover() {
    const background = { backgroundImage: `url(${this.props.cover})` }
    return (
      <div className="cover-photo-wrapper">
        <div className="cover-photo-container" style={background}>
          <div id="magazine-title">The Ubyssey Magazine</div>
          <h1 className="c-cover__logo">{this.props.title}</h1>
        </div>
      </div>
    )
  }

  render() {
    const show = this.state.show ? "show" : ""
    return (
      <div className={`magazine-container ${show}`}>
        {this.renderCover()}
        {this.renderSubsection()}
      </div>
    )
  }
}

export default Magazine

