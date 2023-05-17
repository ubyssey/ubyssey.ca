import React from 'react'
import ReactDOM from 'react-dom'
import { Nationals } from './components/Nationals'


$(function () {

    $('.c-soccer-nationals').each(function () {
        ReactDOM.render(
            <Nationals id={$(this).data('currentArticleId')}
                map={$(this).data('map')}
                teamData={$(this).data('teamData')} />,
            $(this).get(0)
        )
    })


})