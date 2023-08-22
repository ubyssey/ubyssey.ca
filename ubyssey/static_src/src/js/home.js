function initializeSeemore() {
    $('#seemore').click(function (e) {
        e.preventDefault();
        openFeed();
    });
}

initializeSeemore();

function openFeed() {
    document.getElementById("feed-section").classList.remove("home_infinitefeed_cutoff");
    document.getElementById("feed-shadow").remove();

    document.getElementById("loader").removeAttribute("inactive");
}
function closeFeed() {
    var shadow = document.createElement("div");
    shadow.id = "feed-shadow";
    shadow.classList.add("home_infinitefeed_cutoff_shadow");

    var seemore = document.createElement("a");
    seemore.id = "seemore";
    seemore.href = "#";
    seemore.classList.add("home_infinitefeed_cutoff_seemore");
    seemore.innerHTML = "See more";

    shadow.appendChild(seemore);
    document.getElementById("feed-section").appendChild(shadow);

    initializeSeemore();

    document.getElementById("feed-section").classList.add("home_infinitefeed_cutoff");
    document.getElementById("loader").setAttribute("inactive", "True");
}

updateTimeBox = setInterval(
    function() {
        var feed = document.getElementById("feed");
        if(document.documentElement.scrollTop > document.getElementById("feed-section").offsetTop) {
            var scroll = document.documentElement.scrollTop - document.getElementById("feed-section").offsetTop;
            for(let i=0; i<feed.children.length; i++){
                var article = feed.children[i];
                if(article.classList.contains("article--infinitefeed")){
                    if(article.offsetTop > scroll &&  article.offsetTop < scroll + 500) {
                        document.getElementById("timeBox").innerHTML = "<strong>" + article.getAttribute("time") + "</strong>";
                        break;
                    }
                }
            }
        } else {
            if (document.getElementById("timeBox").innerHTML != "<strong>Today</strong>") {
                document.getElementById("timeBox").innerHTML = "<strong>Today</strong>";
            } 
            if(document.documentElement.scrollTop < 100) {
                if (loader.hasAttribute("end") == false) {
                    if (document.getElementById("feed-section").classList.contains("home_infinitefeed_cutoff") == false) {
                        closeFeed();
                    }                    
                }
            }
        }
    }, 100);