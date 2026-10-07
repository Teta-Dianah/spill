// Shows the public resources list on index.html (FR 2.1, FR 2.2, FR 2.3).
// Anyone can see this, signed in or not.

function escapeHtml(text) {
  var div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
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
        list.innerHTML = '<li>No resources added yet.</li>';
        return;
      }

      snapshot.forEach(function (docSnap) {
        var data = docSnap.data();
        var item = document.createElement('li');
        item.className = 'resource-item';
        item.innerHTML =
          '<strong>' + escapeHtml(data.name) + '</strong><br>' +
          escapeHtml(data.contact) +
          '<br><span class="resource-meta">' +
          escapeHtml(data.category || '') +
          ' &middot; last verified ' +
          escapeHtml(data.lastVerified || 'unknown') +
          '</span>';
        list.appendChild(item);
      });
    })
    .catch(function (error) {
      list.innerHTML = '<li>Could not load resources right now. Please try again later.</li>';
      console.error('Failed to load resources', error);
    });
}

document.addEventListener('DOMContentLoaded', loadResources);
