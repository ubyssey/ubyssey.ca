
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
  clearInterval(loadFeed);
  
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
    loader.remove();
    clearInterval(loadFeed);
  } else {
    feed.insertAdjacentHTML("beforeend", data);

    loadFeed = setInterval(function () 
    {
      if(document.documentElement.scrollTop > loader.offsetTop - document.body.offsetHeight){
        getArticles();
        loader.setAttribute("start", String(parseInt(loader.getAttribute("start"))+ parseInt(loader.getAttribute("number"))));
      }
    }, 100);
  }  
}

loader.setAttribute("start", "15");
loader.setAttribute("number", "15");
loadFeed = setInterval(function () 
{
    getArticles();
    loader.setAttribute("start", String(parseInt(loader.getAttribute("start"))+ parseInt(loader.getAttribute("number"))));
}, 100);