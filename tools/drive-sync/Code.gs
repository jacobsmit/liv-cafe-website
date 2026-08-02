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
