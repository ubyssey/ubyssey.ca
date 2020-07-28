import React from "react"
import ReactDOM from "react-dom"
import { Magazine } from "./components/Magazine/2020"

$(function() {
  ReactDOM.render(
    <Magazine
      articles={$("#magazine-wrapper").data("articles")}
      cover={$("#magazine-wrapper").data("cover")}
      section1Image={$("#magazine-wrapper").data("goesaround-image")}
      section2Image={$("#magazine-wrapper").data("comesaround-image")}
      section3Image={$("#magazine-wrapper").data("waysforward-image")}
      title={$("#magazine-wrapper").data("title")}
    />,
    $("#magazine-wrapper")[0]
  )
})
