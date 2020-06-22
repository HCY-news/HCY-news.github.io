(function() {
    let searchData = JSON.parse(decodeURIComponent(document.getElementById('search-data').innerHTML));
    let fuse = new Fuse(searchData, {keys: ['title', 'content']});
    console.log(fuse.search("Weibo"));
})();
