const state = { projects: [], projectId: null, issues: [], selectedId: null, selected: null, hideClosed: localStorage.getItem('beads.hideClosed') !== 'false', sort: { key: 'updated', direction: 'desc' } };
const $ = (selector) => document.querySelector(selector);
const list = $('#ticket-list');
const panel = $('#detail-panel');
const notice = $('#notice');

function text(value) { return value == null || value === '' ? '—' : String(value); }
function field(issue, ...keys) { return keys.map((key) => issue?.[key]).find((value) => value != null); }
function date(value) { if (!value) return '—'; const parsed = new Date(value); return Number.isNaN(parsed) ? String(value) : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(parsed); }
function statusLabel(value) { return text(value).replaceAll('_', ' '); }
function showError(message) { notice.hidden = false; notice.textContent = message; }
function clearError() { notice.hidden = true; notice.textContent = ''; }

async function api(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not reach Beads.');
  return data;
}

function projectUrl(path) {
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}project=${encodeURIComponent(state.projectId)}`;
}

function filteredIssues() {
  const query = $('#search-input').value.trim().toLowerCase();
  const wantedStatus = $('#status-filter').value;
  const wantedType = $('#type-filter').value;
  return state.issues.filter((issue) => {
    const status = field(issue, 'status') || 'open';
    const type = field(issue, 'issue_type', 'type') || 'task';
    const searchable = [field(issue, 'id'), field(issue, 'title'), field(issue, 'description'), field(issue, 'notes'), ...(field(issue, 'labels') || [])].join(' ').toLowerCase();
    const closedIsHidden = state.hideClosed && wantedStatus === 'all' && status === 'closed';
    return !closedIsHidden && (wantedStatus === 'all' || status === wantedStatus) && (wantedType === 'all' || type === wantedType) && (!query || searchable.includes(query));
  });
}

function sortedIssues() {
  const { key, direction } = state.sort;
  const multiplier = direction === 'asc' ? 1 : -1;
  const values = {
    id: (issue) => field(issue, 'id') || '',
    title: (issue) => field(issue, 'title') || '',
    status: (issue) => field(issue, 'status') || 'open',
    created: (issue) => new Date(field(issue, 'created_at', 'created') || 0).getTime() || 0,
    updated: (issue) => new Date(field(issue, 'updated_at', 'updated') || 0).getTime() || 0
  };
  return filteredIssues().sort((left, right) => {
    const leftValue = values[key](left); const rightValue = values[key](right);
    const result = typeof leftValue === 'number' ? leftValue - rightValue : String(leftValue).localeCompare(String(rightValue));
    return result === 0 ? String(field(left, 'id')).localeCompare(String(field(right, 'id'))) : result * multiplier;
  });
}

function renderSortButtons() {
  document.querySelectorAll('.sort-button').forEach((button) => {
    const active = button.dataset.sort === state.sort.key;
    button.classList.toggle('active', active);
    button.setAttribute('aria-sort', active ? (state.sort.direction === 'asc' ? 'ascending' : 'descending') : 'none');
    button.querySelector('span').textContent = active ? (state.sort.direction === 'asc' ? '↑' : '↓') : '';
  });
}

function renderList() {
  const issues = sortedIssues();
  renderSortButtons();
  const total = state.issues.length;
  const closedHidden = state.hideClosed && $('#status-filter').value === 'all'
    ? state.issues.filter((issue) => (field(issue, 'status') || 'open') === 'closed').length
    : 0;
  const countParts = [`${issues.length} of ${total} ticket${total === 1 ? '' : 's'}`];
  if (closedHidden) countParts.push(`${closedHidden} closed hidden`);
  $('#issue-count').textContent = countParts.join(' · ');
  list.replaceChildren();
  if (!issues.length) { list.innerHTML = '<p class="no-results">No tickets match these filters.</p>'; return; }
  const template = $('#ticket-row-template');
  for (const issue of issues) {
    const row = template.content.firstElementChild.cloneNode(true);
    const id = field(issue, 'id'); const status = field(issue, 'status') || 'open';
    row.dataset.id = id; row.classList.toggle('selected', id === state.selectedId);
    row.querySelector('.ticket-id').textContent = text(id);
    row.querySelector('.ticket-title').textContent = text(field(issue, 'title'));
    const pill = row.querySelector('.status-pill'); pill.textContent = statusLabel(status); pill.classList.add(status);
    row.querySelector('.created').textContent = date(field(issue, 'created_at', 'created'));
    row.querySelector('.updated').textContent = date(field(issue, 'updated_at', 'updated'));
    row.addEventListener('click', () => selectIssue(id)); list.append(row);
  }
}

function populateTypeFilter() {
  const select = $('#type-filter'); const current = select.value;
  const types = [...new Set(state.issues.map((item) => field(item, 'issue_type', 'type')).filter(Boolean))].sort();
  select.replaceChildren(new Option('All tickets', 'all'), ...types.map((type) => new Option(type, type)));
  select.value = types.includes(current) ? current : 'all';
}

function detailHtml(issue) {
  const id = field(issue, 'id'); const type = field(issue, 'issue_type', 'type') || 'task'; const status = field(issue, 'status') || 'open';
  return `<div class="detail-head"><div class="detail-meta"><span>${id}</span><span>·</span><span>${type}</span></div><h2>${escapeHtml(field(issue, 'title'))}</h2><div class="detail-actions"><button class="action" id="edit-button">Edit ticket</button></div></div><div class="detail-body"><div class="detail-view"><div class="detail-field"><label>Description</label><p class="detail-copy ${field(issue, 'description') ? '' : 'empty'}">${escapeHtml(field(issue, 'description') || 'No description provided.')}</p></div><div class="detail-field"><label>Notes</label><p class="detail-copy ${field(issue, 'notes') ? '' : 'empty'}">${escapeHtml(field(issue, 'notes') || 'No notes provided.')}</p></div><dl class="facts"><div class="fact"><dt>Status</dt><dd><span class="status-pill ${status}">${statusLabel(status)}</span></dd></div><div class="fact"><dt>Priority</dt><dd>${escapeHtml(text(field(issue, 'priority')))}</dd></div><div class="fact"><dt>Assignee</dt><dd>${escapeHtml(text(field(issue, 'assignee')))}</dd></div><div class="fact"><dt>Labels</dt><dd>${escapeHtml((field(issue, 'labels') || []).join(', ') || '—')}</dd></div><div class="fact"><dt>Created</dt><dd>${date(field(issue, 'created_at', 'created'))}</dd></div><div class="fact"><dt>Updated</dt><dd>${date(field(issue, 'updated_at', 'updated'))}</dd></div></dl></div><form class="editor" id="editor"><div class="detail-field"><label for="edit-title">Title</label><input id="edit-title" value="${escapeAttribute(field(issue, 'title') || '')}" required /></div><div class="editor-grid"><div class="detail-field"><label for="edit-status">Status</label><select id="edit-status">${['open','in_progress','blocked','deferred','closed'].map((item) => `<option value="${item}" ${item === status ? 'selected' : ''}>${statusLabel(item)}</option>`).join('')}</select></div><div class="detail-field"><label for="edit-type">Type</label><input id="edit-type" value="${escapeAttribute(type)}" /></div></div><div class="editor-grid"><div class="detail-field"><label for="edit-priority">Priority</label><input id="edit-priority" value="${escapeAttribute(text(field(issue, 'priority')).replace('—', ''))}" placeholder="P0–P4" /></div><div class="detail-field"><label for="edit-assignee">Assignee</label><input id="edit-assignee" value="${escapeAttribute(field(issue, 'assignee') || '')}" /></div></div><div class="detail-field"><label for="edit-description">Description</label><textarea id="edit-description">${escapeHtml(field(issue, 'description') || '')}</textarea></div><div class="detail-field"><label for="edit-notes">Notes</label><textarea id="edit-notes">${escapeHtml(field(issue, 'notes') || '')}</textarea></div><div class="detail-actions"><button class="action primary" type="submit">Save changes</button><button class="action" type="button" id="cancel-edit">Cancel</button></div></form></div>`;
}

function escapeHtml(value) { const node = document.createElement('span'); node.textContent = value == null ? '' : String(value); return node.innerHTML; }
function escapeAttribute(value) { return escapeHtml(value).replaceAll('`', '&#96;'); }

function renderDetail() {
  if (!state.selected) return;
  panel.innerHTML = detailHtml(state.selected);
  $('#edit-button').addEventListener('click', () => { panel.querySelector('.detail-view').classList.add('hidden'); panel.querySelector('.editor').classList.add('active'); });
  $('#cancel-edit').addEventListener('click', renderDetail);
  $('#editor').addEventListener('submit', saveIssue);
}

async function selectIssue(id) {
  state.selectedId = id; renderList(); clearError();
  panel.innerHTML = '<p class="loading">Loading ticket…</p>';
  try { state.selected = await api(projectUrl(`/api/issues/${encodeURIComponent(id)}`)); renderDetail(); }
  catch (error) { state.selected = null; panel.innerHTML = '<div class="empty-state"><h2>Could not load ticket</h2><p>Please refresh and try again.</p></div>'; showError(error.message); }
}

async function saveIssue(event) {
  event.preventDefault(); const form = event.currentTarget; const button = form.querySelector('[type="submit"]'); button.disabled = true; button.textContent = 'Saving…'; clearError();
  const payload = { title: $('#edit-title').value.trim(), status: $('#edit-status').value, type: $('#edit-type').value.trim(), priority: $('#edit-priority').value.trim(), assignee: $('#edit-assignee').value.trim(), description: $('#edit-description').value, notes: $('#edit-notes').value };
  try { state.selected = await api(projectUrl(`/api/issues/${encodeURIComponent(state.selectedId)}`), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); await loadIssues(); renderDetail(); }
  catch (error) { showError(error.message); button.disabled = false; button.textContent = 'Save changes'; }
}

async function loadIssues() {
  clearError(); list.innerHTML = '<p class="loading">Loading tickets…</p>';
  try { state.issues = await api(projectUrl('/api/issues')); populateTypeFilter(); renderList(); }
  catch (error) { list.innerHTML = '<p class="no-results">Tickets could not be loaded.</p>'; showError(error.message); }
}

async function loadProjects() {
  try {
    state.projects = await api('/api/projects');
    const select = $('#project-filter');
    select.replaceChildren(...state.projects.map((project) => new Option(project.name, project.id)));
    state.projectId = state.projects[0]?.id || null;
    select.addEventListener('change', () => { state.projectId = select.value; state.selectedId = null; state.selected = null; panel.innerHTML = '<div class="empty-state"><span class="empty-glyph">◌</span><h2>Select a ticket</h2><p>Its complete details and editor will appear here.</p></div>'; loadIssues(); });
    await loadIssues();
  } catch (error) { showError(error.message); }
}

$('#search-input').addEventListener('input', renderList); $('#status-filter').addEventListener('change', renderList); $('#type-filter').addEventListener('change', renderList); $('#refresh-button').addEventListener('click', loadIssues);
document.querySelectorAll('.sort-button').forEach((button) => button.addEventListener('click', () => {
  const key = button.dataset.sort;
  state.sort = state.sort.key === key ? { key, direction: state.sort.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: ['created', 'updated'].includes(key) ? 'desc' : 'asc' };
  renderList();
}));
const settingsButton = $('#settings-button'); const settingsPopover = $('#settings-popover'); const hideClosedToggle = $('#hide-closed-toggle');
hideClosedToggle.checked = state.hideClosed;
settingsButton.addEventListener('click', (event) => { event.stopPropagation(); const opening = settingsPopover.hidden; settingsPopover.hidden = !opening; settingsButton.setAttribute('aria-expanded', String(opening)); });
hideClosedToggle.addEventListener('change', () => { state.hideClosed = hideClosedToggle.checked; localStorage.setItem('beads.hideClosed', String(state.hideClosed)); renderList(); });
document.addEventListener('click', (event) => { if (!event.target.closest('.settings-wrap') && !settingsPopover.hidden) { settingsPopover.hidden = true; settingsButton.setAttribute('aria-expanded', 'false'); } });
loadProjects();
