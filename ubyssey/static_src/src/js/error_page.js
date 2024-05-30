var data = {};

data["start"] = 0;
data["number"] = 3;

data["search_query"] = window.location.pathname;

console.log(data);

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
  let element = document.querySelector(".load-articles");
  if(data == "End of feed"){
    element.textContent = "";
  }
  else{
    console.log(element);
    element.textContent = "Is this what you were looking for?";
    for (let i=0; i<data.length; i++) {
      feed.insertAdjacentHTML("beforeend", data[i]);
      console.log("placed");
    }
  }
}