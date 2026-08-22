/**
 * Liv Café & Bistro — publish menus from Google Drive to the website.
 *
 * The chef drops a new PDF into the matching Drive folder, opens the web app,
 * and presses "Update Website". This script finds the newest PDF in each
 * folder and commits it to the site's repository, which triggers the normal
 * deploy.
 *
 * Filenames in Drive don't matter — each folder always publishes to a fixed
 * filename in the repo, so the links on the site can never break.
 *
 * Setup instructions: see README.md in this folder.
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

var REPO_OWNER = 'jacobsmit';
var REPO_NAME = 'liv-cafe-website';
var BRANCH = 'main';
var MENUS_DIR = 'public/menus';

// Paste each Drive folder's ID below. The ID is the long string in the folder's
// URL: https://drive.google.com/drive/folders/THIS_PART_HERE
var MENUS = [
  { label: 'Lunch Menu',  folderId: 'PASTE_LUNCH_FOLDER_ID',  target: 'LIV_Lunch_Menu.pdf' },
  { label: 'Brunch Menu', folderId: 'PASTE_BRUNCH_FOLDER_ID', target: 'LIV_Weekend_Brunch_Menu.pdf' },
  { label: 'Dinner Menu', folderId: 'PASTE_DINNER_FOLDER_ID', target: 'LIV_Dinner_Menu.pdf' },
  { label: 'Canapé Menu', folderId: 'PASTE_CANAPE_FOLDER_ID', target: 'LIV_Canape_Menu.pdf' }
];

// One folder holds up to MAX_SPECIAL_EVENTS PDFs at a time — the newest ones
// are what gets published. Drop in a new PDF to add an event; remove one to
// take it down.
var SPECIAL_EVENTS_FOLDER_ID = 'PASTE_SPECIAL_EVENTS_FOLDER_ID';
var EVENTS_DIR = 'public/events';
var MAX_SPECIAL_EVENTS = 3;

// ---------------------------------------------------------------------------
// Web app entry point
// ---------------------------------------------------------------------------

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Page')
    .setTitle('Liv Café — Publish Menus')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ---------------------------------------------------------------------------
// Drive helpers
// ---------------------------------------------------------------------------

/** Returns the most recently modified PDF in a folder, or null if there is none. */
function newestPdfIn(folderId) {
  var files = DriveApp.getFolderById(folderId).getFilesByType(MimeType.PDF);
  var newest = null;
  while (files.hasNext()) {
    var file = files.next();
    if (!newest || file.getLastUpdated() > newest.getLastUpdated()) {
      newest = file;
    }
  }
  return newest;
}

/** Returns up to `limit` PDFs in a folder, newest first. */
function newestPdfsIn(folderId, limit) {
  var files = DriveApp.getFolderById(folderId).getFilesByType(MimeType.PDF);
  var all = [];
  while (files.hasNext()) {
    all.push(files.next());
  }
  all.sort(function (a, b) {
    return b.getLastUpdated().getTime() - a.getLastUpdated().getTime();
  });
  return all.slice(0, limit);
}

/** Shown on the page so the chef can confirm the right file is about to publish. */
function getMenuStatus() {
  return MENUS.map(function (menu) {
    try {
      var file = newestPdfIn(menu.folderId);
      if (!file) {
        return { label: menu.label, ok: false, detail: 'No PDF in this folder yet' };
      }
      return {
        label: menu.label,
        ok: true,
        detail: file.getName() + ' · ' +
          Utilities.formatDate(file.getLastUpdated(), Session.getScriptTimeZone(), 'd MMM yyyy')
      };
    } catch (err) {
      return { label: menu.label, ok: false, detail: 'Folder not found — check the folder ID' };
    }
  });
}

// ---------------------------------------------------------------------------
// GitHub helpers
// ---------------------------------------------------------------------------

function githubRequest(path, options) {
  var token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) {
    throw new Error('GITHUB_TOKEN is not set in Script Properties.');
  }

  var params = options || {};
  params.muteHttpExceptions = true;
  params.headers = {
    Authorization: 'Bearer ' + token,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };

  var response = UrlFetchApp.fetch('https://api.github.com' + path, params);
  return { code: response.getResponseCode(), body: response.getContentText() };
}

/**
 * Git identifies file content by the SHA-1 of "blob <length>\0<content>".
 * Computing it here lets us detect an unchanged menu without downloading the
 * existing file from GitHub — so pressing the button twice won't create an
 * empty commit.
 */
function gitBlobSha(bytes) {
  var header = 'blob ' + bytes.length + '\u0000';
  var headerBytes = [];
  for (var i = 0; i < header.length; i++) {
    headerBytes.push(header.charCodeAt(i));
  }
  var digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_1,
    headerBytes.concat(bytes)
  );
  return digest.map(function (byte) {
    return ('0' + (byte & 0xFF).toString(16)).slice(-2);
  }).join('');
}

/** Maps filename -> blob SHA for everything currently in the menus folder. */
function listRepoMenus() {
  var response = githubRequest(
    '/repos/' + REPO_OWNER + '/' + REPO_NAME + '/contents/' + MENUS_DIR + '?ref=' + BRANCH,
    { method: 'get' }
  );

  if (response.code === 404) return {}; // folder doesn't exist yet
  if (response.code !== 200) {
    throw new Error('Could not read the repository (error ' + response.code + ').');
  }

  var map = {};
  JSON.parse(response.body).forEach(function (entry) {
    map[entry.name] = entry.sha;
  });
  return map;
}

/** Maps filename -> blob SHA for everything currently in public/events/. */
function listRepoEventFiles() {
  var response = githubRequest(
    '/repos/' + REPO_OWNER + '/' + REPO_NAME + '/contents/' + EVENTS_DIR + '?ref=' + BRANCH,
    { method: 'get' }
  );

  if (response.code === 404) return {}; // folder doesn't exist yet
  if (response.code !== 200) {
    throw new Error('Could not read the repository (error ' + response.code + ').');
  }

  var map = {};
  JSON.parse(response.body).forEach(function (entry) {
    map[entry.name] = entry.sha;
  });
  return map;
}

/** Reads the currently published events.json, or an empty list if there isn't one yet. */
function fetchPublishedEvents() {
  var response = githubRequest(
    '/repos/' + REPO_OWNER + '/' + REPO_NAME + '/contents/' + EVENTS_DIR + '/events.json?ref=' + BRANCH,
    { method: 'get' }
  );

  if (response.code === 404) return { sha: null, events: [] };
  if (response.code !== 200) {
    throw new Error('Could not read events.json (error ' + response.code + ').');
  }

  var body = JSON.parse(response.body);
  var content = Utilities.newBlob(Utilities.base64Decode(body.content)).getDataAsString();
  return { sha: body.sha, events: JSON.parse(content) };
}

// ---------------------------------------------------------------------------
// Main action
// ---------------------------------------------------------------------------

function publishMenus() {
  var existing;
  try {
    existing = listRepoMenus();
  } catch (err) {
    return [{ label: 'Website', status: 'error', detail: String(err.message || err) }];
  }

  return MENUS.map(function (menu) {
    try {
      var file = newestPdfIn(menu.folderId);
      if (!file) {
        return { label: menu.label, status: 'error', detail: 'No PDF found in this folder.' };
      }

      var bytes = file.getBlob().getBytes();
      var currentSha = existing[menu.target];

      if (currentSha && currentSha === gitBlobSha(bytes)) {
        return { label: menu.label, status: 'unchanged', detail: 'Already up to date' };
      }

      var payload = {
        message: 'Update ' + menu.label.toLowerCase() + ' from Drive',
        content: Utilities.base64Encode(bytes),
        branch: BRANCH
      };
      if (currentSha) {
        payload.sha = currentSha; // required to overwrite an existing file
      }

      var response = githubRequest(
        '/repos/' + REPO_OWNER + '/' + REPO_NAME + '/contents/' + MENUS_DIR + '/' + menu.target,
        { method: 'put', contentType: 'application/json', payload: JSON.stringify(payload) }
      );

      if (response.code === 200 || response.code === 201) {
        return { label: menu.label, status: 'updated', detail: file.getName() };
      }
      if (response.code === 401 || response.code === 403) {
        return {
          label: menu.label,
          status: 'error',
          detail: 'GitHub refused the access token — it has probably expired.'
        };
      }
      return { label: menu.label, status: 'error', detail: 'GitHub error ' + response.code };
    } catch (err) {
      return { label: menu.label, status: 'error', detail: String(err.message || err) };
    }
  });
}

// ---------------------------------------------------------------------------
// Special Events
// ---------------------------------------------------------------------------

/**
 * Shown on the page: whichever PDFs are currently in the Special Events
 * folder (newest first, up to MAX_SPECIAL_EVENTS), each paired with the
 * name/date last saved for that exact file — matched by Drive file ID, not
 * by position, so editing/removing one event never mixes up another's
 * details.
 */
function getSpecialEventStatus() {
  var byFileId = {};
  try {
    fetchPublishedEvents().events.forEach(function (e) { byFileId[e.fileId] = e; });
  } catch (err) {
    // If events.json can't be read, just fall back to blank fields below.
  }

  var files = newestPdfsIn(SPECIAL_EVENTS_FOLDER_ID, MAX_SPECIAL_EVENTS);
  return files.map(function (file) {
    var fileId = file.getId();
    var existing = byFileId[fileId];
    return {
      fileId: fileId,
      driveFileName: file.getName(),
      lastModified: Utilities.formatDate(file.getLastUpdated(), Session.getScriptTimeZone(), 'd MMM yyyy'),
      name: existing ? existing.name : '',
      date: existing ? existing.date : ''
    };
  });
}

/**
 * Publishes the given events (each {fileId, name, date}, in the order shown
 * on the page) to fixed paths event-1.pdf, event-2.pdf, etc., and rewrites
 * events.json to match. A slot that fails to publish is left out of
 * events.json rather than recorded with the wrong file, so the site never
 * shows a name/date next to the wrong flyer (or a broken link).
 *
 * `entries` comes from the page, so it isn't trusted for *which files* to
 * publish — only for the name/date text attached to each one. The set of
 * fileIds actually eligible to publish is re-derived here from the Drive
 * folder itself, the same way getSpecialEventStatus() does it, so this
 * can never be made to publish a file from outside that folder no matter
 * what a caller passes in.
 *
 * Slots left over from a previous, larger set of events are not deleted —
 * they just become unreferenced once events.json no longer points at them,
 * which is harmless.
 */
function publishSpecialEvents(entries) {
  var existingFiles;
  try {
    existingFiles = listRepoEventFiles();
  } catch (err) {
    return [{ label: 'Special Events', status: 'error', detail: String(err.message || err) }];
  }

  var allowedFileIds = {};
  newestPdfsIn(SPECIAL_EVENTS_FOLDER_ID, MAX_SPECIAL_EVENTS).forEach(function (file) {
    allowedFileIds[file.getId()] = true;
  });

  entries = entries
    .filter(function (entry) { return allowedFileIds[entry.fileId]; })
    .slice(0, MAX_SPECIAL_EVENTS);

  var results = [];
  var newEventsJson = [];

  entries.forEach(function (entry, i) {
    var label = entry.name || ('Special event ' + (i + 1));
    var target = 'event-' + (i + 1) + '.pdf';

    try {
      var file = DriveApp.getFileById(entry.fileId);
      var bytes = file.getBlob().getBytes();
      var currentSha = existingFiles[target];

      if (currentSha && currentSha === gitBlobSha(bytes)) {
        results.push({ label: label, status: 'unchanged', detail: 'Already up to date' });
        newEventsJson.push({ fileId: entry.fileId, name: entry.name, date: entry.date, file: '/events/' + target });
        return;
      }

      var payload = {
        message: 'Update special event ' + (i + 1) + ' from Drive',
        content: Utilities.base64Encode(bytes),
        branch: BRANCH
      };
      if (currentSha) {
        payload.sha = currentSha;
      }

      var response = githubRequest(
        '/repos/' + REPO_OWNER + '/' + REPO_NAME + '/contents/' + EVENTS_DIR + '/' + target,
        { method: 'put', contentType: 'application/json', payload: JSON.stringify(payload) }
      );

      if (response.code === 200 || response.code === 201) {
        results.push({ label: label, status: 'updated', detail: file.getName() });
        newEventsJson.push({ fileId: entry.fileId, name: entry.name, date: entry.date, file: '/events/' + target });
      } else if (response.code === 401 || response.code === 403) {
        results.push({ label: label, status: 'error', detail: 'GitHub refused the access token — it has probably expired.' });
      } else {
        results.push({ label: label, status: 'error', detail: 'GitHub error ' + response.code });
      }
    } catch (err) {
      results.push({ label: label, status: 'error', detail: String(err.message || err) });
    }
  });

  try {
    var current = fetchPublishedEvents();
    var newContent = JSON.stringify(newEventsJson, null, 2);
    var currentContent = JSON.stringify(current.events, null, 2);

    if (newContent !== currentContent) {
      var jsonPayload = {
        message: 'Update special events list',
        content: Utilities.base64Encode(Utilities.newBlob(newContent).getBytes()),
        branch: BRANCH
      };
      if (current.sha) {
        jsonPayload.sha = current.sha;
      }
      githubRequest(
        '/repos/' + REPO_OWNER + '/' + REPO_NAME + '/contents/' + EVENTS_DIR + '/events.json',
        { method: 'put', contentType: 'application/json', payload: JSON.stringify(jsonPayload) }
      );
    }
  } catch (err) {
    results.push({ label: 'Special events list', status: 'error', detail: String(err.message || err) });
  }

  return results;
}
