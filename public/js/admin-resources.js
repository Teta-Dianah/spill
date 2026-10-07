// Lets an admin add and remove resources (FR 7.2).
// Firestore Security Rules are the real gatekeeper here — this page just
// gives an admin a form to use. A non-admin trying this will have their
// write rejected by firestore.rules.

function showAdminMessage(text) {
  var box = document.getElementById('admin-message');
  if (box) box.textContent = text;
}

function deleteResource(id) {
  firebase
    .firestore()
    .collection('resources')
    .doc(id)
    .delete()
    .then(function () {
      loadAdminResources();
    })
    .catch(function (error) {
      showAdminMessage('Could not remove that resource.');
      console.error(error);
    });
}

function loadAdminResources() {
  var list = document.getElementById('admin-resources-list');
  if (!list) return;

  firebase
    .firestore()
    .collection('resources')
    .orderBy('name')
    .get()
    .then(function (snapshot) {
      list.innerHTML = '';
      snapshot.forEach(function (docSnap) {
        var data = docSnap.data();

        var row = document.createElement('li');
        var label = document.createElement('span');
        label.textContent = data.name + ' (' + data.contact + ')';

        var removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.textContent = 'Remove';
        removeButton.addEventListener('click', function () {
          deleteResource(docSnap.id);
        });

        row.appendChild(label);
        row.appendChild(removeButton);
        list.appendChild(row);
      });
    });
}

function addResource(event) {
  event.preventDefault();
  var form = event.target;
  var name = form.name.value.trim();
  var contact = form.contact.value.trim();
  var category = form.category.value;
  var lastVerified = form.lastVerified.value;

  if (!name || !contact || !lastVerified) {
    showAdminMessage('Please fill in all fields.');
    return;
  }

  firebase
    .firestore()
    .collection('resources')
    .add({ name: name, contact: contact, category: category, lastVerified: lastVerified })
    .then(function () {
      form.reset();
      showAdminMessage('Resource added.');
      loadAdminResources();
    })
    .catch(function (error) {
      showAdminMessage('Could not save that resource. You may not have admin access.');
      console.error(error);
    });
}

// Checking the role here is just a friendlier message for non-admins —
// firestore.rules is what actually blocks a non-admin's write either way.
function checkAdminAndStart() {
  var form = document.getElementById('add-resource-form');

  firebase.auth().onAuthStateChanged(function (user) {
    if (!user) {
      showAdminMessage('Please sign in as an admin to manage resources.');
      return;
    }

    firebase
      .firestore()
      .collection('accounts')
      .doc(user.uid)
      .get()
      .then(function (accountDoc) {
        var role = accountDoc.exists ? accountDoc.data().role : null;
        if (role !== 'admin') {
          showAdminMessage('You do not have access to this page.');
          return;
        }

        if (form) form.addEventListener('submit', addResource);
        loadAdminResources();
      });
  });
}

document.addEventListener('DOMContentLoaded', checkAdminAndStart);
