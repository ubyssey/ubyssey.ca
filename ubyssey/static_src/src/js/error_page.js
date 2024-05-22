var data = {};

data["start"] = 0;
data["number"] = 3;
data["search_query"] = window.location.href.split("/")[-1];

$.ajax({
  type:"GET",
  url: "/infinitefeed",
  data:data,
  success: function(data) 
  {
    recievedata(data);
  }
})

function recievedata(data) {
  var feed = document.getElementById("feed");
    for (let i=0; i<data.length; i++) {
      feed.insertAdjacentHTML("beforeend", data[i]);
      console.log("placed");
    }
}