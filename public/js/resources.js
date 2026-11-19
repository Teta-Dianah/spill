// Shows the public resources list on index.html (FR 2.1, FR 2.2, FR 2.3).
// Anyone can see this, signed in or not. The page already shows the
// built-in helplines while this loads, so nobody waits on a blank list.

function escapeHtml(text) {
  var div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Shows the helplines built into Spill (crisis-card.js), for when the
// admin-managed list is empty or can't be loaded. A visitor should never
// land on an empty helplines card. note is a short line shown above the
// list, or '' for none.
function showBuiltInHelplines(list, note) {
  list.innerHTML = '';

  if (note) {
    var noteItem = document.createElement('li');
    noteItem.className = 'resource-note';
    noteItem.textContent = note;
    list.appendChild(noteItem);
  }

  var helplines = window.BUILT_IN_HELPLINES || [];
  helplines.forEach(function (line) {
    var item = document.createElement('li');
    item.className = 'resource-item';

    var name = document.createElement('span');
    name.className = 'resource-name';
    name.textContent = line.name;

    var number = document.createElement('a');
    number.className = 'resource-contact';
    number.href = 'tel:' + line.number.replace(/ /g, '');
    number.textContent = line.number;

    item.appendChild(name);
    item.appendChild(number);
    list.appendChild(item);
  });
}

function loadResources() {
  var list = document.getElementById('resources-list');
  if (!list) return;

  firebase
    .firestore()
    .collection('resources')
    .orderBy('name')
    .get()
    .then(function (snapshot) {
      list.innerHTML = '';

      if (snapshot.empty) {
        showBuiltInHelplines(list, '');
        return;
      }

      snapshot.forEach(function (docSnap) {
        var data = docSnap.data();
        var item = document.createElement('li');
        item.className = 'resource-item';
        item.innerHTML =
          '<span class="resource-name">' + escapeHtml(data.name) + '</span>' +
          '<span class="resource-contact">' + escapeHtml(data.contact) + '</span>' +
          '<span class="resource-meta">' +
          escapeHtml(data.category || '') +
          ' &middot; last verified ' +
          escapeHtml(data.lastVerified || 'unknown') +
          '</span>';
        list.appendChild(item);
      });
    })
    .catch(function (error) {
      showBuiltInHelplines(list, "The full list couldn't load right now. These lines are always available.");
      console.error('Failed to load resources', error);
    });
}

document.addEventListener('DOMContentLoaded', loadResources);
