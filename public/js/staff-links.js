// Works out which staff pages to link to on the dashboard, from the
// account's role and whether the person is an approved listener.
// These links only save typing the address. Access is still decided by
// firestore.rules, so showing or hiding a link protects nothing by itself.
// This file has no Firebase in it, so it is easy to unit test on its own.

var LISTENER_LINKS = [
  { href: 'listener-dashboard.html', label: 'Listener dashboard' },
  { href: 'listener-training.html', label: 'Listener training' },
];

var MODERATOR_LINKS = [
  { href: 'moderator-queue.html', label: 'Moderator queue' },
];

var ADMIN_LINKS = [
  { href: 'admin-listeners.html', label: 'Listener applications' },
  { href: 'admin-terms.html', label: 'Screening terms' },
  { href: 'admin-resources.html', label: 'Helplines and clinics' },
];

// role is the account's role ('user', 'moderator' or 'admin').
// isApprovedListener is true once an admin has approved the person's
// listener application. Someone who has only applied gets no links.
function staffLinksFor(role, isApprovedListener) {
  var links = [];
  if (isApprovedListener) links = links.concat(LISTENER_LINKS);
  if (role === 'moderator') links = links.concat(MODERATOR_LINKS);
  if (role === 'admin') links = links.concat(ADMIN_LINKS);
  return links;
}

// This guard only matters for our Jest tests, which run in Node.
if (typeof module !== 'undefined') {
  module.exports = { staffLinksFor };
}
