import React from "react"
import ReactDOM from "react-dom"
import { Magazine } from "./components/Magazine/2019"

$(function() {
  ReactDOM.render(
    <Magazine
      articles={$("#magazine-wrapper").data("articles")}
      cover={$("#magazine-wrapper").data("cover")}
      section1Image={$("#magazine-wrapper").data("reclaim-image")}
      section2Image={$("#magazine-wrapper").data("redefine-image")}
      section3Image={$("#magazine-wrapper").data("resolve-image")}
      title={$("#magazine-wrapper").data("title")}
    />,
    $("#magazine-wrapper")[0]
  )
})
