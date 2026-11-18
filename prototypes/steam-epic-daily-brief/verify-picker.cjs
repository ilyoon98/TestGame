const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parseHTML } = require('linkedom');
const html = fs.readFileSync(path.join(__dirname, 'steam-epic-daily-brief/assets/genre-picker.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(script);

function mount({ saved, bridge = true, reject = false } = {}) {
  const { document, window } = parseHTML(`<html><body>${html}</body></html>`);
  const sent = [];
  const snapshots = [];
  window.openai = bridge ? {
    widgetState: saved,
    setWidgetState: async snapshot => { snapshots.push(structuredClone(snapshot)); },
    sendFollowUpMessage: async message => {
      if (reject) throw new Error('Unavailable');
      sent.push(message);
    },
  } : undefined;
  vm.runInNewContext(script, { document, window, Intl, Date, Set });
  const get = selector => document.querySelector(selector);
  const click = genre => get(`[data-genre="${genre}"]`).click();
  const selected = () => Array.from(document.querySelectorAll('[data-genre][aria-pressed="true"]')).map(el => el.dataset.genre);
  return { get, click, selected, sent, snapshots, window };
}

(async () => {
  const ui = mount();
  assert.deepEqual(ui.selected(), []);
  assert.equal(ui.get('[data-submit]').disabled, true);
  assert.equal(ui.get('[data-mature]').checked, true);
  ui.click('RPG'); ui.click('전략');
  assert.deepEqual(ui.selected(), ['RPG', '전략']);
  assert.equal(ui.sent.length, 0, 'Selecting must not start research');
  ui.click('RPG');
  assert.deepEqual(ui.selected(), ['전략']);
  ui.click('전체');
  assert.deepEqual(ui.selected(), ['전체']);
  ui.click('방치형'); ui.click('RPG');
  assert.deepEqual(new Set(ui.selected()), new Set(['방치형', 'RPG']));
  ui.get('[data-mature]').checked = false;
  ui.get('[data-mature]').dispatchEvent(new ui.window.Event('change'));
  ui.get('[data-extra]').value = '공포 제외, 2만원 이하';
  ui.get('[data-extra]').dispatchEvent(new ui.window.Event('input'));
  ui.get('[data-submit]').click();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(ui.sent.length, 1);
  for (const expected of ['방치형', 'RPG', 'Steam만', '성인등급 게임: 제외', '공포 제외, 2만원 이하']) assert.ok(ui.sent[0].prompt.includes(expected));

  const restored = mount({ saved: ui.snapshots.at(-1) });
  assert.deepEqual(new Set(restored.selected()), new Set(['방치형', 'RPG']));
  const old = structuredClone(ui.snapshots.at(-1)); old.modelContent.day = '2000-01-01';
  assert.deepEqual(mount({ saved: old }).selected(), [], 'Previous day cannot preselect today');

  const fallback = mount({ bridge: false });
  fallback.click('RPG'); fallback.click('퍼즐'); fallback.get('[data-submit]').click();
  assert.equal(fallback.get('[data-fallback-label]').hidden, false);
  assert.ok(fallback.get('[data-fallback]').value.includes('RPG, 퍼즐'));

  const failed = mount({ reject: true });
  failed.click('액션'); failed.get('[data-submit]').click();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(failed.get('[data-fallback-label]').hidden, false);
  assert.equal(failed.get('[data-submit]').disabled, false);
  const reportPath = path.join(__dirname, 'steam-epic-daily-brief/assets/report.html');
  const fixture = { asOf: '2000-01-01 09:00', genres: ['RPG', '전략'], includeMature: true,
    highlights: ['표시 검증용 자료'], free: [], new: [], deals: [{ title: '<b>표시 검증</b>',
      url: 'https://store.steampowered.com/app/123/', description: '표시 검증용', price: '123원',
      originalPrice: '246원', discount: '50%', deadline: '시각 미확인' }],
    emptyMessages: { free: '접근 제한', new: '확인 범위에서 해당 없음' }, limits: '검증용',
    sources: [{ label: '허용하지 않는 링크', url: 'javascript:alert(1)' }] };
  const report = fs.readFileSync(reportPath, 'utf8').replace(/(<script id="steam-daily-report-data" type="application\/json">)[\s\S]*?(<\/script>)/, (_, a, b) => a + JSON.stringify(fixture).replace(/</g, '\\u003c') + b);
  const reportDOM = parseHTML(`<html><body>${report}</body></html>`);
  vm.runInNewContext(report.match(/<script>([\s\S]*?)<\/script>/)[1], { document: reportDOM.document, URL });
  assert.equal(reportDOM.document.querySelector('[data-section="deals"] a').textContent, '<b>표시 검증</b>');
  assert.equal(reportDOM.document.querySelector('[data-section="deals"] b'), null);
  assert.equal(reportDOM.document.querySelector('[data-section="deals"] strong').textContent, '123원');
  assert.equal(reportDOM.document.querySelector('[data-sources] a').hasAttribute('href'), false);
  console.log('PASS: multi-select, maturity, explicit send, daily reset, restore, fallback, report rendering and safe links/text.');
})().catch(error => { console.error(error); process.exitCode = 1; });
