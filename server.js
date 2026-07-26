const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const publicDir = path.join(__dirname, 'public');
const requestedPort = process.argv.indexOf('--port');
const port = Number(requestedPort >= 0 ? process.argv[requestedPort + 1] : process.env.PORT || 3434);

function projectList() {
  const entries = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] !== '--repo') continue;
    const value = process.argv[index + 1];
    if (!value) continue;
    const separator = value.indexOf('|');
    const name = separator >= 0 ? value.slice(0, separator).trim() : path.basename(value);
    const projectPath = separator >= 0 ? value.slice(separator + 1).trim() : value;
    entries.push({ id: `project-${entries.length + 1}`, name: name || path.basename(projectPath), path: projectPath });
  }
  return entries.length ? entries : [{ id: 'project-1', name: path.basename(process.cwd()), path: process.cwd() }];
}

const projects = projectList();
if (projects.some((project) => !project.path || !fs.existsSync(project.path))) {
  console.error('A Beads repository path does not exist. Pass --repo <path>.');
  process.exit(1);
}

function findProject(id) {
  return projects.find((project) => project.id === id) || projects[0];
}

function runBd(project, arguments_) {
  return new Promise((resolve, reject) => {
    const child = spawn('bd', ['-C', project.path, '--json', ...arguments_], {
      windowsHide: true,
      shell: false
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (data) => { stdout += data; });
    child.stderr.on('data', (data) => { stderr += data; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(stderr.trim() || stdout.trim() || `bd exited with ${code}`));
      try {
        resolve(stdout.trim() ? JSON.parse(stdout) : null);
      } catch {
        reject(new Error('Beads returned data that was not valid JSON.'));
      }
    });
  });
}

function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(body));
}

function safeId(id) {
  return typeof id === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(id);
}

async function readBody(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1024 * 1024) throw new Error('Request body is too large.');
  }
  return body ? JSON.parse(body) : {};
}

function sendFile(request, response) {
  const requestPath = new URL(request.url, 'http://localhost').pathname;
  const fileName = requestPath === '/' ? 'index.html' : requestPath.slice(1);
  const filePath = path.resolve(publicDir, fileName);
  if (!filePath.startsWith(publicDir + path.sep) && filePath !== path.join(publicDir, 'index.html')) {
    response.writeHead(403); return response.end();
  }
  const contentType = filePath.endsWith('.css') ? 'text/css' : filePath.endsWith('.js') ? 'application/javascript' : 'text/html';
  fs.readFile(filePath, (error, data) => {
    if (error) { response.writeHead(error.code === 'ENOENT' ? 404 : 500); return response.end(); }
    response.writeHead(200, { 'Content-Type': `${contentType}; charset=utf-8` });
    response.end(data);
  });
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    const project = findProject(url.searchParams.get('project'));
    if (request.method === 'GET' && url.pathname === '/api/projects') {
      return json(response, 200, projects.map(({ id, name }) => ({ id, name })));
    }
    if (request.method === 'GET' && url.pathname === '/api/issues') {
      const issues = await runBd(project, ['list', '--all', '--flat', '--limit', '0', '--sort', 'updated', '--reverse']);
      return json(response, 200, Array.isArray(issues) ? issues : issues.issues || []);
    }
    if (request.method === 'GET' && url.pathname.startsWith('/api/issues/')) {
      const id = decodeURIComponent(url.pathname.slice('/api/issues/'.length));
      if (!safeId(id)) return json(response, 400, { error: 'Invalid ticket id.' });
      const issue = await runBd(project, ['show', id, '--long']);
      return json(response, 200, Array.isArray(issue) ? issue[0] : issue);
    }
    if (request.method === 'PUT' && url.pathname.startsWith('/api/issues/')) {
      const id = decodeURIComponent(url.pathname.slice('/api/issues/'.length));
      if (!safeId(id)) return json(response, 400, { error: 'Invalid ticket id.' });
      const input = await readBody(request);
      const args = ['update', id];
      for (const [field, flag] of Object.entries({ title: '--title', description: '--description', status: '--status', type: '--type', assignee: '--assignee', priority: '--priority', notes: '--notes' })) {
        if (typeof input[field] === 'string') args.push(flag, input[field]);
      }
      if (args.length === 2) return json(response, 400, { error: 'There are no changes to save.' });
      const updated = await runBd(project, args);
      return json(response, 200, Array.isArray(updated) ? updated[0] : updated);
    }
    if (url.pathname.startsWith('/api/')) return json(response, 404, { error: 'Not found.' });
    return sendFile(request, response);
  } catch (error) {
    return json(response, 500, { error: error.message || 'Unexpected server error.' });
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Beads GUI listening at http://127.0.0.1:${port}`);
  console.log(`Using Beads projects: ${projects.map((project) => `${project.name} (${project.path})`).join(', ')}`);
});
