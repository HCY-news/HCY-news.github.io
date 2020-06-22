(function() {
    var searchData = JSON.parse(decodeURIComponent(document.getElementById('search-data').innerHTML));
    var params = {}; // https://stackoverflow.com/a/21152762/6023997
    if(location.search) location.search.substr(1).split("&").forEach(function(item) {var s = item.split("="), k = s[0], v = s[1] && decodeURIComponent(s[1]); params[k] = v});

    var fuse = new Fuse(searchData, {
        keys: ['title', 'content'],
        threshold: 0.5,
    });

    var results = params.q ? fuse.search(params.q) : [];

    var html = '';

    for(var i in results) {
        var result = results[i];

        // Remove all images and videos
        var dom = (new DOMParser).parseFromString(result.item.content, 'text/html').documentElement;
        dom.querySelectorAll('img, video, iframe').forEach(function(node) {
            node.parentElement.removeChild(node);
        });

        html += '<div class="search-result" onclick="window.location.href=&quot;' + result.item.target + '&quot;, &quot;_blank&quot;">';
        html += dom.outerHTML;
        html += '</div>';
    }

    document.getElementById('content').innerHTML = html;
})();
