// Lets an admin add, edit and remove extra screening terms (FR 7.1).
// Firestore Security Rules are the real gatekeeper here — this page just
// gives an admin a form to use. Needs screening.js loaded first (for
// applyTermChange, planStarterTermImport and DEFAULT_TERM_LISTS).
//
// Every change writes the new list and its auditLog entry together, in
// one transaction (FR 6.9). firestore.rules refuses a list change that
// doesn't come with its own new audit entry.

var TERM_CATEGORIES = ['crisis', 'abuse', 'contact'];

var AUDIT_ACTIONS = { add: 'add_term', edit: 'edit_term', remove: 'remove_term' };

function showAdminTermsMessage(text) {
  var box = document.getElementById('admin-terms-message');
  if (box) box.textContent = text;
}

// Reads the list, applies the change, then writes the list and the
// audit entry together. Reading inside the transaction means two admins
// editing at once can't overwrite each other's changes.
function saveTermChange(category, action, oldTerm, newTerm, adminUid) {
  var db = firebase.firestore();
  var listRef = db.collection('termLists').doc(category);
  var auditRef = db.collection('auditLog').doc();

  return db.runTransaction(function (transaction) {
    return transaction.get(listRef).then(function (docSnap) {
      var currentTerms = docSnap.exists ? docSnap.data().terms : [];
      var result = applyTermChange(category, currentTerms, action, oldTerm, newTerm);
      if (result.error) {
        var termError = new Error(result.error);
        termError.isTermError = true;
        throw termError;
      }

      transaction.set(listRef, {
        terms: result.terms,
        lastAuditLogId: auditRef.id,
        updatedBy: adminUid,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      transaction.set(auditRef, {
        actorId: adminUid,
        action: AUDIT_ACTIONS[action],
        itemType: 'termList',
        itemId: category,
        oldTerm: oldTerm || null,
        newTerm: action === 'remove' ? null : cleanTerm(newTerm),
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    });
  });
}

// Where the starter terms live. The same file "npm run seed:terms" uses
// for the emulators.
var STARTER_TERMS_URL = 'data/term-lists-seed.json';

// Adds the starter terms to one list (FR 7.1), as the signed-in admin.
// Only ever adds: planStarterTermImport skips anything already listed.
// The list and one auditLog entry per term added are written together,
// in one transaction (FR 6.9), the same way a single change is.
// Resolves to { added: howMany, skipped: howMany }.
function importStarterTermsFor(category, starterTerms, adminUid) {
  var db = firebase.firestore();
  var listRef = db.collection('termLists').doc(category);

  return db.runTransaction(function (transaction) {
    return transaction.get(listRef).then(function (docSnap) {
      var currentTerms = docSnap.exists ? docSnap.data().terms : [];
      var plan = planStarterTermImport(category, currentTerms, starterTerms);
      if (plan.added.length === 0) {
        return { added: 0, skipped: plan.skipped };
      }

      var lastAuditRef = null;
      plan.added.forEach(function (term) {
        lastAuditRef = db.collection('auditLog').doc();
        transaction.set(lastAuditRef, {
          actorId: adminUid,
          action: AUDIT_ACTIONS.add,
          itemType: 'termList',
          itemId: category,
          oldTerm: null,
          newTerm: term,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
      });
      transaction.set(listRef, {
        terms: plan.terms,
        lastAuditLogId: lastAuditRef.id,
        updatedBy: adminUid,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

      return { added: plan.added.length, skipped: plan.skipped };
    });
  });
}

// Loads the starter terms and imports them into the three lists, one
// after another. Resolves to the totals for the message on the page.
function importStarterTerms(adminUid) {
  var totals = { added: 0, skipped: 0 };

  return fetch(STARTER_TERMS_URL)
    .then(function (response) {
      if (!response.ok) throw new Error('Could not load the starter terms.');
      return response.json();
    })
    .then(function (starter) {
      // One list at a time, so a problem with one is easy to see.
      return TERM_CATEGORIES.reduce(function (previous, category) {
        return previous
          .then(function () {
            return importStarterTermsFor(category, starter[category], adminUid);
          })
          .then(function (result) {
            totals.added += result.added;
            totals.skipped += result.skipped;
          });
      }, Promise.resolve());
    })
    .then(function () {
      return totals;
    });
}

function wireImportButton(adminUid) {
  var button = document.getElementById('import-starter-terms-button');
  if (!button) return;

  button.addEventListener('click', function () {
    button.disabled = true;
    showAdminTermsMessage('Importing starter terms...');

    importStarterTerms(adminUid)
      .then(function (totals) {
        showAdminTermsMessage(
          totals.added + ' starter term(s) added, ' + totals.skipped + ' skipped (already on a list).'
        );
      })
      .catch(function (error) {
        showAdminTermsMessage('Could not import the starter terms. Please try again.');
        console.error(error);
      })
      .then(function () {
        button.disabled = false;
        TERM_CATEGORIES.forEach(function (category) {
          renderTermList(category, adminUid);
        });
      });
  });
}

// Shows applyTermChange's own message for problems it found (term too
// short, already listed, list full), and a general one for anything
// else, such as a write the Rules refused.
function handleSaveError(error) {
  if (error.isTermError) {
    showAdminTermsMessage(error.message);
  } else {
    showAdminTermsMessage('Could not save that change. Please try again.');
    console.error(error);
  }
}

// Terms are always shown with textContent, never innerHTML, so a term
// can't inject anything into the page.
function renderTermRow(category, term, adminUid) {
  var row = document.createElement('li');

  var input = document.createElement('input');
  input.type = 'text';
  input.value = term;
  input.maxLength = MAX_TERM_LENGTH;
  input.setAttribute('aria-label', 'Edit term');

  var saveButton = document.createElement('button');
  saveButton.type = 'button';
  saveButton.textContent = 'Save';
  saveButton.addEventListener('click', function () {
    saveTermChange(category, 'edit', term, input.value, adminUid)
      .then(function () {
        showAdminTermsMessage('Term updated.');
        renderTermList(category, adminUid);
      })
      .catch(handleSaveError);
  });

  var removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.textContent = 'Remove';
  removeButton.addEventListener('click', function () {
    saveTermChange(category, 'remove', term, null, adminUid)
      .then(function () {
        showAdminTermsMessage('Term removed.');
        renderTermList(category, adminUid);
      })
      .catch(handleSaveError);
  });

  row.appendChild(input);
  row.appendChild(saveButton);
  row.appendChild(removeButton);
  return row;
}

function renderTermList(category, adminUid) {
  var list = document.getElementById(category + '-terms-list');
  if (!list) return;

  firebase
    .firestore()
    .collection('termLists')
    .doc(category)
    .get()
    .then(function (docSnap) {
      var terms = cleanTermList(docSnap.exists ? docSnap.data().terms : []);
      list.innerHTML = '';

      if (terms.length === 0) {
        var empty = document.createElement('li');
        empty.textContent = 'No extra terms yet.';
        list.appendChild(empty);
        return;
      }

      terms.forEach(function (term) {
        list.appendChild(renderTermRow(category, term, adminUid));
      });
    })
    .catch(function (error) {
      showAdminTermsMessage('Could not load the term lists.');
      console.error(error);
    });
}

// Shows the built-in terms, which are always on and can't be changed
// here, so an admin knows not to add them again.
function renderBuiltInTerms(category) {
  var box = document.getElementById(category + '-built-in');
  if (!box) return;
  var terms = DEFAULT_TERM_LISTS[category];
  box.textContent = terms.length ? 'Always on: ' + terms.join(', ') : '';
}

function wireAddForm(category, adminUid) {
  var form = document.getElementById(category + '-add-form');
  if (!form) return;

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    saveTermChange(category, 'add', null, form.term.value, adminUid)
      .then(function () {
        form.reset();
        showAdminTermsMessage('Term added.');
        renderTermList(category, adminUid);
      })
      .catch(handleSaveError);
  });
}

// Checking the role here is just a friendlier message for non-admins —
// firestore.rules is what actually blocks a non-admin's write either way.
function checkAdminAndStart() {
  firebase.auth().onAuthStateChanged(function (user) {
    if (!user) {
      window.location.href = 'signin.html';
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
          showAdminTermsMessage("You don't have access to this page.");
          return;
        }

        var content = document.getElementById('admin-terms-content');
        if (content) content.hidden = false;

        wireImportButton(user.uid);
        TERM_CATEGORIES.forEach(function (category) {
          renderBuiltInTerms(category);
          wireAddForm(category, user.uid);
          renderTermList(category, user.uid);
        });
      });
  });
}

document.addEventListener('DOMContentLoaded', checkAdminAndStart);
