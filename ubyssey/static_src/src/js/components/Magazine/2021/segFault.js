import React, { Component } from 'react'

export default class segFault extends Component {
    render() {
        return (
            <div>

                <div className="wrapper">

                    <div className="grid_container fade-in">


                        <div className="header_photo nested">
                            <div>
                                <img className="photo_vertical" src={'https://storage.googleapis.com/ubyssey/images/mag2021smallgifs/untitled_artwork.gif'} />
                            </div>
                            <div className="overlay">
                                <span> <h1>SEG FAULT </h1> </span>

                            </div>
                        </div>

                        {this.props.articles.map((article, index) => {

                            return (

                                <div className={`article_${index} nested one`}>

                                    <div>
                                        <img className="photo_vertical" src={article.featured_image} />

                                    </div>
                                    <div className="headline"> <div style={{ color: 'white' }} > {article.headline} </div> </div>
                                    <div className="card__overlay"> <a href={article.url}> <span> Read More </span></a> </div>
                                </div>
                            )



                        })}

                    </div>



                </div>

            </div>
        )
    }
}
