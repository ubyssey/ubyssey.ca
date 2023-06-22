
var loader = document.getElementById("loader");
var feed = document.getElementById("feed");

var data = {};

function getData(attribute) {
  if (feed.getAttribute(attribute) != null) {
    data[attribute] = feed.getAttribute(attribute);
  }  
}

getData("section");
getData("category");
getData("search_query");
getData("label");

function getArticles() {
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
    console.log("end of feed");
    loader.setAttribute("inactive", "True");
    var congratz = document.createElement("p");
    congratz.innerHTML = "You reached the end! 🥳";
    loader.replaceChildren(congratz);
  } else {
    loader.setAttribute("inactive", "True");
    feed.insertAdjacentHTML("beforeend", data);
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

var sidebar = document.getElementsByClassName("c-sidebar")[0];

function switchSidebar() 
{
  var x = Math.floor((document.documentElement.scrollTop- feed.offsetTop) / (1.5*document.body.offsetHeight))% sidebar.children.length;
  if (x < 0) {
    x = 0;
  }
  if(x != Array.prototype.indexOf.call(sidebar.children,document.getElementsByClassName("c-sidebar_active")[0])){
    if (document.getElementsByClassName("c-sidebar_active").length > 0) {
      document.getElementsByClassName("c-sidebar_active")[0].classList.add("c-sidebar_inactive");
      document.getElementsByClassName("c-sidebar_active")[0].classList.remove("c-sidebar_active");

    }
    sidebar.children[x].classList.remove("c-sidebar_inactive");
    sidebar.children[x].classList.add("c-sidebar_active");
  }
}

if (document.getElementsByClassName("c-sidebar").length > 0) {
  console.log("gamer");
  window.onscroll = function() {
    loadArticles();
    switchSidebar();
  }
} else {
  console.log("not gamer");
  window.onscroll = function() {
    loadArticles();
  }
}