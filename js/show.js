let activeShow = null;
let editingCueId = null;
let cuesCache = [];
let pageMode = 'create';

const FREQUENCY_OPTIONS = ['slow', 'moderate', 'fast'];
const TIMESTAMP_MMSS = /^(\d{1,2}):([0-5]\d)$/;
const TIMESTAMP_HMS = /^(\d{1,2}):([0-5]\d):([0-5]\d)$/;

const toTimestamp = (seconds) => {
  const d = new Date(seconds * 1000);
  return [d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()]
    .map(n => String(n).padStart(2, '0'))
    .join(':');
};

function isValidTimestamp(value) {
  const v = value.trim();
  const mmss = v.match(TIMESTAMP_MMSS);
  if (mmss) return true;
  const hms = v.match(TIMESTAMP_HMS);
  if (hms) return true;
  return false;
}

function getSecondsFromTimestamp(value){
  const hms = value.trim();
  var a = hms.split(':'); // split it at the colons
  // minutes are worth 60 seconds. Hours are worth 60 minutes.
  if (a.length == 3) {
    var H = parseInt(a[0], 10);
    var M = parseInt(a[1], 10);
    var S = parseInt(a[2], 10);
    var seconds = (H * 60 * 60) + (M * 60) + S; 
    // console.log(value + " in seconds is " + seconds);
    return seconds;
  }
  var M = parseInt(a[0], 10);
  var S = parseInt(a[1], 10);
  var seconds = (M * 60) + S; 
  // console.log(value + " in seconds is " + seconds);
  return seconds;
  
}

function parseDurationSeconds(value) {
  const v = String(value ?? '').trim();
  if (/^\d+$/.test(v)) return v;
  const match = v.match(/\d+/);
  return match ? match[0] : '';
}

function isValidDurationSeconds(value) {
  const v = String(value ?? '').trim();
  return /^\d+$/.test(v) && Number(v) > 0;
}

function clearCueFieldErrors() {
  setText('startTimeError', '');
  setText('durationError', '');
  const startTime = document.getElementById('start_time');
  const duration = document.getElementById('duration');
  startTime.classList.remove('field-invalid');
  duration.classList.remove('field-invalid');
  startTime.removeAttribute('aria-invalid');
  duration.removeAttribute('aria-invalid');
}

function validateCueForm(form) {
  clearCueFieldErrors();

  const startTimeEl = form.start_time;
  const durationEl = form.duration;
  const startTime = startTimeEl.value.trim();
  const duration = durationEl.value.trim();
  let valid = true;

  if (!isValidTimestamp(startTime)) {
    valid = false;
    setText('startTimeError', 'Enter a valid time as MM:SS or HH:MM:SS (e.g. 49:36 or 1:05:30).');
    startTimeEl.classList.add('field-invalid');
    startTimeEl.setAttribute('aria-invalid', 'true');
  }

  if (!isValidDurationSeconds(duration)) {
    valid = false;
    setText('durationError', 'Duration must be a whole number of seconds (e.g. 7).');
    durationEl.classList.add('field-invalid');
    durationEl.setAttribute('aria-invalid', 'true');
  }

  if (!valid) {
    setText('cueError', 'Fix the highlighted fields before saving.');
    return { ok: false, payload: null };
  }

  const payload = Object.fromEntries(new FormData(form).entries());
  payload.start_time = startTime;
  payload.start_sec = getSecondsFromTimestamp(startTime);
  payload.duration = String(Number(duration));
  payload.end_sec = payload.start_sec + payload.duration;
  payload.act_id = document.querySelector(".cue-list-panel.active").dataset.actId
  return { ok: true, payload };
}

function getShowIdFromUrl() {
  const id = new URLSearchParams(window.location.search).get('id');
  if (!id) return null;
  // const parsed = Number(id);
  // console.log("ID from URL is " + id + " which parses to " + parsed);
  return id;
}

function displayValue(value) {
  const text = value?.toString().trim();
  if (!text) return '<span class="empty">Not provided</span>';
  return escapeHtml(text);
}

function renderShowSummary(show) {
  const host = document.getElementById('showSummaryContent');
  if (!show) {
    host.innerHTML = '';
    return;
  }

  host.innerHTML = `
    <div class="show-summary-header">
      <h2>${escapeHtml(show.production_name || 'Untitled show')}</h2>
      <span class="badge ${escapeHtml(show.status)}">${escapeHtml(show.status)}</span>
    </div>
    <div class="show-summary-block">
      <h3>Production</h3>
      <div class="show-summary-grid">
        <div class="show-summary-item"><dt>Director</dt><dd>${displayValue(show.director)}</dd></div>
        <div class="show-summary-item"><dt>Theater company</dt><dd>${displayValue(show.theater_company)}</dd></div>
        <div class="show-summary-item"><dt>Venue</dt><dd>${displayValue(show.venue)}</dd></div>
        <div class="show-summary-item"><dt>Technical lock date</dt><dd>${displayValue(show.technical_lock_date)}</dd></div>
      </div>
    </div>
    <div class="show-summary-block">
      <h3>Contacts</h3>
      <div class="show-summary-grid">
        <div class="show-summary-item"><dt>Primary contact name</dt><dd>${displayValue(show.primary_contact_name)}</dd></div>
        <div class="show-summary-item"><dt>Primary contact role</dt><dd>${displayValue(show.primary_contact_role)}</dd></div>
        <div class="show-summary-item"><dt>Contact email</dt><dd>${displayValue(show.primary_contact_email)}</dd></div>
      </div>
    </div>
    <div class="show-summary-block">
      <h3>Accessibility notes</h3>
      <div class="show-summary-grid">
        <div class="show-summary-item"><dt>Seating recommendation</dt><dd>${displayValue(show.seating_recommendation)}</dd></div>
        <div class="show-summary-item"><dt>Relaxed performance dates</dt><dd>${displayValue(show.relaxed_performances)}</dd></div>
      </div>
    </div>
  `;
}

function fillShowForm(show) {
  const form = document.getElementById('showForm');
  Array.from(form.elements).forEach((el) => {
    if (!el.name) return;
    el.value = show?.[el.name] ?? '';
  });
}

function setPageMode(mode) {
  pageMode = mode;
  const summary = document.getElementById('showSummarySection');
  const form = document.getElementById('showForm');
  const cues = document.getElementById('cueSection');
  const cancelShowEdit = document.getElementById('cancelShowEditBtn');
  const submitShow = document.getElementById('submitShowBtn');
  const subtitle = document.getElementById('showEditorSubtitle');
  const formHelper = document.getElementById('showFormHelper');

  if (mode === 'create') {
    summary.hidden = true;
    form.hidden = false;
    cues.hidden = true;
    cancelShowEdit.hidden = true;
    submitShow.disabled = true;
    subtitle.textContent = 'Enter show details first. You can add flash cues after saving.';
    formHelper.hidden = false;
    document.getElementById('saveShowBtn').textContent = 'Save show';
    return;
  }

  if (mode === 'view') {
    summary.hidden = false;
    form.hidden = true;
    cues.hidden = false;
    cancelShowEdit.hidden = true;
    submitShow.disabled = false;
    subtitle.textContent = 'Review show details above, then add or edit flash cues below.';
    renderShowSummary(activeShow);
    return;
  }

  if (mode === 'edit-show') {
    summary.hidden = true;
    form.hidden = false;
    cues.hidden = true;
    cancelShowEdit.hidden = false;
    submitShow.disabled = true;
    subtitle.textContent = 'Update show details. Cue editing is available after you save.';
    formHelper.hidden = true;
    document.getElementById('saveShowBtn').textContent = 'Save changes';
    fillShowForm(activeShow);
  }
}

function setFrequencyValue(value) {
  const select = document.getElementById('frequency');
  select.querySelectorAll('option[data-legacy]').forEach((opt) => opt.remove());

  if (value && !FREQUENCY_OPTIONS.includes(value)) {
    const legacy = document.createElement('option');
    legacy.value = value;
    legacy.textContent = value;
    legacy.dataset.legacy = 'true';
    select.appendChild(legacy);
  }

  select.value = value || '';
}

function fillCueForm(cue) {
  clearCueFieldErrors();
  const form = document.getElementById('cueForm');
  Array.from(form.elements).forEach((el) => {
    if (!el.name) return;
    if (el.name === 'frequency') {
      setFrequencyValue(cue?.frequency ?? '');
      return;
    }
    if (el.name === 'duration') {
      el.value = parseDurationSeconds(cue?.duration ?? '');
      return;
    }
    if (el.name === 'start_time') {
      el.value = toTimestamp(cue?.start_sec ?? '');
      return;
    }
    el.value = cue?.[el.name] ?? '';
  });
}

function setCueEditMode(editing) {
  editingCueId = editing ? editing.id : null;
  setDisplayCueForm(true);

  if (editing != null){
    resetActiveAct();
    document.querySelector(`#cueListPanelAct${editing.act_id}`).classList.add("active");
  }
  
  document.getElementById('cueSubmitBtn').textContent = editing ? 'Update cue' : 'Save cue';
  document.getElementById('cancelCueEditBtn').hidden = !editing;
}

function setDisplayCueForm(displayForm){
  const editForm = document.querySelector("#cueFormDiv")
  editForm.style.display = displayForm ? "block" : "none";
}

function clearCueEdit() {
  setCueEditMode(null);
  document.getElementById('cueForm').reset();
  setFrequencyValue('');
  clearCueFieldErrors();
  setDisplayCueForm(false);
  setText('cueError', '');
  resetActiveAct();
}

function setShowPageTitle(show) {
  const title = show?.production_name
    ? `${show.production_name}`
    : 'New show';
  document.title = `${title} · FlashCue Contributor Portal`;
  setText('showEditorTitle', show ? show.production_name : 'New show');
}

async function loadShow(showId) {
  const data = await api(`/api/shows/${showId}`); // GET show data from API
  activeShow = data.show;

  setShowPageTitle(activeShow);
  setPageMode('view');
  clearCueEdit();
  await initActs(activeShow.id);
  await refreshCues();
}

async function deleteAct(act_id){
  try {
    const showId = getShowIdFromUrl();
    const result = await api(`/api/shows/${showId}/acts/${act_id}`, { 
      method: 'DELETE'
    });
  } catch(err){
    console.log(err);
  }
  const actDiv = document.querySelector("#cueListPanelAct" + act_id);
  actDiv.remove();
}

function createActDiv(act_data){
  const actsList = document.querySelector("#actsList");
  const label = act_data.label ? act_data.label : `Act ${act_data.act_number}`;
  const act_id = act_data.id;
    actsList.insertAdjacentHTML("beforeend", `
      <div class="panel cue-list-panel" id="cueListPanelAct${act_id}" data-act-id="${act_id}">
        <div class="act-panel">
          <h3 class="act-label" id="actLabel${act_id}">${label}</h3>
          <div>
              <button type="button" class="btn btn-secondary edit-btn" id="editAct${act_id}" aria-label="Edit act"><span aria-hidden="true">&#9998;</span></button>
              <button type="button" class="btn btn-secondary close-btn" id="deleteAct${act_id}" aria-label="Delete act"><span aria-hidden="true">&times;</span></button>
          </div>
        </div>
        <div class="panel-header">
          <h2>Current cues</h2>
          <button type="button" class="btn btn-secondary" id="addCueBtn${act_id}">Add new cue</button>
        </div>
        <div class="panel-body" id="cueList"></div>
      </div>  
  `);

  document.querySelector(`#addCueBtn${act_id}`).addEventListener('click', async () => {
    setDisplayCueForm(true);
    const cueFormTitle = document.querySelector("#cueFormTitle").textContent = "Create or edit flash cue for " + label;
    resetActiveAct();
    document.querySelector(`#cueListPanelAct${act_id}`).classList.add("active");
  });

  document.querySelector("#editAct" + act_id).addEventListener("click", async (e) => {
    const labelElement = document.querySelector("#actLabel" + act_id);
    labelElement.hidden = true;
    const parent = e.target.closest(".act-panel");
    parent.insertAdjacentHTML("afterbegin", `
      <div id="editAct">
        <input type="text" placeholder="${label}" id="newActLabel" name="newActLabel">
        <button type="button" class="btn btn-primary save-btn" id="saveAct${act_id}">Save</button>
        <button type="button" class="btn btn-secondary" id="cancelEditAct">Cancel</button>
      </div>
    `);

    const cancelBtn = document.querySelector("#cancelEditAct");
    const saveBtn = document.querySelector(`#saveAct${act_id}`);

    cancelBtn.addEventListener("click", e => {
      parent.removeChild(document.querySelector("div#editAct"));
      labelElement.hidden = false;
    });

    saveBtn.addEventListener("click", async (e) => {
      const newLabel = document.querySelector("#newActLabel").value.trim();
      const payload = {"label": newLabel}
      const response = await api(`/api/shows/${activeShow.id}/acts/${act_id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      parent.removeChild(document.querySelector("div#editAct"));
      labelElement.hidden = false;
      labelElement.textContent = response[0].label;
    });
  });


  document.querySelector("#deleteAct" + act_id).addEventListener("click", async (e) => {
    if (!window.confirm(`Delete Act ${act_id}? This cannot be undone.`)) {
      return;
    }
    deleteAct(act_id);
  });

}

async function createAct(){
    const act_payload = {
    label: "", 
  }

  try {
    const showId = getShowIdFromUrl();
    const act_result = await api(`/api/shows/${showId}/acts`, {
      method: "POST",
      body: JSON.stringify(act_payload)
    });
    act_data = act_result.act_id;
    createActDiv(act_data);
    } catch (err) {
    console.log(err);
  }
}

function resetActiveAct(){
  const panels = document.querySelectorAll(".cue-list-panel");
  panels.forEach(panel => {
    panel.classList.remove("active");
  });
}

function bindCueListActions() {
  document.querySelectorAll('.edit-cue-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const cueId = btn.dataset.cueId;
      const cue = cuesCache.find((c) => c.id === cueId);
      if (!cue) return;
      fillCueForm(cue);
      setCueEditMode(cue);
      setText('cueSuccess', '');
      setText('cueError', '');
      document.getElementById('cueForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
      document.getElementById('source').focus();
    });
  });

  document.querySelectorAll('.delete-cue-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const cueId = btn.dataset.cueId;
      const cue = cuesCache.find((c) => c.id === cueId);
      if (!cue) return;

      const label = cue.source || `cue #${cue.flash_number}`;
      if (!window.confirm(`Delete cue "${label}"? This cannot be undone.`)) return;

      setText('cueSuccess', '');
      setText('cueError', '');

      try {
        await api(`/api/shows/${activeShow.id}/cues/${cueId}`, { method: 'DELETE' });
        if (editingCueId === cueId) clearCueEdit();
        setText('cueSuccess', 'Cue deleted.');
        await refreshCues();
      } catch (err) {
        setText('cueError', err.message);
      }
    });
  });
}

async function refreshCues() {
  let host = document.getElementById('cueList');
  if (!activeShow?.id) {
    cuesCache = [];
    host.innerHTML = '<div class="empty">Save the show before adding cues.</div>';
    return;
  }

  const data = await api(`/api/shows/${activeShow.id}/cues`);
  cuesCache = data.cues || [];
  console.log("Cues received from the server: ");
  console.log(data);

  // if (!cuesCache.length) {
  //   host.innerHTML = '<div class="empty">No cues added yet for this show.</div>';
  //   return;
  // }

  const act_ids = [...new Set(cuesCache.map(cue => cue.act_id))];
  const cueListDivs = Object.fromEntries(act_ids.map( (id) => [id, document.querySelector("#cueListPanelAct" + id + " #cueList")]));

  Object.values(cueListDivs).forEach(div => {
    if (div != null){
    // Clear previous cue lists to make room for refreshed cues.
    div.replaceChildren();
    }
  })

  cuesCache.forEach(cue => {
    host = cueListDivs[cue.act_id];
    if (host == null){
      return;
    }
    host.insertAdjacentHTML("beforeend", `
      <div class="cue-item">
        <div class="cue-item-main">
          <strong>#${cue.flash_number} ${escapeHtml(cue.source)}</strong><br />
          <span>${escapeHtml(toTimestamp(cue.start_sec))} · ${escapeHtml(cue.duration)}${/^\d+$/.test(String(cue.duration)) ? ' sec' : ''}</span><br />
          <span>${escapeHtml(cue.colors)}${cue.frequency ? ` · ${escapeHtml(cue.frequency)}` : ''}</span>
        </div>
        <div class="cue-item-actions">
          <button type="button" class="btn btn-secondary btn-sm edit-cue-btn" data-cue-id="${cue.id}">Edit</button>
          <button type="button" class="btn btn-secondary btn-sm delete-cue-btn" data-cue-id="${cue.id}">Delete</button>
        </div>
      </div>
    `);
  });

  // host.innerHTML = cuesCache
  //   .map(
  //     (cue) => `
  //     <div class="cue-item">
  //       <div class="cue-item-main">
  //         <strong>#${cue.flash_number} ${escapeHtml(cue.source)}</strong><br />
  //         <span>${escapeHtml(toTimestamp(cue.start_sec))} · ${escapeHtml(cue.duration)}${/^\d+$/.test(String(cue.duration)) ? ' sec' : ''}</span><br />
  //         <span>${escapeHtml(cue.colors)}${cue.frequency ? ` · ${escapeHtml(cue.frequency)}` : ''}</span>
  //       </div>
  //       <div class="cue-item-actions">
  //         <button type="button" class="btn btn-secondary btn-sm edit-cue-btn" data-cue-id="${cue.id}">Edit</button>
  //         <button type="button" class="btn btn-secondary btn-sm delete-cue-btn" data-cue-id="${cue.id}">Delete</button>
  //       </div>
  //     </div>
  //   `
  //   )
  //   .join('');

  bindCueListActions();
}

async function initShowPage() {
  const user = await requireAuth();
  if (!user) return;

  populateUserSidebar(user);
  setActiveNav('shows');
  bindLogout();

  document.getElementById('editShowBtn').addEventListener('click', () => {
    setText('showSuccess', '');
    setText('showError', '');
    setPageMode('edit-show');
  });

  document.getElementById('cancelShowEditBtn').addEventListener('click', () => {
    setText('showSuccess', '');
    setText('showError', '');
    setPageMode('view');
  });

  const showId = getShowIdFromUrl();
  if (showId) {
    try {
      await loadShow(showId);
    } catch (err) {
      setText('showError', err.message);
      setPageMode('create');
    }
  } else {
    setShowPageTitle(null);
    setPageMode('create');
  }

  const sidebar = document.querySelector("nav.sidebar");
  shows = JSON.parse(localStorage.getItem("shows"));
  sidebar.replaceChildren();
  sidebar.insertAdjacentHTML("beforeend",`<a class="item nav-link" href="dashboard.html">Dashboard</a>`); 
  shows.forEach((s) => {
      sidebar.insertAdjacentHTML("beforeend",`<a class="item nav-link ${s.id == showId ? "active" : ""}" href="show.html?id=${s.id}">${s.production_name}</a>`);
  });



  document.querySelector("#addActBtn").addEventListener("click", async (e) => {
    // e.target.disabled = true;
    // const actPanel = document.querySelector("#actPanel1");
    // const newInput = document.createElement('input');
    // const newSubmit = document.createElement('button');

    // newInput.type = 'text';
    // newInput.className = 'dynamic-input';
    // newInput.id = 'newActLabel';
    // newLabel = document.createElement('label');
    // newLabel.for = 'newActLabel';
    // newLabel.textContent = 'New act label';
    // newSubmit.type = 'button';
    // newSubmit.textContent = 'Create act';
    // newSubmit.classList.add('btn-secondary');
    // newSubmit.classList.add('btn');

    // actPanel.appendChild(newLabel);
    // actPanel.appendChild(newInput);
    // actPanel.appendChild(newSubmit);
    createAct();
  });

  // document.querySelector("#addCueBtn").addEventListener("click", () => {
  //   setDisplayCueForm(true);
  // });
}

async function initActs(showId){
  // First clear the div that holds acts to avoid duplicates.
  const actsList = document.querySelector("#actsList");
  actsList.replaceChildren();

  actData = await api(`/api/shows/${showId}/acts/`); // GET all acts associated with showId
  
  actData.forEach(act => {
    createActDiv(act);
  });
}

document.getElementById('showForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  setText('showSuccess', '');
  setText('showError', '');

  const payload = Object.fromEntries(new FormData(e.currentTarget).entries());

  try {
    if (activeShow?.id) {
      const data = await api(`/api/shows/${activeShow.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      activeShow = data.show;
      setText('showSuccess', 'Show details saved.');
      setPageMode('view');
    } else {
      const data = await api('/api/shows', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      activeShow = data.show; 
      setText('showSuccess', 'Show created. You can now add flash cues below.');
      const url = new URL(window.location.href);
      url.searchParams.set('id', String(activeShow.id));
      window.history.replaceState({}, '', url);
      setShowPageTitle(activeShow);
      setPageMode('view');
    }
    await loadShow(activeShow.id);
  } catch (err) {
    setText('showError', err.message);
  }
});

document.getElementById('submitShowBtn').addEventListener('click', async () => {
  setText('showSuccess', '');
  setText('showError', '');

  if (!activeShow?.id) {
    setText('showError', 'Save the show before submitting.');
    return;
  }

  try {
    const data = await api(`/api/shows/${activeShow.id}/submit`, { method: 'POST' });
    activeShow = data.show;
    setText('showSuccess', 'Submitted for review.');
    setPageMode('view');
    await loadShow(activeShow.id);
  } catch (err) {
    setText('showError', err.message);
  }
});

document.getElementById('cancelCueEditBtn').addEventListener('click', () => {
  clearCueEdit();
  setText('cueSuccess', '');
  setText('cueError', '');
});

document.getElementById('cueForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  setText('cueSuccess', '');
  setText('cueError', '');

  if (!activeShow?.id) {
    setText('cueError', 'Save the show before adding cues.');
    return;
  }

  if (pageMode !== 'view') {
    setText('cueError', 'Finish editing show details before working on cues.');
    return;
  }

  const validation = validateCueForm(form);
  if (!validation.ok) return;

  const payload = validation.payload;
  console.log("Cue validation payload")
  console.log(payload);
  try {
    if (editingCueId) {
      await api(`/api/shows/${activeShow.id}/cues/${editingCueId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      setText('cueSuccess', 'Cue updated.');
    } else {
      await api(`/api/shows/${activeShow.id}/cues`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      form.reset();
      setFrequencyValue('');
      setText('cueSuccess', 'Cue saved.');
    }
    clearCueEdit();
    await refreshCues();
  } catch (err) {
    setText('cueError', err.message);
  }
});

initShowPage();
