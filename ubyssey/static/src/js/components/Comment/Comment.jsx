import React from 'react';

function Comment(props) {
    return (
        <div className="comment">
            <div className="meta">
                <span className="user">{props.comment.user}</span>
                <span className="timestamp">{props.comment.timestamp}</span>
                &middot;
                <span className="votes">{props.comment.votes} points</span>
            </div>
            <p className="login-message">{props.comment.content}</p>
        </div>
    );
}

export default Comment;
