var fs = require('fs');
var path = require('path');
var glob = require('glob');

var {Converter} = require('showdown');
var plates = require('plates');

const READ_DIR = './blog';
const WRITE_DIR = './dist';
const TEMPLATE = './template.html';

if(!fs.existsSync(WRITE_DIR)) {
    fs.mkdirSync(WRITE_DIR);
}

let converter = new Converter({
    parseImgDimensions: true
});

let template = fs.readFileSync(TEMPLATE, 'utf-8');
let tempStat = fs.statSync(TEMPLATE);
let progStat = fs.statSync(process.argv[1]);

let posts = [];
let changed = false;

// Blog posts
let files = glob.sync(path.join(READ_DIR, '*.md'));
for(let file of files) {

    let data = fs.readFileSync(file, 'utf-8');
    let name = path.basename(file).replace(/.md$/, '');
    let target = path.join(WRITE_DIR, name + '.html');

    let [_, date, title, image] = data.match(/\[([0-9\-]+)\]::.*# (.*?)\n.*!\[.*\]\((.*)\)/s);
    posts.push({
        name: name,
        title: title,
        image: image,
        date: date
    });

    let fstat = fs.existsSync(file) && fs.statSync(file) || {};
    let tstat = fs.existsSync(target) && fs.statSync(target) || {};

    if(Math.max(fstat.mtime, tempStat.mtime, progStat.mtime) < tstat.mtime) {
        console.log("skip", file);
        continue;
    }

    changed = true;

    let html = plates.bind(template, {
        title: title,
        content: converter.makeHtml(data)
    });

    fs.writeFile(target, html, err => {
        if(err) throw(err);
        console.log(file, "->", target);
    });
}

// Main page
if(changed) {
    let content = `
# Rio's Blog
`

    for(let post of posts.reverse()) { // File with bigger filename comes first
        content += `
<a href="${post.name + '.html'}">
## ${post.title}
<span class=date>${post.date}</span>

![image](${post.image})
</a>
    `;
    }

    let html = plates.bind(template, {
        title: "Rio's Blog",
        content: converter.makeHtml(content)
    });
    let target = path.join(WRITE_DIR, 'index.html');
    fs.writeFile(target, html, err => {
        if(err) throw(err);
        console.log("index ->", target);
    });
} else console.log("skip index");
