import React from 'react'
import ReactDOM from 'react-dom'

$(function () {

    $('.c-podcast-episode').each(function () {
        ReactDOM.render(
            <Episode author={$(this).data('author')}
                description={$(this).data('description')}
                file={$(this).data('file')}
                image={$(this).data('image')}
                publishedAt={$(this).data('published_at')}
                id={$(this).data('id')}
                title={$(this).data('title')}
            />,
            $(this).get(0)
        )
    })


})