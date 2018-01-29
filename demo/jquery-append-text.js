// https://stackoverflow.com/a/7619765/1048589
$.fn.appendText = function(text) {
  return this.each(function() {
      var textNode = document.createTextNode(text);
      $(this).append(textNode);
  });
};
