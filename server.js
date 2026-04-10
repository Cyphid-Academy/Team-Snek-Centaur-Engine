const express = require('express');
const { marked } = require('marked');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 5000;

const specs = [
  { file: 'specs/01-game-rules.md', title: '01 - Game Rules' },
  { file: 'specs/02-platform-architecture.md', title: '02 - Platform Architecture' },
  { file: 'specs/03-auth-and-identity.md', title: '03 - Auth & Identity' },
  { file: 'specs/04-stdb-engine.md', title: '04 - SpacetimeDB Engine' },
  { file: 'specs/05-convex-platform.md', title: '05 - Convex Platform' },
  { file: 'specs/06-centaur-state.md', title: '06 - Centaur State' },
  { file: 'specs/07-bot-framework.md', title: '07 - Bot Framework' },
  { file: 'specs/08-centaur-server-app.md', title: '08 - Centaur Server App' },
  { file: 'specs/09-platform-ui.md', title: '09 - Platform UI' },
];

function renderPage(title, content, activePath) {
  const navLinks = [
    { href: '/', label: 'README' },
    ...specs.map(s => ({ href: '/' + s.file, label: s.title })),
    { href: '/informal-spec/team-snek-centaur-platform-spec-v2.2.md', label: 'Informal Spec v2.2' },
    { href: '/SPEC-INSTRUCTIONS.md', label: 'Spec Instructions' },
  ];

  const nav = navLinks.map(l => {
    const active = activePath === l.href ? ' class="active"' : '';
    return `<li${active}><a href="${l.href}">${l.label}</a></li>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Team Snek Centaur Platform</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f1117;
      color: #e2e8f0;
      display: flex;
      min-height: 100vh;
    }
    nav {
      width: 260px;
      min-width: 260px;
      background: #1a1d27;
      border-right: 1px solid #2d3148;
      padding: 24px 0;
      overflow-y: auto;
      position: sticky;
      top: 0;
      height: 100vh;
    }
    nav h1 {
      font-size: 14px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #7c85af;
      padding: 0 20px 16px;
      border-bottom: 1px solid #2d3148;
      margin-bottom: 12px;
    }
    nav ul { list-style: none; }
    nav ul li a {
      display: block;
      padding: 8px 20px;
      color: #94a3b8;
      text-decoration: none;
      font-size: 13.5px;
      transition: all 0.15s;
      border-left: 3px solid transparent;
    }
    nav ul li a:hover {
      color: #e2e8f0;
      background: #232640;
      border-left-color: #4f60e8;
    }
    nav ul li.active a {
      color: #818cf8;
      background: #1e2340;
      border-left-color: #6366f1;
      font-weight: 500;
    }
    main {
      flex: 1;
      padding: 48px 64px;
      max-width: 900px;
      overflow-x: hidden;
    }
    .brand {
      font-size: 13px;
      font-weight: 600;
      color: #6366f1;
      padding: 0 20px 20px;
      display: block;
      letter-spacing: 0.04em;
    }
    h1 { font-size: 2rem; margin-bottom: 24px; color: #f0f4ff; line-height: 1.2; }
    h2 { font-size: 1.35rem; margin: 40px 0 14px; color: #c7d2fe; border-bottom: 1px solid #2d3148; padding-bottom: 8px; }
    h3 { font-size: 1.1rem; margin: 28px 0 10px; color: #a5b4fc; }
    h4 { font-size: 0.95rem; margin: 20px 0 8px; color: #93c5fd; }
    p { line-height: 1.75; margin-bottom: 16px; color: #cbd5e1; }
    a { color: #818cf8; text-decoration: none; }
    a:hover { text-decoration: underline; }
    code {
      font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
      background: #1e2340;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.875em;
      color: #a5b4fc;
    }
    pre {
      background: #1a1d27;
      border: 1px solid #2d3148;
      border-radius: 8px;
      padding: 20px;
      overflow-x: auto;
      margin: 16px 0;
    }
    pre code {
      background: none;
      padding: 0;
      font-size: 0.85rem;
      color: #e2e8f0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      font-size: 0.9rem;
    }
    th {
      background: #1e2340;
      color: #a5b4fc;
      padding: 10px 14px;
      text-align: left;
      border: 1px solid #2d3148;
    }
    td {
      padding: 9px 14px;
      border: 1px solid #2d3148;
      color: #cbd5e1;
    }
    tr:nth-child(even) td { background: #161926; }
    blockquote {
      border-left: 3px solid #4f60e8;
      padding: 12px 20px;
      margin: 16px 0;
      background: #1a1d27;
      border-radius: 0 6px 6px 0;
      color: #94a3b8;
    }
    ul, ol {
      padding-left: 24px;
      margin-bottom: 16px;
      color: #cbd5e1;
    }
    li { margin-bottom: 6px; line-height: 1.7; }
    hr { border: none; border-top: 1px solid #2d3148; margin: 32px 0; }
    strong { color: #e2e8f0; }
    em { color: #94a3b8; }
  </style>
</head>
<body>
  <nav>
    <span class="brand">Team Snek Centaur</span>
    <h1>Specification</h1>
    <ul>${nav}</ul>
  </nav>
  <main>
    ${content}
  </main>
</body>
</html>`;
}

app.get('/', (req, res) => {
  const md = fs.readFileSync('README.md', 'utf8');
  const html = marked.parse(md);
  res.send(renderPage('README', html, '/'));
});

app.get('/SPEC-INSTRUCTIONS.md', (req, res) => {
  const md = fs.readFileSync('SPEC-INSTRUCTIONS.md', 'utf8');
  const html = marked.parse(md);
  res.send(renderPage('Spec Instructions', html, '/SPEC-INSTRUCTIONS.md'));
});

app.get('/informal-spec/:file', (req, res) => {
  const filePath = path.join('informal-spec', req.params.file);
  if (!fs.existsSync(filePath) || !filePath.endsWith('.md')) {
    return res.status(404).send('Not found');
  }
  const md = fs.readFileSync(filePath, 'utf8');
  const html = marked.parse(md);
  res.send(renderPage(req.params.file, html, '/informal-spec/' + req.params.file));
});

app.get('/specs/:file', (req, res) => {
  const filePath = path.join('specs', req.params.file);
  if (!fs.existsSync(filePath) || !filePath.endsWith('.md')) {
    return res.status(404).send('Not found');
  }
  const md = fs.readFileSync(filePath, 'utf8');
  const html = marked.parse(md);
  const spec = specs.find(s => s.file === 'specs/' + req.params.file);
  const title = spec ? spec.title : req.params.file;
  res.send(renderPage(title, html, '/specs/' + req.params.file));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Documentation server running on http://0.0.0.0:${PORT}`);
});
