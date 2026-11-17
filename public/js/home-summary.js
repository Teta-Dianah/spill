// Small helpers for the home pages (dashboard, listener dashboard and
// staff home): counting what is waiting and putting times and actions
// into plain words. They only work on plain values, never on Firestore,
// so the Jest tests can check them directly.

var MINUTE = 60 * 1000;
var HOUR = 60 * MINUTE;
var DAY = 24 * HOUR;

// "just now", "5 min ago", "3 hours ago", "yesterday", "4 days ago".
function timeAgo(millis, nowMillis) {
  if (!millis) return 'a while ago';
  var gap = nowMillis - millis;
  if (gap < MINUTE) return 'just now';
  if (gap < HOUR) return Math.floor(gap / MINUTE) + ' min ago';
  if (gap < DAY) {
    var hours = Math.floor(gap / HOUR);
    return hours === 1 ? '1 hour ago' : hours + ' hours ago';
  }
  var days = Math.floor(gap / DAY);
  if (days === 1) return 'yesterday';
  return days + ' days ago';
}

// How long something has been waiting, for the number boxes: "5 min",
// "3 hours", "2 days".
function waitingFor(millis, nowMillis) {
  var gap = Math.max(0, nowMillis - millis);
  if (gap < HOUR) return Math.max(1, Math.floor(gap / MINUTE)) + ' min';
  if (gap < DAY) {
    var hours = Math.floor(gap / HOUR);
    return hours === 1 ? '1 hour' : hours + ' hours';
  }
  var days = Math.floor(gap / DAY);
  return days === 1 ? '1 day' : days + ' days';
}

// The same words as the 1 to 5 scale on the check-in form.
var MOOD_WORDS = { 1: 'Rough', 2: 'Low', 3: 'Okay', 4: 'Good', 5: 'Great' };

function moodWord(score) {
  return MOOD_WORDS[score] || '';
}

// The same words as the topic choices on the chat request form.
var TOPIC_WORDS = {
  exams: 'Exams',
  family: 'Family',
  money: 'Money stress',
  loneliness: 'Loneliness',
  other: 'Something else',
};

function topicWord(topic) {
  return TOPIC_WORDS[topic] || 'Something else';
}

// entries: [{ score, time }] where time is in milliseconds.
// Gives back the numbers at the top of a user's dashboard.
function moodSummary(entries, nowMillis) {
  var now = new Date(nowMillis);
  var thisMonth = entries.filter(function (entry) {
    if (!entry.time) return false;
    var date = new Date(entry.time);
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  });

  var average = null;
  if (thisMonth.length > 0) {
    var total = thisMonth.reduce(function (sum, entry) {
      return sum + entry.score;
    }, 0);
    average = Math.round((total / thisMonth.length) * 10) / 10;
  }

  var latest = 0;
  entries.forEach(function (entry) {
    if (entry.time && entry.time > latest) latest = entry.time;
  });

  return {
    countThisMonth: thisMonth.length,
    averageThisMonth: average,
    lastCheckIn: latest || null,
    checkedInToday: latest > 0 && new Date(latest).toDateString() === now.toDateString(),
  };
}

// "Today", "Yesterday" or "3 days ago", for the last check-in box.
function lastCheckInText(lastMillis, nowMillis) {
  if (!lastMillis) return 'Not yet';
  var now = new Date(nowMillis);
  var last = new Date(lastMillis);
  if (last.toDateString() === now.toDateString()) return 'Today';
  var yesterday = new Date(nowMillis - DAY);
  if (last.toDateString() === yesterday.toDateString()) return 'Yesterday';
  var days = Math.max(2, Math.round((nowMillis - lastMillis) / DAY));
  return days + ' days ago';
}

// items: the open flags and reports, each with itemType ('flag' or
// 'report'), type and time (milliseconds). Gives back the numbers at the
// top of a moderator's home page.
function queueSummary(items) {
  var summary = { crisis: 0, otherFlags: 0, reports: 0, oldest: null };
  items.forEach(function (item) {
    if (item.itemType === 'report') summary.reports++;
    else if (item.type === 'crisis') summary.crisis++;
    else summary.otherFlags++;

    if (item.time && (summary.oldest === null || item.time < summary.oldest)) {
      summary.oldest = item.time;
    }
  });
  return summary;
}

// listeners: the listener records, each with status and available.
// Gives back the numbers at the top of an admin's home page.
function listenerSummary(listeners) {
  var summary = { waiting: 0, approved: 0, availableNow: 0 };
  listeners.forEach(function (listener) {
    if (listener.status === 'pending') summary.waiting++;
    if (listener.status === 'approved') {
      summary.approved++;
      if (listener.available === true) summary.availableNow++;
    }
  });
  return summary;
}

// Plain words for each action a moderator or admin can take. These are
// the action names written to the audit log.
var ACTION_WORDS = {
  open_case: 'Opened a case',
  dismiss: 'Dismissed an item',
  warn: 'Gave a warning',
  suspend: 'Suspended an account',
  reinstate: 'Reinstated an account',
  escalate: 'Escalated an item',
  approve_listener: 'Approved a listener',
  reject_listener: 'Turned down a listener application',
  update_listener_checks: 'Updated in-person checks',
  add_term: 'Added a screening term',
  edit_term: 'Edited a screening term',
  remove_term: 'Removed a screening term',
  reject_term_suggestion: 'Turned down a suggested term',
};

function describeAction(action) {
  return ACTION_WORDS[action] || 'Other action';
}

// The names of the three screening lists, as an admin sees them.
var LIST_NAMES = { crisis: 'Crisis list', abuse: 'Abusive language list', contact: 'Contact-sharing list' };

function listName(category) {
  return LIST_NAMES[category] || 'Screening list';
}

// Fills in one of the number boxes at the top of a home page. A box that
// needs attention (a crisis flag, a request waiting) gets a stronger
// colour, and its label always says what it is, so it never depends on
// colour alone.
function setStat(elementId, text, needsAttention) {
  var number = document.getElementById(elementId);
  if (!number) return;
  number.textContent = text;
  var box = number.closest('.stat');
  if (box) box.classList.toggle('stat-attention', needsAttention === true);
}

// One row in a home page list: a title, a line of detail under it, and
// a button on the right. Everything goes in with textContent, so nothing
// a person wrote can inject anything.
function makeItemRow(title, detail, buttonText, buttonHref) {
  var row = document.createElement('li');
  var text = document.createElement('div');
  text.className = 'item-text';

  var titleBox = document.createElement('span');
  titleBox.className = 'item-title';
  titleBox.textContent = title;
  text.appendChild(titleBox);

  if (detail) {
    var detailBox = document.createElement('span');
    detailBox.className = 'resource-meta';
    detailBox.textContent = detail;
    text.appendChild(detailBox);
  }
  row.appendChild(text);

  if (buttonText) {
    var button = document.createElement('a');
    button.className = 'button button-secondary';
    button.href = buttonHref;
    button.textContent = buttonText;
    row.appendChild(button);
  }
  return row;
}

// Shows a single line in a list, such as "Nothing waiting right now."
function showListNote(list, text) {
  list.innerHTML = '';
  var item = document.createElement('li');
  item.className = 'list-note';
  item.textContent = text;
  list.appendChild(item);
}

if (typeof window !== 'undefined') {
  window.setStat = setStat;
  window.makeItemRow = makeItemRow;
  window.showListNote = showListNote;
}

// This guard only matters for our Jest tests, which run in Node.
if (typeof module !== 'undefined') {
  module.exports = {
    timeAgo,
    waitingFor,
    topicWord,
    moodWord,
    moodSummary,
    lastCheckInText,
    queueSummary,
    listenerSummary,
    describeAction,
    listName,
  };
}
