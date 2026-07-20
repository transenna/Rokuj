/* test-ai.js - PILOTAZ: AI czyta ~100 ofert i wyciaga kompetencje + stawki */
require('dotenv').config();
const fs = require('fs');

const KEY = process.env.OPENAI_API_KEY;
const ADZUNA_ID = process.env.ADZUNA_APP_ID;
const ADZUNA_KEY = process.env.ADZUNA_APP_KEY;

if (!KEY) { console.error('Brak OPENAI_API_KEY w .env'); process.exit(1); }

const PROMPT = 'Jestes ekspertem HR. Przeczytaj ogloszenie o prace i zwroc JSON:\n' +
  '{"kompetencje": [...], "stawka": "..." albo null}\n' +
  'Zasady dla "kompetencje":\n' +
  '- wypisz WSZYSTKIE wymagane lub mile widziane kompetencje, uprawnienia, jezyki, technologie i cechy\n' +
  '- kazda jako krotka nazwa po polsku, w mianowniku, np. "Prawo jazdy kat. B", "Jezyk angielski", "Python", "Praca w zespole"\n' +
  '- nie wymyslaj niczego, czego nie ma w tresci\n' +
  'Zasady dla "stawka":\n' +
  '- tylko jesli w tresci podano wynagrodzenie; przepisz je w formacie np. "5 000 - 7 000 zl/mies. brutto" albo "35 zl/godz. netto"\n' +
  '- jesli nie podano rodzaju (brutto/netto) - pomin te informacje\n' +
  '- jesli w ogloszeniu nie ma kwoty wynagrodzenia, zwroc null. Kwoty ktore nie sa wynagrodzeniem (udzwig, premie za polecenie) ignoruj.';

async function askAI(text) {
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + KEY },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: PROMPT },
        { role: 'user', content: text.slice(0, 6000) },
      ],
    }),
  });
  if (!resp.ok) throw new Error('OpenAI HTTP ' + resp.status + ': ' + (await resp.text()).slice(0, 200));
  const data = await resp.json();
  return JSON.parse(data.choices.at(0).message.content);
}

async function fetchOffers() {
  const out = [];
  for (let page = 1; page <= 2; page++) {
    const url = 'https://api.adzuna.com/v1/api/jobs/pl/search/' + page +
      '?app_id=' + ADZUNA_ID + '&app_key=' + ADZUNA_KEY +
      '&results_per_page=50&sort_by=date&content-type=application/json';
    const resp = await fetch(url);
    if (!resp.ok) { console.error('Adzuna HTTP ' + resp.status); break; }
    const data = await resp.json();
    for (const r of (data.results || [])) {
      out.push({
        title: r.title || 'Oferta',
        company: (r.company && r.company.display_name) || '',
        text: (r.title || '') + '\n' + (r.description || ''),
        url: r.redirect_url || '#',
      });
    }
  }
  return out;
}

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

(async () => {
  console.log('Pobieram oferty...');
  const offers = await fetchOffers();
  console.log('Mam ' + offers.length + ' ofert. Wysylam do AI...');

  const results = [];
  for (let i = 0; i < offers.length; i++) {
    const o = offers.at(i);
    try {
      const ai = await askAI(o.text);
      results.push({ o, ai });
      console.log((i + 1) + '/' + offers.length + ' OK: ' + o.title.slice(0, 60));
    } catch (e) {
      console.error((i + 1) + '/' + offers.length + ' BLAD: ' + e.message);
    }
  }

  let html = '<!DOCTYPE html><html lang="pl"><head><meta charset="UTF-8">' +
    '<title>Pilotaz AI</title><style>body{font-family:Arial;max-width:900px;margin:20px auto;padding:0 10px}' +
    '.card{border:1px solid #ddd;border-radius:10px;padding:14px;margin-bottom:12px}' +
    '.tag{display:inline-block;background:#eef;border-radius:999px;padding:2px 10px;margin:2px;font-size:13px}' +
    '.sal{color:#16A34A;font-weight:bold}.none{color:#999}</style></head><body>' +
    '<h1>Pilotaz AI: ' + results.length + ' ofert</h1>';
  for (const r of results) {
    html += '<div class="card"><b>' + esc(r.o.title) + '</b> — ' + esc(r.o.company) +
      ' · <a href="' + esc(r.o.url) + '" target="_blank">zobacz ogloszenie</a><br>' +
      'Stawka: ' + (r.ai.stawka ? '<span class="sal">' + esc(r.ai.stawka) + '</span>' : '<span class="none">brak</span>') + '<br>';
    for (const k of (r.ai.kompetencje || [])) html += '<span class="tag">' + esc(k) + '</span>';
    html += '</div>';
  }
  html += '</body></html>';
  fs.writeFileSync('public/pilot.html', html);
  fs.writeFileSync('pilot-wyniki.json', JSON.stringify(results, null, 2));
  console.log('GOTOWE. Otworz w przegladarce: https://rokuj.pl/pilot.html');
})();
