// Moderator-suggested screening terms, with admin approval (FR 7.1).
//
// The loop: a flag reaches the moderator queue -> the moderator suggests
// a short phrase on the case page -> an admin approves or rejects it on
// the term-lists page -> an approved phrase joins the term list.
// Nothing is ever added to a list without an admin pressing Approve.
//
// A suggestion holds only the phrase, its category, an optional note,
// the moderator's own ID and a time. It never holds message text or
// anyone else's ID: the moderator types the phrase by hand.
//
// This one file serves both pages. On moderator-case.html it wires the
// "Suggest a term" form; on admin-terms.html it shows the pending list.
// firestore.rules is the real gatekeeper for all of it. Needs
// screening.js loaded first (and admin-terms.js on the admin page).

var SUGGESTION_AUDIT_ACTIONS = { approved: 'add_term', rejected: 'reject_term_suggestion' };

function showSuggestionMessage(elementId, text) {
  var box = document.getElementById(elementId);
  if (box) box.textContent = text;
}

// ---- Moderator side ----

// Saves one suggestion as "pending". Rejects with a message to show if
// the phrase, category or note isn't allowed (checkTermSuggestion).
function createTermSuggestion(category, phrase, note, moderatorUid) {
  var checked = checkTermSuggestion(category, phrase, note);
  if (checked.error) {
    var problem = new Error(checked.error);
    problem.isTermError = true;
    return Promise.reject(problem);
  }

  return firebase.firestore().collection('termSuggestions').add({
    phrase: checked.phrase,
    category: checked.category,
    note: checked.note,
    suggestedBy: moderatorUid,
    status: 'pending',
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

function wireSuggestForm(moderatorUid) {
  var form = document.getElementById('suggest-term-form');
  if (!form) return;
  form.hidden = false;

  form.addEventListener('submit', function (event) {
    event.preventDefault();

    createTermSuggestion(form.suggestCategory.value, form.suggestPhrase.value, form.suggestNote.value, moderatorUid)
      .then(function () {
        form.reset();
        showSuggestionMessage('suggest-term-message', 'Suggestion sent. An admin will review it.');
      })
      .catch(function (error) {
        if (error.isTermError) {
          showSuggestionMessage('suggest-term-message', error.message);
        } else {
          showSuggestionMessage('suggest-term-message', 'Could not send that suggestion. Please try again.');
          console.error(error);
        }
      });
  });
}

// ---- Admin side ----

// Approves or rejects one pending suggestion, as the signed-in admin.
// decision is 'approved' or 'rejected'.
//
// Approve: the phrase is added to its term list through applyTermChange
// (additions only, same checks as the admin's own "Add" form), the
// suggestion is marked approved, and one auditLog entry is written. All
// three go in one transaction, so none can happen without the others.
// Reject: the suggestion is marked rejected, with its own auditLog entry.
function reviewTermSuggestion(suggestionId, decision, adminUid) {
  var db = firebase.firestore();
  var suggestionRef = db.collection('termSuggestions').doc(suggestionId);
  var auditRef = db.collection('auditLog').doc();
  var now = firebase.firestore.FieldValue.serverTimestamp();

  return db.runTransaction(function (transaction) {
    return transaction.get(suggestionRef).then(function (suggestionDoc) {
      var suggestion = suggestionDoc.exists ? suggestionDoc.data() : null;
      if (!suggestion || suggestion.status !== 'pending') {
        var gone = new Error('That suggestion has already been reviewed.');
        gone.isTermError = true;
        throw gone;
      }

      var auditEntry = {
        actorId: adminUid,
        action: SUGGESTION_AUDIT_ACTIONS[decision],
        suggestionId: suggestionId,
        suggestedBy: suggestion.suggestedBy,
        oldTerm: null,
        newTerm: suggestion.phrase,
        createdAt: now,
      };
      var reviewed = { status: decision, reviewedBy: adminUid, reviewedAt: now, auditLogId: auditRef.id };

      if (decision === 'rejected') {
        auditEntry.itemType = 'termSuggestion';
        auditEntry.itemId = suggestionId;
        transaction.set(auditRef, auditEntry);
        transaction.update(suggestionRef, reviewed);
        return null;
      }

      var listRef = db.collection('termLists').doc(suggestion.category);
      return transaction.get(listRef).then(function (listDoc) {
        var currentTerms = listDoc.exists ? listDoc.data().terms : [];
        var result = applyTermChange(suggestion.category, currentTerms, 'add', null, suggestion.phrase);
        if (result.error) {
          var termError = new Error(result.error);
          termError.isTermError = true;
          throw termError;
        }

        // The same kind of entry the admin's own "Add" form writes, so
        // the term list's rule accepts it, plus which suggestion it
        // came from.
        auditEntry.itemType = 'termList';
        auditEntry.itemId = suggestion.category;
        transaction.set(auditRef, auditEntry);
        transaction.set(listRef, {
          terms: result.terms,
          lastAuditLogId: auditRef.id,
          updatedBy: adminUid,
          updatedAt: now,
        });
        transaction.update(suggestionRef, reviewed);
        return null;
      });
    });
  });
}

// Phrase, note and warnings are shown with textContent, never
// innerHTML, so a suggestion can't inject anything into the page.
function renderSuggestionRow(suggestion, adminUid) {
  var row = document.createElement('li');

  var title = document.createElement('p');
  var phrase = document.createElement('strong');
  phrase.textContent = suggestion.phrase;
  title.appendChild(phrase);
  title.appendChild(document.createTextNode(' — ' + (suggestion.category === 'crisis' ? 'Crisis' : 'Abusive language')));
  row.appendChild(title);

  if (suggestion.note) {
    var note = document.createElement('p');
    note.textContent = 'Moderator note: ' + suggestion.note;
    row.appendChild(note);
  }

  termSuggestionWarnings(suggestion.phrase).forEach(function (warning) {
    var line = document.createElement('p');
    line.className = 'suggestion-warning';
    line.textContent = 'Check before approving: ' + warning;
    row.appendChild(line);
  });

  [
    { decision: 'approved', label: 'Approve', done: 'Suggestion approved and added to the list.' },
    { decision: 'rejected', label: 'Reject', done: 'Suggestion rejected.' },
  ].forEach(function (choice) {
    var button = document.createElement('button');
    button.type = 'button';
    button.textContent = choice.label;
    button.style.width = 'auto';
    button.addEventListener('click', function () {
      reviewTermSuggestion(suggestion.id, choice.decision, adminUid)
        .then(function () {
          showSuggestionMessage('suggestions-message', choice.done);
          renderPendingSuggestions(adminUid);
          renderTermList(suggestion.category, adminUid);
        })
        .catch(function (error) {
          if (error.isTermError) {
            showSuggestionMessage('suggestions-message', error.message);
          } else {
            showSuggestionMessage('suggestions-message', 'Could not save that decision. Please try again.');
            console.error(error);
          }
        });
    });
    row.appendChild(button);
  });

  return row;
}

function renderPendingSuggestions(adminUid) {
  var list = document.getElementById('pending-suggestions-list');
  if (!list) return;

  firebase
    .firestore()
    .collection('termSuggestions')
    .where('status', '==', 'pending')
    .get()
    .then(function (snapshot) {
      list.innerHTML = '';

      if (snapshot.empty) {
        var empty = document.createElement('li');
        empty.textContent = 'No suggestions waiting.';
        list.appendChild(empty);
        return;
      }

      snapshot.forEach(function (docSnap) {
        var suggestion = docSnap.data();
        suggestion.id = docSnap.id;
        list.appendChild(renderSuggestionRow(suggestion, adminUid));
      });
    })
    .catch(function (error) {
      showSuggestionMessage('suggestions-message', 'Could not load the suggestions.');
      console.error(error);
    });
}

// ---- Start ----

// Checking the role here only decides what to show. firestore.rules is
// what actually stops anyone else reading or writing suggestions.
document.addEventListener('DOMContentLoaded', function () {
  firebase.auth().onAuthStateChanged(function (user) {
    if (!user) return;

    firebase
      .firestore()
      .collection('accounts')
      .doc(user.uid)
      .get()
      .then(function (accountDoc) {
        var role = accountDoc.exists ? accountDoc.data().role : null;
        if (role === 'moderator') wireSuggestForm(user.uid);
        if (role === 'admin') renderPendingSuggestions(user.uid);
      });
  });
});
