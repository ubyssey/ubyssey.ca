
var feed = document.getElementById("feed");

var data = {};

function getData(attribute) {
  if (feed.getAttribute(attribute) != null) {
    data[attribute] = feed.getAttribute(attribute);
  }  
}

getData("search_query");

function getArticles() {
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
  var feed = document.getElementById("feed");
  console.log("epic");
    for (let i=0; i<3 && i<data.length; i++) {
      feed.insertAdjacentHTML("beforeend", data[i]);
      console.log("placed");
    }
}