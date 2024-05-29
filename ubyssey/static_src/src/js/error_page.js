var data = {};

data["start"] = 0;
data["number"] = 3;
let path = window.location.pathname;
let pathParts = path.split('/');
data["search_query"] = pathParts[pathParts.length - 3];
console.log(pathParts[pathParts.length - 3]);
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