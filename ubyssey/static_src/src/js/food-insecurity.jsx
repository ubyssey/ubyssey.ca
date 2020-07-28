import React from 'react'
import ReactDOM from 'react-dom'
import { FoodInsecurity } from './components/FoodInsecurity'

$(function () {
  $('.food-insecurity').each(function() {
      ReactDOM.render(
          <FoodInsecurity  id={$(this).data('currentArticleId')}
                      map={$(this).data('map')} 
                      pointData={$(this).data('pointData')} />,
          $(this).get(0)
      )
  })
});

