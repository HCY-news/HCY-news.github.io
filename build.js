var fs = require('fs');
var path = require('path');
var glob = require('glob');

var {JSDOM} = require('jsdom');
var showdown = require('showdown');
require('showdown-highlightjs-extension');

const READ_DIR = './blog';
const WRITE_DIR = './dist';
const TEMPLATE = './template.html';
const BLOG_ROOT = process.env.BLOG_ROOT || '/';

const langName = {
    en: "English",
    'zh-TW': "繁體中文"
};

if(!fs.existsSync(WRITE_DIR)) {
    fs.mkdirSync(WRITE_DIR);
}

let converter = new showdown.Converter({
    customizedHeaderId: true,
    parseImgDimensions: true,
    openLinksInNewWindow: true,
    tables: true,
    extensions: ['highlightjs']
});

let template = fs.readFileSync(TEMPLATE, 'utf-8');
let tempStat = fs.statSync(TEMPLATE);
let progStat = fs.statSync(process.argv[1]);

let files = glob.sync(path.join(READ_DIR, '**/*.md'));
let pageNavs = {}, pages = [];

// Blog posts
for(let file of files) {

    let data = fs.readFileSync(file, 'utf-8');
    let rel = path.relative(READ_DIR, file);
    let target = rel.replace(/\.md$/, '.html');
    let navs = rel.split('/');

    let page = pageNavs;
    for(let nav of navs) {
        if(!page[nav]) {
            page[nav] = {};
        }
        page = page[nav];
    }
    pages.push(page);

    let content = converter.makeHtml(data)

    let postDom = new JSDOM(content).window.document;
    let title = postDom.getElementById('title')?.innerHTML;
    let date = postDom.getElementById('date')?.innerHTML;

    let getLang = file => file.match(/(\.([^.]+))*\.md$/)[2];
    let lang = getLang(file);
    let langs = glob.sync(file.replace(/\.[^.]+\.md$/, '.*.md')).map(getLang);

    page.title = title || path.basename(file).replace(/(\..*){0,1}\.md/, '');
    page.date = date;
    page.lang = lang;
    page.langs = langs;
    page.source = file;
    page.target = target;
    page.content = content;
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

let makeHTML = page => {
    let document = new JSDOM(template).window.document;

    // Contents
    document.getElementById('title').innerHTML = page.title;
    document.getElementById('nav').innerHTML = makeNavs(pageNavs, page.target, page.lang);
    document.getElementById('content').innerHTML = page.content;
    document.getElementById('lang-select').innerHTML =
        page.langs.map(l => l && `
            <option value="${l}" ${l === page.lang ? 'selected disabled' : ''}>
                ${langName[l] || l}
            </option>
        ` || '').reduce((a,c) => a+c, '');

    // Change root of absolute paths
    document.querySelectorAll("*[href^='/']").forEach(e => {
        e.href = BLOG_ROOT + e.href;
    });
    document.querySelectorAll("*[src^='/']").forEach(e => {
        e.src = BLOG_ROOT + e.src;
    });

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
