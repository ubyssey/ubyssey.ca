import React from 'react';
var Comment = require('./Comment.jsx');
var CommentBox = require('./CommentBox.jsx');

class CommentsBar extends React.Component {
    state = {
        comments: [],
        sort: "recent",
        active: false,
    };

    componentDidMount() {

        this.initialized = false;

        if ($(window).width() <= this.props.breakpoint){
            this.loadComments(this.props.articleId);
        }

        $(document).on('click', '.open-comments', (e) => {
            e.preventDefault();
            if (!this.initialized){
                this.loadComments(this.props.articleId);
            }
            this.toggle(true);
        });

    }

    UNSAFE_componentWillReceiveProps(nextProps) {
        if (nextProps.articleId != this.props.articleId){
            this.initialized = false;
            this.toggle(false);
        }
    }

    loadComments = (article_id) => {
        this.setState({ loading: true });
        dispatch.articleComments(article_id, (data) => {
            this.initialized = true;
            this.setState({
                comments: data.results,
                loading: false
            });
        });
    };

    postComment = (content, callback) => {
        dispatch.postComment(this.props.articleId, content, (data) => {
            this.loadComments();
            callback();
        });
    };

    changeSort = (sort, event) => {
        event.preventDefault();
        this.setState({ sort: sort });
    };

    toggle = (active) => {
        this.setState({ active: active });
    };

    renderSpinner = () => {
        return (
            <div className="spinner">
              <div className="rect1"></div>
              <div className="rect2"></div>
              <div className="rect3"></div>
              <div className="rect4"></div>
              <div className="rect5"></div>
            </div>
            );
    };

    render() {
        var comments = this.state.comments.map((comment, i) => {
            return (<Comment key={comment.id} comment={comment} />);
        });

        return (
            <div id="comments-bar">
                <div className={"inner" + (this.state.active ? " active" : "")}>
                    <div className="close">
                        <div className="u-pull-left">
                            <h3><i className="fa fa-comment"></i> {this.state.comments.length + " comments"}</h3>
                        </div>
                        <div className="u-pull-right">
                            <button onClick={() => this.toggle(false)}><i className="fa fa-close"></i></button>
                        </div>
                    </div>
                    <CommentBox loggedIn={this.props.userId ? true : false} postHandler={this.postComment} />
                    <div className="sort">
                        <a href="#" className={this.state.sort == 'recent' ? 'active' : ''} onClick={() => this.changeSort('recent')}>Recent</a>
                        &middot;
                        <a href="#" className={this.state.sort == 'top' ? 'active' : ''} onClick={() => this.changeSort('top')}>Top</a>
                    </div>
                    <div className="comments-list">
                        {this.state.loading ? this.renderSpinner() : comments}
                    </div>
                </div>
            </div>
            );
    }
}

module.exports = CommentsBar;
