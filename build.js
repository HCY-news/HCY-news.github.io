var fs = require('fs');
var path = require('path');
var glob = require('glob');

var {JSDOM} = require('jsdom');
var showdown = require('showdown');

const BLOG_DIR = './blog';
const PAGE_DIR = './pages';
const WRITE_DIR = './dist';
const TEMPLATE = './template.html';
const BLOG_ROOT = process.env.BLOG_ROOT || '';

const translations = {
    lang: {
        en: "English",
        'zh-TW': "繁體中文",
        'zh-CN': "簡体中文"
    },
    "back-to-top": {
        en: "Back to Top",
        'zh-TW': "回到頂端",
        'zh-CN': "回到顶端"
    }
};

if(!fs.existsSync(WRITE_DIR)) {
    fs.mkdirSync(WRITE_DIR);
}

let converter = new showdown.Converter({
    customizedHeaderId: true,
    parseImgDimensions: true,
    openLinksInNewWindow: true,
    tables: true,
    strikethrough: true,
});

let template = fs.readFileSync(TEMPLATE, 'utf-8');
let tempStat = fs.statSync(TEMPLATE);
let progStat = fs.statSync(process.argv[1]);

let pageNavs = {}, pages = [];

// Blog posts
for(let dir of [BLOG_DIR, PAGE_DIR]) {
    let files = glob.sync(path.join(dir, '**/*.{md,html}'));
    for(let file of files) {

        let data = fs.readFileSync(file, 'utf-8');
        let rel = path.relative(dir, file);
        let target = rel.replace(/\.md$/, '.html');
        let [_, name, _1, lang, ext] = path.basename(file).match(/^(.*?)(\.([^.]+))?\.([a-z]+){1}$/, '');
        let navs = rel.split(path.sep);

        let page = {};
        if(dir === BLOG_DIR) {
            page = pageNavs;
            for(let nav of navs) {
                if(!page[nav]) {
                    page[nav] = {};
                }
                page = page[nav];
            }
        }

        let content = data;
        if(ext === "md")
            content = converter.makeHtml(data)

        let postDom = new JSDOM(content).window.document;
        let title = postDom.getElementById('title')?.innerHTML;
        let date = postDom.getElementById('date')?.innerHTML;

        let langs = glob.sync(file.replace(/\.[^.]+\.(md|html)$/, '.*.$1')).map(file => file.match(/(\.([^.]+))*\.(md|html)$/)[2]);

        page.title = title || path.basename(file).replace(/(\..*){0,1}\.md/, '');
        page.name = name;
        page.date = date;
        page.lang = lang;
        page.langs = langs;
        page.blog = dir === BLOG_DIR,
        page.source = file;
        page.target = target;
        page.content = content;

        pages.push(page);
    }
}

// Navigation list
let makeNavs = (nav, selfTarget, lang) => {
    let isEnd = nav => !Object.values(nav).every(v => typeof(v) === 'object');

    if(isEnd(nav)) {
        // Page-nav
        if(nav.target === selfTarget) {
            return `<span class="nav-name nav-current" >${nav.title}</span>`;
        } else {
            return `<a class="nav-name" href="/${nav.target}">${nav.title}</a>`;
        }

    } else {

        // Directory-nav
        let childCount = 0;
        let html = '<ul>';
        for(let name of Object.keys(nav).sort((a, b) => {
            if(a.startsWith('index')) return -1;
            if(b.startsWith('index')) return  1;
            return a - b;
        })) {
            let child = nav[name];
            if(lang && child.lang && child.lang !== lang) continue;

            let childHtml = makeNavs(child, selfTarget, lang);
            if(childHtml !== '') {
                html += `
                    <li tabindex=0>
                        ${!isEnd(child) ? `<span class="nav-name">${name.replace(/^[0-9.]*\./, '')}</span>` : ''}
                        ${childHtml}
                    </li>
                `;
                childCount++;
            }
        }
        html += '</ul>';

        return childCount > 0 ? html : '';
    }
}

// Searchable contents
let searchContent = encodeURIComponent(JSON.stringify(pages
    .filter(p => p.blog)
    .map(p => ({
        title: p.title,
        lang: p.lang,
        target: path.join(BLOG_ROOT, p.target).split(path.sep).join('/'), // So it works on windows dev environment
        content: p.content
    }))
));

let makeHTML = page => {
    let document = new JSDOM(template).window.document;

    // Contents
    document.getElementById('title').innerHTML = page.title;
    document.getElementById('nav-list').innerHTML = makeNavs(pageNavs, page.target, page.lang);
    document.getElementById('content').innerHTML = page.content;

    // Language list
    if(page.lang && document.getElementById('lang-select')) {
        document.getElementById('lang-select').innerHTML =
            `<li>${translations.lang[page.lang] || page.lang}</li>` +
            page.langs.map(lang => lang && lang !== page.lang && `
                <li>
                    <a href="${page.name}.${lang}.html"}>
                        ${translations.lang[lang] || lang}
                    </a>
                </li>
            ` || '').reduce((a,c) => a+c, '');
    }

    // Search data
    let searchTag = document.getElementById('search-data');
    if(searchTag) {
        searchTag.innerHTML = searchContent;
    }
    
    // Make thumb images focusable
    document.querySelectorAll('.thumb img').forEach(e => {
        e.tabIndex = "1";
    });
    
    // Translations
    document.querySelectorAll('.back-to-top').forEach(e => {
        e.textContent = translations['back-to-top'][page.lang] || e.textContent;
    });

    // Change root of absolute paths
    for(let field of ['href', 'src', 'action']) {
        document.querySelectorAll(`*[${field}^='/']`).forEach(e => {
            if(!e[field].startsWith('//')) {
                e[field] = BLOG_ROOT + e[field];
            }
        });
    }

    return document.documentElement.outerHTML;
};

for(let page of pages) {
    let target = path.join(WRITE_DIR, page.target);

    if(process.argv[2] !== 'rebuild') {
        // Only update file when the last modify time is older
        let fstat = fs.existsSync(page.source) && fs.statSync(page.source) || {};
        let tstat = fs.existsSync(target) && fs.statSync(target) || {};
        if(Math.max(fstat.mtime, tempStat.mtime, progStat.mtime) < tstat.mtime) {
            console.log("skip writing", page.source);
            continue;
        }
    }

    // write file
    fs.mkdir(path.dirname(target), {recursive: true}, err => {
        if(err) throw(err);
        fs.writeFile(target, makeHTML(page), err => {
            if(err) throw(err);
            console.log(page.source, "->", target);
        });
    });
}
