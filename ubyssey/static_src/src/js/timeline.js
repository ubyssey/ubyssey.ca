import React from 'react'
import ReactDOM from 'react-dom'

$(function () {

    $('.c-timeline').each(function () {
        ReactDOM.render(
            <Timeline id={$(this).data('currentArticleId')}
                title={$(this).data('timelineTitle')}
                nodes={$(this).data('nodes')} />,
            $(this).get(0)
        )
    })




})