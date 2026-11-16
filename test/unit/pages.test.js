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

describe('the crisis card', () => {
  const script = read('js/crisis-card.js');

  test.each(['8015', '114', '116'])('lists %s with a button that starts a call', (number) => {
    expect(script).toContain(`crisisLine('${number}',`);
  });

  test('each Call button is a phone link with a spoken label', () => {
    expect(script).toMatch(/href="tel:' \+ number \+ '"/);
    expect(script).toMatch(/aria-label="Call ' \+ number \+ '"/);
  });
});
