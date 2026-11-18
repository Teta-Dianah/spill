// Checks on the pages themselves: things every page must have, whatever
// it looks like. These read the HTML and script files as text.
const fs = require('fs');
const path = require('path');

const PUBLIC = path.join(__dirname, '../../public');
const PAGES = fs.readdirSync(PUBLIC).filter((file) => file.endsWith('.html'));
const read = (file) => fs.readFileSync(path.join(PUBLIC, file), 'utf8');

describe('every page', () => {
  test('there are pages to check', () => {
    expect(PAGES.length).toBeGreaterThanOrEqual(14);
  });

  test.each(PAGES)('%s loads the "Need help now" button (NFR 5)', (page) => {
    expect(read(page)).toMatch(/<script src="js\/crisis-card\.js"><\/script>/);
  });

  test.each(PAGES)('%s has the top bar with the Spill name', (page) => {
    expect(read(page)).toMatch(/<div class="topbar">\s*<a class="brand" href="[a-z-]+\.html">Spill<\/a>/);
  });

  test.each(PAGES)('%s works on a phone: it sets the viewport and the stylesheet', (page) => {
    const html = read(page);
    expect(html).toMatch(/<meta name="viewport" content="width=device-width, initial-scale=1\.0">/);
    expect(html).toMatch(/<link rel="stylesheet" href="css\/styles\.css">/);
  });

  test.each(PAGES)('%s keeps its look in the stylesheet, with no inline styles', (page) => {
    expect(read(page)).not.toMatch(/\sstyle="/);
  });

  test.each(PAGES)('%s asks no other site for fonts or styles', (page) => {
    const html = read(page);
    expect(html).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com/);
    expect(html).not.toMatch(/<link[^>]+rel="stylesheet"[^>]+href="https?:/);
  });

  test.each(PAGES)('%s has exactly one main heading', (page) => {
    expect((read(page).match(/<h1[\s>]/g) || []).length).toBe(1);
  });
});

describe('the stylesheet', () => {
  const css = read('css/styles.css');

  test('the fonts are served from inside the app', () => {
    expect(css).not.toMatch(/https?:\/\//);
    const fontFiles = (css.match(/url\('\.\.\/fonts\/([^']+)'\)/g) || []).map((url) => url.slice(14, -2));
    expect(fontFiles.length).toBe(2);
    fontFiles.forEach((file) => {
      expect(fs.existsSync(path.join(PUBLIC, 'fonts', file))).toBe(true);
    });
  });

  test('the font licence is kept next to the fonts', () => {
    expect(fs.existsSync(path.join(PUBLIC, 'fonts', 'OFL.txt'))).toBe(true);
  });

  test('anything marked hidden stays hidden, whatever display a rule gives it', () => {
    expect(css).toMatch(/\[hidden\]\s*\{\s*display:\s*none\s*!important;/);
  });

  test('"Need help now" sits in a solid strip, so it never lies on top of text', () => {
    const strip = (css.match(/body::after\s*\{([^}]*)\}/) || [])[1] || '';
    expect(strip).toMatch(/position:\s*fixed;/);
    expect(strip).toMatch(/left:\s*0;/);
    expect(strip).toMatch(/right:\s*0;/);
    expect(strip).toMatch(/bottom:\s*0;/);
    expect(strip).toMatch(/background:\s*var\(--color-background\);/);
    // The page must keep at least the strip's height free at its end.
    expect(strip).toMatch(/height:\s*5rem;/);
    expect(css).toMatch(/body\s*\{[^}]*padding-bottom:\s*6\.5rem;/);
  });

  test('the page leaves room at the bottom for the fixed "Need help now" button', () => {
    expect(css).toMatch(/body\s*\{[^}]*padding-bottom:\s*6\.5rem;/);
    expect(css).toMatch(/#need-help-now-button\s*\{[^}]*position:\s*fixed;/);
  });
});

describe('choices that replaced dropdowns', () => {
  // The scripts read these with form.<name>.value, which works for a
  // group of radio buttons as long as they share the name.
  const GROUPS = [
    ['dashboard.html', 'score', ['1', '2', '3', '4', '5']],
    ['request-chat.html', 'moodBefore', ['1', '2', '3', '4', '5']],
    ['request-chat.html', 'topic', ['exams', 'family', 'money', 'loneliness', 'other']],
    ['chat.html', 'moodAfter', ['1', '2', '3', '4', '5']],
    ['signup.html', 'ageBand', ['16-17', '18-25']],
  ];

  test.each(GROUPS)('%s offers every "%s" value as a radio button', (page, name, values) => {
    const html = read(page);
    values.forEach((value) => {
      expect(html).toContain(`<input type="radio" name="${name}" value="${value}"`);
    });
  });

  test.each(GROUPS)('%s makes "%s" a required answer', (page, name) => {
    expect(read(page)).toMatch(new RegExp(`<input type="radio" name="${name}" value="[^"]+" required`));
  });
});

describe('the home pages', () => {
  const HOME_SCRIPTS = ['js/dashboard.js', 'js/listener-dashboard.js', 'js/staff.js', 'js/home-summary.js'];

  test.each(HOME_SCRIPTS)('%s never reads chat messages (BR 3)', (script) => {
    expect(read(script)).not.toMatch(/collection\('messages'\)/);
  });

  test.each([
    ['dashboard.html', 'js/dashboard.js'],
    ['listener-dashboard.html', 'js/listener-dashboard.js'],
    ['staff.html', 'js/staff.js'],
  ])('%s loads the shared helpers before %s', (page, script) => {
    const html = read(page);
    const helpers = html.indexOf('<script src="js/home-summary.js"></script>');
    expect(helpers).toBeGreaterThan(-1);
    expect(helpers).toBeLessThan(html.indexOf(`<script src="${script}"></script>`));
  });

  test('the moderator queue page loads the helpers its rows use', () => {
    const html = read('moderator-queue.html');
    expect(html.indexOf('js/home-summary.js')).toBeGreaterThan(-1);
    expect(html.indexOf('js/home-summary.js')).toBeLessThan(html.indexOf('js/moderator.js'));
  });
});

describe('after a chat', () => {
  test('chat.html asks "Would you use Spill again?" with yes, no and not sure, all optional', () => {
    const html = read('chat.html');
    expect(html).toContain('Would you use Spill again?');
    ['yes', 'no', 'not-sure'].forEach((value) => {
      expect(html).toContain(`<input type="radio" name="useAgain" value="${value}">`);
    });
    expect(html).not.toMatch(/name="useAgain"[^>]*required/);
  });
});

describe('privacy notice and consent (FR 1.3, NFR 14)', () => {
  const privacy = read('privacy.html');

  test('the privacy page shows the same version that sign-up records', () => {
    const recorded = (read('js/auth.js').match(/var PRIVACY_NOTICE_VERSION = '([^']+)';/) || [])[1];
    expect(recorded).toBeTruthy();
    expect(privacy).toContain(`<span id="privacy-notice-version">${recorded}</span>`);
  });

  test('the privacy page works with no account: it loads no Firebase at all (BR 8)', () => {
    expect(privacy).not.toMatch(/gstatic\.com|firebase/);
  });

  test('the privacy page names who is responsible and how to reach them', () => {
    expect(privacy).toContain('Dianah Teta');
    expect(privacy).toContain('mailto:d.teta@alustudent.com');
  });

  test('the privacy page covers what NFR 14 and section 2.6 ask for', () => {
    ['Confidentiality and its limits', 'Where it is stored', 'outside Rwanda', 'within 48 hours', 'Terms of use', 'under 16', 'not therapy'].forEach(
      (words) => expect(privacy).toContain(words)
    );
  });

  test.each(['signup.html', 'index.html', 'dashboard.html'])('%s links to the privacy page', (page) => {
    expect(read(page)).toContain('href="privacy.html"');
  });

  test('sign-up offers "Under 16" so a younger person is told, not left to pick 16 to 17', () => {
    expect(read('signup.html')).toContain('<input type="radio" name="ageBand" value="under-16"');
  });
});

describe('the landing page helplines', () => {
  const script = read('js/resources.js');

  test('an empty list shows the built-in helplines, not an empty card', () => {
    expect(script).not.toContain('No resources added yet');
    expect(script).toMatch(/if \(snapshot\.empty\) \{\s*showBuiltInHelplines\(list, ''\);/);
  });

  test('a list that fails to load shows the built-in helplines too', () => {
    expect(script).toMatch(/\.catch\(function \(error\) \{\s*showBuiltInHelplines\(list, /);
  });

  test('the landing page loads the crisis card script, where the built-in list lives', () => {
    expect(read('index.html')).toMatch(/<script src="js\/crisis-card\.js"><\/script>/);
  });
});

describe('the crisis card', () => {
  const script = read('js/crisis-card.js');

  test.each([
    ['114', 'Rwanda Biomedical Centre helpline'],
    ['116', 'Child helpline / RIB'],
    ['0793 902 059', 'Kigali Mental Health Referral Centre'],
  ])('lists %s as "%s" in the built-in helplines', (number, name) => {
    expect(script).toContain(`{ number: '${number}', name: '${name}' }`);
  });

  test('every built-in helpline gets a line with a Call button on the card', () => {
    expect(script).toMatch(/BUILT_IN_HELPLINES\.map\(function \(line\) \{\s*return crisisLine\(line\.number, line\.name\);/);
  });

  test('8015 is no longer listed', () => {
    expect(script).not.toContain('8015');
  });

  test('the card does not promise that every line is free', () => {
    expect(script).not.toMatch(/are free/);
  });

  test('each Call button is a phone link, dialled without spaces, with a spoken label', () => {
    expect(script).toMatch(/var dial = number\.replace\(\/ \/g, ''\);/);
    expect(script).toMatch(/href="tel:' \+ dial \+ '"/);
    expect(script).toMatch(/aria-label="Call ' \+ number \+ '"/);
  });
});
