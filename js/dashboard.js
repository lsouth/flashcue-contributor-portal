let shows = [];

async function initDashboard() {
  const user = await requireAuth();
  if (!user) return;

  populateUserSidebar(user);
  setActiveNav('dashboard');
  bindLogout();
  setText('welcomeTitle', `Welcome back, ${user.name.split(' ')[0]}`);

  try {
    const data = await api('/api/shows');
    console.log("In dashboard.js, GET /api/shows");
    console.log(data);
    shows = data.shows || [];
    renderDashboard();
    addFileUploadModal();
    localStorage.setItem("shows", JSON.stringify(shows));
  } catch (err) {
    document.getElementById('dashboardShowRows').innerHTML =
      `<div class="empty">Could not load shows: ${escapeHtml(err.message)}</div>`;
  }
}

function renderDashboard() {
  const totalShows = shows.length;
  const totalCues = shows.reduce((n, s) => n + (parseInt(s.cue_count) || 0), 0);
  const reviewCount = shows.filter((s) => s.status === 'review').length;
  const draftCount = shows.filter((s) => s.status === 'draft').length;

  setText('kpiShows', String(totalShows));
  setText('kpiCues', String(totalCues));
  setText('kpiReview', String(reviewCount));
  setText('kpiDraft', String(draftCount));

  const host = document.getElementById('dashboardShowRows');
  if (!shows.length) {
    host.innerHTML = '<div class="empty">No shows yet. Click "+ New show" to start.</div>';
    return;
  }

  const sidebar = document.querySelector("nav.sidebar");
  sidebar.replaceChildren();
  sidebar.insertAdjacentHTML("beforeend",`<a class="item nav-link" href="dashboard.html">Dashboard</a>`);
  shows.forEach((s) => {
    sidebar.insertAdjacentHTML("beforeend",`<a class="item nav-link" href="show.html?id=${s.id}">${s.production_name}</a>`);
    console.log("Adding " + s.production_name + " to sidebar.");
  });

  const header = `
    <div class="show-row show-row-header" role="row">
      <div class="col-title" role="columnheader">Show title</div>
      <div class="col-cues" role="columnheader">Cues added</div>
      <div class="col-date" role="columnheader">Date edited</div>
      <div class="col-status" role="columnheader">Status</div>
      <div class="col-actions" role="columnheader"><span class="sr-only">Actions</span></div>
    </div>
  `;

  const rows = shows
    .map(
      (show) => `
      <div class="show-row" role="row">
        <div class="col-title">
          <a class="title show-title-link" href="show.html?id=${show.id}">${escapeHtml(show.production_name || 'Untitled show')}</a>
          <div class="venue">${escapeHtml(show.venue || 'Venue not set')}</div>
        </div>
        <div class="col-cues meta">${show.cue_count || 0}</div>
        <div class="col-date meta">${new Date(show.updated_at).toLocaleDateString()}</div>
        <div class="col-status"><span class="badge ${escapeHtml(show.status)}">${escapeHtml(show.status)}</span></div>
        <div class="col-actions">
          <a class="btn btn-secondary" href="show.html?id=${show.id}">Edit</a>
          <a class="btn btn-warning delete-show-btn" data-id="${show.id}">Delete</a>
        </div>
      </div>
    `
    )
    .join('');

  host.innerHTML = header + rows;

  document.querySelectorAll('.delete-show-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const showId = btn.dataset.id;
      console.log("dashboard.js deleting show: " + showId)
      const show = shows.find((s) => s.id === showId);
      if (!show) return;

      const label = show.production_name;
      if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) return;

      setText('showSuccess', '');
      setText('showError', '');

      try {
        await api(`/api/shows/${showId}/`, { method: 'DELETE' });
        setText('showSuccess', 'Show deleted.');
        host.innerHTML = '';
        shows = shows.filter(s => s.id != showId);
        renderDashboard();
      } catch (err) {
        setText('showError', err.message);
      }
    });
  });
}

function extractTimestamp(val){
  // Removes unecessary text from timestamp string in data collection spreadsheet.
  const hmsRegex = /\b\d{1,2}:\d{2}:\d{2}\b/g;
  
  // Extract all matches from the string
  let matches = val.match(hmsRegex);

  if (matches == null){
    const msRegex = /\b\d{1,2}:\d{2}\b/g
    matches = val.match(msRegex);
  }
  return matches;
}

function parseDuration(text){
  if (text == null){
    return -1;
  }
  let minutes = 0;
  let seconds = 0;
  const minuteRegex = /\b\d+\s*(?:m|min|minute|minutes)\b/;
  const secondRegex = /\b\d+\s*(?:s|sec|second|seconds)\b/;

  minMatch = text.match(minuteRegex);
  secMatch = text.match(secondRegex);

  if (minMatch !== null){
    minutes = parseInt(minMatch[0].split(" ")[0]);
  }
  if (secMatch !== null){
    seconds = parseInt(secMatch[0].split(" ")[0]);
  }
  return (60 * minutes) + seconds;
}

function addFileUploadModal(){
  const modal = document.querySelector("#uploadModal");
  const fileInput = document.querySelector("#uploadModal #fileChooser");
  const submitBtn = document.querySelector("#uploadModal #submitFile");

  fileInput.addEventListener("change", (e) => {
    const file = event.target.files[0];
    const reader = new FileReader();
    console.log(reader);
    reader.onload = async function(e) {
        const data = new Uint8Array(e.target.result);
        
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        // View the resulting structured data array in your console
        console.log(jsonData);
        
        const company = jsonData[1]["PRODUCTION INFORMATION"];
        const show_title = jsonData[1].__EMPTY_1 ?? "";
        const opening = jsonData[1].__EMPTY_5 ?? "";
        console.log("Show information from Excel file: " + company + " " + show_title);

        const showData = {
          "production_name": show_title,
          "theater_company": company,
          "date_opening": opening
        }

        // Make PUSH show API call here to create new show...
        const result = await api('/api/shows', {
          method: 'POST',
          body: JSON.stringify(showData),
        });

        const activeShow = result.show; 
        console.log("dashboard.js:184 Received the following after POST show/");
        console.log(result.show);

        flash_data = jsonData.slice(10);
        console.log(flash_data);

        const parsedFlashes = [];

        flash_data.forEach((row) => {
            let start_time = extractTimestamp(row.__EMPTY);
            if (start_time === null){
              // Skip any rows that do not have a timestamp (indicates empty row or row that contains metainformation)
              return;
            }
            let duration = parseDuration(row.__EMPTY_1);
            const colors = row.__EMPTY_2 ?? "";
            const flash_description = row.__EMPTY_4 ?? "";
            const scene_description = row.__EMPTY_6 ?? "";
            const warning_sign = row.__EMPTY_5 ?? "";
            console.log("Flash: " + start_time + " " + duration + " " + colors + " " + flash_description);
            // parsedFlashes.push({})
            // Make PUSH cue API call here to create new cue associated with show...
        });
    };
    reader.readAsArrayBuffer(file);
  });
}

initDashboard();
