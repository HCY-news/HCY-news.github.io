window.onload = function() {
    var lang = window.language || 'en';

    var searchData = JSON.parse(decodeURIComponent(document.getElementById('search-data').innerHTML));
    var searchQuery = "";

    if(location.search) {
        var params = location.search.substr(1).split("&");
        for(var i in params) {
            var item = params[i];
            var s = item.split("=");
            if(s[0] === 'q') {
                searchQuery = s[1] && decodeURIComponent(s[1].replace(/\+/g, ' '));
                sessionStorage['query'] = searchQuery;
                break;
            }
        }
    } else if(sessionStorage['query']) {
        searchQuery = sessionStorage['query']
    }

    document.getElementById('search-query').innerText = searchQuery;
    document.querySelector('.search-box input[type="search"]').value = searchQuery;

    var fuse = new Fuse(searchData, {
        keys: ['title', 'content'],
        minMatchCharLength: 2,
        ignoreLocation: true,
        threshold: 0.5,
    });

    var results = fuse.search(searchQuery);
    results = results.filter(function(r) {
        return r.item.lang === lang;
    });

    var html = '';

    for(var i in results) {
        var result = results[i];

        // Remove all images and videos
        var dom = (new DOMParser).parseFromString(result.item.content, 'text/html').documentElement;
        dom.querySelectorAll('img, video, iframe').forEach(function(node) {
            node.parentElement.removeChild(node);
        });

        html += '<div class="search-content" onclick="window.location.href=&quot;' + result.item.target + '&quot;, &quot;_blank&quot;">';
        html += dom.outerHTML;
        html += '</div>';
    }

    document.getElementById('search-result').innerHTML = html;
    document.getElementById('search-count').innerText = results.length;
};
