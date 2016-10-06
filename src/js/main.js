require("./lib/social");
// require("./lib/ads");
// var track = require("./lib/tracking");

var $ = require("./lib/qsa");
var debounce = require("./lib/debounce");

var photos = $(".photo-embed");
var years = $(".year-label");

photos.forEach(p => p.classList.add("hidden"));
var reflow = document.body.offsetHeight;
photos.forEach(p => p.classList.add("animate"));

window.addEventListener("scroll", debounce(function() {
  photos = photos.filter(function(p) {
    var bounds = p.getBoundingClientRect();
    if (bounds.top < window.innerHeight * .8) {
      p.classList.remove("hidden");
      return false;
    }
    return true;
  });
  var current = document.querySelector(".year-label.activated");
  if (current) current.classList.remove("activated");
  for (var i = years.length - 1; i >= 0; i--) {
    var label = years[i];
    var bounds = label.getBoundingClientRect();
    if (bounds.top > 0 && bounds.top < window.innerHeight * .5) {
      label.classList.add("activated");
      break;
    }
  }
}));