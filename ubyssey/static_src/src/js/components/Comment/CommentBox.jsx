import React from 'react';
var Textarea = require('react-textarea-autosize');

class CommentBox extends React.Component {
    state = {
        content: "",
    };

    updateContent = (event) => {
        this.setState({ content: event.target.value });
    };

    handlePost = () => {
        this.props.postHandler(this.state.content, () => {
            this.setState({ content: "" });
        });
    };

    renderLogin = () => {
        return (
            <div className="comments-field login">
                <p>You must login or register before posting a comment.</p>
                <a href="/login/" className="button">Login</a>
                <a href="/register/" className="button">Register</a>
            </div>
            );
    };

    renderInput = () => {
        return (
            <div className="comments-field">
                <Textarea rows={2} placeholder="Join the conversation..." onChange={this.updateContent} value={this.state.content} />
                <button className="right" onClick={this.handlePost}>Post Comment</button>
            </div>
            );
    };

    render() {
        return this.props.loggedIn ? this.renderInput() : this.renderLogin();
    }
}

export default CommentBox;
