/* test-ai2.js - PILOTAZ 2: AI czyta PELNE tresci ofert z CBOP */
require('dotenv').config();
const fs = require('fs');

const KEY = process.env.OPENAI_API_KEY;
if (!KEY) { console.error('Brak OPENAI_API_KEY w .env'); process.exit(1); }

const PROMPT = 'Jestes ekspertem HR. Przeczytaj ogloszenie o prace i zwroc JSON:\n' +
  '{"kompetencje": [...], "stawka": "..." albo null}\n' +
  'Zasady dla "kompetencje":\n' +
  '- wypisz WSZYSTKIE wymagane lub mile widziane: kompetencje, uprawnienia, jezyki obce, wyksztalcenie, doswiadczenie, technologie i cechy\n' +
  '- kazda jako krotka nazwa po polsku, w mianowniku, np. "Prawo jazdy kat. B", "Jezyk angielski", "Wyksztalcenie wyzsze", "Praca w zespole"\n' +
  '- opieraj sie TYLKO na tresci ogloszenia, niczego nie wymyslaj\n' +
  'Zasady dla "stawka":\n' +
  '- tylko jesli w tresci podano wynagrodzenie; przepisz w formacie np. "5 000 - 7 000 zl/mies. brutto" albo "35 zl/godz."\n' +
  '- jesli brak kwoty wynagrodzenia, zwroc null. Kwoty niebedace wynagrodzeniem ignoruj.';

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
        { role: 'user', content: text.slice(0, 8000) },
      ],
    }),
  });
  if (!resp.ok) throw new Error('OpenAI HTTP ' + resp.status + ': ' + (await resp.text()).slice(0, 200));
  const data = await resp.json();
  return JSON.parse(data.choices.at(0).message.content);
}

async function fetchCBOPSample() {
  const out = [];
  for (let page = 0; page <= 1; page++) {
    const resp = await fetch('https://oferty.praca.gov.pl/portal-api/v3/oferta/wyszukiwanie?page=' + page + '&size=50', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: '{}',
    });
    if (!resp.ok) { console.error('CBOP HTTP ' + resp.status); break; }
    const data = await resp.json();
    const results = (data.payload && data.payload.ofertyPracyPage && data.payload.ofertyPracyPage.content) || [];
    for (const r of results) {
      if (r.typOfertyEnum && r.typOfertyEnum !== 'OFERTA_PRACY') continue;
      out.push({
        title: r.stanowisko || 'Oferta',
        company: r.pracodawca || '',
        text: (r.stanowisko || '') + '\nZakres obowiazkow: ' + (r.zakresObowiazkow || '') + '\nWymagania: ' + (r.wymagania || ''),
        salaryField: r.wynagrodzenie || null,
        url: 'https://oferty.praca.gov.pl/portal/lista-ofert/szczegoly-oferty/' + r.id,
      });
    }
  }
  return out;
}

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

(async () => {
  console.log('Pobieram probke z CBOP...');
  const offers = await fetchCBOPSample();
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
    '<title>Pilotaz AI 2 - CBOP</title><style>body{font-family:Arial;max-width:900px;margin:20px auto;padding:0 10px}' +
    '.card{border:1px solid #ddd;border-radius:10px;padding:14px;margin-bottom:12px}' +
    '.tag{display:inline-block;background:#eef;border-radius:999px;padding:2px 10px;margin:2px;font-size:13px}' +
    '.sal{color:#16A34A;font-weight:bold}.none{color:#999}.field{color:#B45309}' +
    'details{margin-top:8px;font-size:13px;color:#555}</style></head><body>' +
    '<h1>Pilotaz AI 2 (pelne tresci CBOP): ' + results.length + ' ofert</h1>';
  for (const r of results) {
    html += '<div class="card"><b>' + esc(r.o.title) + '</b> — ' + esc(r.o.company) + '<br>' +
      'Stawka wg AI: ' + (r.ai.stawka ? '<span class="sal">' + esc(r.ai.stawka) + '</span>' : '<span class="none">brak</span>') +
      ' | Pole wynagrodzenie: ' + (r.o.salaryField ? '<span class="field">' + esc(r.o.salaryField) + '</span>' : '<span class="none">brak</span>') + '<br>';
    for (const k of (r.ai.kompetencje || [])) html += '<span class="tag">' + esc(k) + '</span>';
    html += '<details><summary>pelna tresc ogloszenia</summary><pre style="white-space:pre-wrap">' + esc(r.o.text) + '</pre></details>';
    html += '</div>';
  }
  html += '</body></html>';
  fs.writeFileSync('public/pilot2.html', html);
  fs.writeFileSync('pilot2-wyniki.json', JSON.stringify(results, null, 2));
  console.log('GOTOWE. Otworz: https://rokuj.pl/pilot2.html');
})();
