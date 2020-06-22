var match = window.location.pathname.match(/([a-zA-Z\-]+).html$/);
if(match) {
    localStorage['language'] = match[1];
}
