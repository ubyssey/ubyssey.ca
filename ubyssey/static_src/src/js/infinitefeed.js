
var loader = document.getElementById("loader");
var feed = document.getElementById("feed");

var data = {};

function getData(attribute) {
  if (feed.getAttribute(attribute) != null) {
    data[attribute] = feed.getAttribute(attribute);
  }  
}

getData("section");
getData("tag");
getData("category");
getData("search_query");
getData("label");

function getArticles() {
  loader.setAttribute("inactive", "True");
  loader.classList.remove("hide");
  data["start"] = loader.getAttribute("start");
  data["number"] = loader.getAttribute("number");

  $.ajax({
    type:"GET",
    url: "/infinitefeed",
    data:data,
    success: function(data) 
    {
      recievedata(data);
    }
  })
}

function recievedata(data) {
  var loader = document.getElementById("loader");
  var feed = document.getElementById("feed");
  if(data == "End of feed") {
    loader.setAttribute("inactive", "True");
    loader.setAttribute("end", "True");
    var congratz = document.createElement("p");
    congratz.innerHTML = "You reached the end! 🥳";
    loader.replaceChildren(congratz);
  } else {
    for (let i=0; i<data.length; i++) {
      feed.insertAdjacentHTML("beforeend", data[i]);
    }
    loader.classList.add("hide");
    loader.removeAttribute("inactive");
  }  
}

loader.setAttribute("start", "15");
loader.setAttribute("number", "15");


function loadArticles() 
{ 
  if(loader.hasAttribute("inactive") == false) {
    if(document.documentElement.scrollTop > loader.offsetTop - document.body.offsetHeight){
      getArticles();
      loader.setAttribute("start", String(parseInt(loader.getAttribute("start"))+ parseInt(loader.getAttribute("number"))));
    }
  }
}

window.onscroll = function() {
  loadArticles();
}