import React from 'react';

const ArticleHeader = React.createClass({
    componentWillMount() {
        this.logo = $('img.logo').attr('src');
        this.home = $('a.home-link').attr('href');
    },
    render() {
        return (
            <header className="topbar header-article">
                <div className="u-container">
                    <div className="section-name">
                        <a href={this.home} className="icon-logo">
                            <img className="logo" src={this.logo} />
                        </a>
                        <span>{this.props.name}</span>
                    </div>
                    |
                    <h1 className="nav-headline" dangerouslySetInnerHTML={{__html: this.props.headline}}></h1>
                    <a className="search" href='/search'><i className="fa fa-search"></i></a>
                </div>
            </header>
        );
    }
});

export default ArticleHeader;
