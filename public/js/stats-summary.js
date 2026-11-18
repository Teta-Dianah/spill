// Counting for the admin's anonymised statistics page (FR 7.3). These
// only work on plain values, so the Jest tests can check them directly.
//
// Spill's pilot is small, so a share of a handful of people could point
// to one person. A percentage or average is only shown once at least
// MIN_GROUP people or chats are in it.

var MIN_GROUP = 5;
var TOO_FEW = 'Too few to show yet';

// "62%", or TOO_FEW when there are fewer than MIN_GROUP in the group.
function percentText(part, total) {
  if (total < MIN_GROUP) return TOO_FEW;
  return Math.round((part / total) * 100) + '%';
}

// Whether a share meets a pilot goal (a percentage, such as 60):
// 'met', 'not met yet', or null while the group is too small to say.
function goalStatus(part, total, goalPercent) {
  if (total < MIN_GROUP) return null;
  return (part / total) * 100 >= goalPercent ? 'met' : 'not met yet';
}

// "+0.8", "-0.5" or "0.0" for an average change in mood, or TOO_FEW.
function changeText(total, count) {
  if (count < MIN_GROUP) return TOO_FEW;
  var average = Math.round((total / count) * 10) / 10;
  return (average > 0 ? '+' : '') + average.toFixed(1);
}

// accounts: [{ role, ageBand, firstTimeSeekingHelp }]. Only ordinary
// accounts count as people using Spill; staff accounts are left out.
function summariseAccounts(accounts) {
  var summary = { users: 0, youngerBand: 0, olderBand: 0, firstTimeYes: 0, firstTimeAnswered: 0 };
  accounts.forEach(function (account) {
    if (account.role !== 'user') return;
    summary.users++;
    if (account.ageBand === '16-17') summary.youngerBand++;
    if (account.ageBand === '18-25') summary.olderBand++;
    if (account.firstTimeSeekingHelp === true || account.firstTimeSeekingHelp === false) {
      summary.firstTimeAnswered++;
      if (account.firstTimeSeekingHelp) summary.firstTimeYes++;
    }
  });
  return summary;
}

// chatStats: [{ topic, moodBefore, moodAfter, rating, useAgain }], one for
// each ended chat whose user gave a mood after it.
function summariseChats(chatStats) {
  var summary = {
    chats: 0,
    better: 0,
    same: 0,
    worse: 0,
    changeTotal: 0,
    helpful: 0,
    ratingAnswered: 0,
    useAgainYes: 0,
    useAgainNo: 0,
    useAgainNotSure: 0,
    useAgainAnswered: 0,
    topics: {},
  };
  chatStats.forEach(function (chat) {
    if (typeof chat.moodBefore !== 'number' || typeof chat.moodAfter !== 'number') return;
    summary.chats++;
    var change = chat.moodAfter - chat.moodBefore;
    summary.changeTotal += change;
    if (change > 0) summary.better++;
    else if (change < 0) summary.worse++;
    else summary.same++;

    if (chat.rating === 'helpful' || chat.rating === 'not-helpful') {
      summary.ratingAnswered++;
      if (chat.rating === 'helpful') summary.helpful++;
    }

    if (chat.useAgain === 'yes') summary.useAgainYes++;
    if (chat.useAgain === 'no') summary.useAgainNo++;
    if (chat.useAgain === 'not-sure') summary.useAgainNotSure++;
    if (chat.useAgain === 'yes' || chat.useAgain === 'no' || chat.useAgain === 'not-sure') summary.useAgainAnswered++;

    if (chat.topic) summary.topics[chat.topic] = (summary.topics[chat.topic] || 0) + 1;
  });
  return summary;
}

// The moderator actions in the audit log that close a flag or report
// (FR 7.3), and the one that opens a case (BR 3).
var REVIEW_ACTIONS = ['dismiss', 'warn', 'suspend', 'reinstate', 'escalate'];

// tallies: [{ kind }], one per flag or report. auditEntries: [{ action }].
function summariseSafety(tallies, auditEntries) {
  var summary = { crisis: 0, contactSharing: 0, abusiveLanguage: 0, reports: 0, raised: 0, reviewed: 0, casesOpened: 0 };
  tallies.forEach(function (tally) {
    if (tally.kind === 'crisis') summary.crisis++;
    else if (tally.kind === 'contact-sharing') summary.contactSharing++;
    else if (tally.kind === 'abusive-language') summary.abusiveLanguage++;
    else if (tally.kind === 'report') summary.reports++;
    else return;
    summary.raised++;
  });
  auditEntries.forEach(function (entry) {
    if (REVIEW_ACTIONS.indexOf(entry.action) !== -1) summary.reviewed++;
    if (entry.action === 'open_case') summary.casesOpened++;
  });
  return summary;
}

// This guard only matters for our Jest tests, which run in Node.
if (typeof module !== 'undefined') {
  module.exports = {
    MIN_GROUP,
    TOO_FEW,
    percentText,
    goalStatus,
    changeText,
    summariseAccounts,
    summariseChats,
    summariseSafety,
  };
}
