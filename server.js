/* server.js – Rokuj: wiele źródeł ofert (Adzuna + Jooble) */
const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

const ADZUNA_ID  = process.env.ADZUNA_APP_ID;
const ADZUNA_KEY = process.env.ADZUNA_APP_KEY;
const JOOBLE_KEY = process.env.JOOBLE_API_KEY;

/* ---------- ZAPYTANIA PER BRANŻA ---------- */
const QUERIES = [
  { q: 'magazynier',           cat: 'Transport i logistyka' },
  { q: 'kierowca',             cat: 'Transport i logistyka' },
  { q: 'sprzedawca kasjer',    cat: 'Sprzedaż i obsługa klienta' },
  { q: 'kucharz kelner',       cat: 'Gastronomia i hotelarstwo' },
  { q: 'opiekun pielęgniarka', cat: 'Medycyna i uroda' },
  { q: 'fryzjer kosmetyczka',  cat: 'Medycyna i uroda' },
  { q: 'elektryk spawacz',     cat: 'Produkcja i budownictwo' },
  { q: 'operator produkcji',   cat: 'Produkcja i budownictwo' },
  { q: 'programista tester',   cat: 'IT i programowanie' },
  { q: 'księgowość kadry',     cat: 'Biuro i administracja' },
  { q: 'biuro administracja',  cat: 'Biuro i administracja' },
  { q: 'sprzątanie ochrona',   cat: 'Sprzątanie i ochrona' },
];

/* ---------- SŁOWNIK BAZOWY ---------- */
const SKILL_DEFS = {
  'IT i programowanie': {
    'Python': ['python'],
    'JavaScript': ['javascript', 'react', 'node.js'],
    'SQL': ['sql', 'baz danych'],
    'Excel': ['excel'],
    'Helpdesk': ['helpdesk', 'wsparcie it', 'service desk'],
    'Testowanie oprogramowania': ['tester', 'testowani', 'testów'],
  },
  'Produkcja i budownictwo': {
    'Uprawnienia SEP': ['sep', 'uprawnienia elektryczne', 'elektryk'],
    'Wózek widłowy (UDT)': ['wózki widłowe', 'wózka widłowego', 'wózek widłowy', 'udt'],
    'Spawanie MAG/TIG': ['spawacz', 'spawani', 'spawanie'],
    'Obsługa CNC': ['cnc'],
    'Czytanie rysunku technicznego': ['rysunku technicznego', 'rysunek techniczny'],
    'Obsługa maszyn produkcyjnych': ['maszyn produkcyjnych', 'linii produkcyjnej', 'operator produkcji'],
  },
  'Transport i logistyka': {
    'Prawo jazdy kat. B': ['kat. b', 'kategorii b', 'prawo jazdy b', 'kat.b'],
    'Prawo jazdy kat. C+E': ['kat. c', 'c+e', 'kategorii c'],
    'Karta kierowcy': ['karta kierowcy', 'karty kierowcy', 'tachograf'],
    'Gospodarka magazynowa': ['magazynier', 'magazynie', 'wms', 'inwentaryzac'],
  },
  'Gastronomia i hotelarstwo': {
    'Książeczka sanepidowska': ['sanepid', 'książeczka zdrowia', 'książeczkę sanepidowską'],
    'Przygotowywanie posiłków': ['kucharz', 'kuchni', 'posiłków'],
    'Obsługa kelnerska': ['kelner', 'kelnerk'],
    'Barista': ['barista', 'baristk'],
    'Obsługa recepcji': ['recepcj'],
  },
  'Medycyna i uroda': {
    'Prawo wykonywania zawodu': ['prawo wykonywania zawodu', 'pwz', 'pielęgniar'],
    'Opieka nad seniorami': ['opiekun', 'osób starszych', 'seniora', 'seniorów'],
    'Pierwsza pomoc (KPP)': ['pierwszej pomocy', 'kpp'],
    'Fryzjerstwo': ['fryzjer', 'strzyżeni'],
    'Kosmetologia': ['kosmetyczk', 'kosmetolog', 'manicure'],
  },
  'Sprzedaż i obsługa klienta': {
    'Obsługa kasy fiskalnej': ['kasy fiskalnej', 'kasa fiskalna', 'kasjer'],
    'Techniki sprzedaży': ['sprzedawca', 'sprzedaży', 'handlowiec'],
    'Obsługa klienta': ['obsługa klienta', 'obsługi klienta', 'obsłudze klienta'],
    'CRM': ['crm'],
    'Call center': ['call center', 'infolini'],
  },
  'Biuro i administracja': {
    'MS Office': ['ms office', 'pakiet office', 'pakietu office'],
    'Fakturowanie': ['faktur'],
    'Kadry i płace': ['kadry i płace', 'kadrowo-płacow', 'kadr i płac'],
    'Język angielski': ['angielski', 'angielskiego', 'english'],
    'Księgowość': ['księgow', 'rachunkow'],
  },
  'Sprzątanie i ochrona': {
    'Sprzątanie obiektów': ['sprzątacz', 'sprzątani', 'utrzymania czystości'],
    'Ochrona mienia': ['ochroniarz', 'dozór', 'kwalifikowany pracownik ochrony'],
  },
};

/* ---------- AUTO-WYKRYWANIE KOMPETENCJI ---------- */
const CUE = /(?:znajomość|znajomości|obsługa|obsługi|uprawnienia|uprawnień|kurs|certyfikat|licencja|umiejętność|doświadczenie w|biegłość w)\s+([a-ząćęłńóśźż0-9#+][a-ząćęłńóśźż0-9#+./-]*(?:\s+[a-ząćęłńóśźż0-9#+][a-ząćęłńóśźż0-9#+./-]*){0,2})/gi;

const STOP = new Set(('i,oraz,w,we,z,ze,na,do,od,po,za,o,u,dla,przy,pod,jest,są,lub,albo,nie,się,' +
  'pracy,pracę,praca,firmie,firmy,osoby,osób,godzin,umowy,mile,widziane,widziana,min,itp,np,tym,' +
  'zakresu,zakresie,obszarze,poziomie,stopniu,warunkiem,atutem,plusem,wymagana,wymagane,dobra,dobrej,bardzo').split(','));

const MIN_OFFERS = 3;
const MAX_AUTO   = 40;

function cleanPhrase(p) {
  const words = p.toLowerCase().trim().split(/\s+/);
  while (words.length && STOP.has(words.at(-1))) words.pop();
  while (words.length && STOP.has(words.at(0))) words.shift();
  if (!words.length || words.join(' ').length < 4) return null;
  return words.join(' ');
}

function mineSkills(items) {
  const known = [];
  for (const skills of Object.values(SKILL_DEFS)) {
    for (const kws of Object.values(skills)) {
      for (const k of kws) known.push(k);
    }
  }
  const freq = {};
  for (const it of items) {
    const inThis = new Set();
    for (const m of it.text.toLowerCase().matchAll(CUE)) {
      const p = cleanPhrase(m.at(1));
      if (!p || STOP.has(p)) continue;
      let overlaps = false;
      for (const k of known) {
        if (p.includes(k) || k.includes(p)) { overlaps = true; break; }
      }
      if (!overlaps) inThis.add(p);
    }
    for (const p of inThis) {
      if (!freq[p]) freq[p] = { total: 0, byCat: {} };
      freq[p].total += 1;
      freq[p].byCat[it.cat] = (freq[p].byCat[it.cat] || 0) + 1;
    }
  }
  const list = [];
  for (const phrase of Object.keys(freq)) {
    const info = freq[phrase];
    if (info.total >= MIN_OFFERS) list.push({ phrase, info });
  }
  list.sort((a, b) => b.info.total - a.info.total);

  const result = [];
  for (const item of list.slice(0, MAX_AUTO)) {
    let bestCat = 'Biuro i administracja';
    let bestN = -1;
    for (const catName of Object.keys(item.info.byCat)) {
      const n = item.info.byCat[catName];
      if (n > bestN) { bestN = n; bestCat = catName; }
    }
    const name = item.phrase.charAt(0).toUpperCase() + item.phrase.slice(1);
    result.push({ name, keywords: [item.phrase], cat: bestCat });
  }
  return result;
}

function detectSkills(text, autoSkills) {
  const t = text.toLowerCase();
  const found = [];
  for (const skills of Object.values(SKILL_DEFS)) {
    for (const skillName of Object.keys(skills)) {
      if (skills[skillName].some(k => t.includes(k))) found.push(skillName);
    }
  }
  for (const a of autoSkills) {
    if (a.keywords.some(k => t.includes(k))) found.push(a.name);
  }
  return found;
}

/* ================================================================
   ŹRÓDŁA OFERT – każde zwraca tablicę w formacie wewnętrznym:
   { title, company, location, text, cat, url, portal }
   ================================================================ */

/* ---------- ŹRÓDŁO 1: Adzuna ---------- */
async function fetchAdzuna() {
  if (!ADZUNA_ID || !ADZUNA_KEY) return [];
  const out = [];
  for (const query of QUERIES) {
    try {
      const url = 'https://api.adzuna.com/v1/api/jobs/pl/search/1' +
        '?app_id=' + ADZUNA_ID + '&app_key=' + ADZUNA_KEY +
        '&results_per_page=50&what_or=' + encodeURIComponent(query.q) +
        '&content-type=application/json';
      const resp = await fetch(url);
      if (!resp.ok) continue;
      const data = await resp.json();
      for (const r of (data.results || [])) {
        out.push({
          title: r.title || 'Oferta pracy',
          company: (r.company && r.company.display_name) ? r.company.display_name : '',
          location: (r.location && r.location.display_name) ? r.location.display_name : '',
          text: (r.title || '') + ' ' + (r.description || ''),
          cat: query.cat,
          url: r.redirect_url || '#',
          portal: 'Adzuna',
        });
      }
    } catch (e) {
      console.error('Adzuna (' + query.q + '):', e.message);
    }
  }
  return out;
}

/* ---------- ŹRÓDŁO 2: Jooble ---------- */
async function fetchJooble() {
  if (!JOOBLE_KEY) return [];
  const out = [];
  for (const query of QUERIES) {
    try {
      const resp = await fetch('https://pl.jooble.org/api/' + JOOBLE_KEY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: query.q, location: '', page: 1 }),
      });
      if (!resp.ok) continue;
      const data = await resp.json();
      for (const r of (data.jobs || [])) {
        out.push({
          title: r.title || 'Oferta pracy',
          company: r.company || '',
          location: r.location || '',
          text: (r.title || '') + ' ' + (r.snippet || ''),
          cat: query.cat,
          url: r.link || '#',
          portal: 'Jooble',
        });
      }
    } catch (e) {
      console.error('Jooble (' + query.q + '):', e.message);
    }
  }
  return out;
}

/* ================================================================
   AGREGACJA + CACHE
   ================================================================ */
let cache = { jobs: null, cats: null, time: 0 };
const TTL = 2 * 60 * 60 * 1000;

const FALLBACK = [{
  title: 'Przykładowa oferta (API niedostępne)', company: 'Rokuj',
  location: 'Polska', remote: false, portal: 'demo', url: '#',
  skills: ['Obsługa klienta'],
}];

function baseCats() {
  const cats = {};
  for (const catName of Object.keys(SKILL_DEFS)) {
    cats[catName] = Object.keys(SKILL_DEFS[catName]);
  }
  return cats;
}

/* deduplikacja: po URL oraz po znormalizowanym tytule+firmie */
function dedupe(list) {
  const seen = new Set();
  const out = [];
  for (const r of list) {
    const keyUrl = r.url;
    const keyText = (r.title + '|' + r.company).toLowerCase().replace(/\s+/g, ' ').trim();
    if (seen.has(keyUrl) || seen.has(keyText)) continue;
    seen.add(keyUrl);
    seen.add(keyText);
    out.push(r);
  }
  return out;
}

async function refresh() {
  if (cache.jobs && Date.now() - cache.time < TTL) return cache;

  try {
    const results = await Promise.all([fetchAdzuna(), fetchJooble()]);
    let all = [];
    for (const part of results) all = all.concat(part);

    const unique = dedupe(all);
    if (!unique.length) return { jobs: cache.jobs || FALLBACK, cats: cache.cats || baseCats() };

    const items = unique.map(r => ({ text: r.text, cat: r.cat }));
    const autoSkills = mineSkills(items);

    const jobs = [];
    for (const r of unique) {
      const skills = detectSkills(r.text, autoSkills);
      if (!skills.length) continue;
      jobs.push({
        title: r.title,
        company: r.company,
        location: r.location,
        remote: /zdaln|remote|home office/i.test(r.text),
        portal: r.portal,
        url: r.url,
        skills: skills,
      });
    }

    const cats = baseCats();
    for (const a of autoSkills) {
      if (!cats[a.cat]) cats[a.cat] = [];
      if (!cats[a.cat].includes(a.name)) cats[a.cat].push(a.name);
    }

    const perPortal = {};
    for (const j of jobs) perPortal[j.portal] = (perPortal[j.portal] || 0) + 1;
    console.log('✅ ' + unique.length + ' unikalnych ofert, ' + jobs.length +
      ' z kompetencjami, ' + autoSkills.length + ' auto-skilli, źródła: ' +
      JSON.stringify(perPortal));

    cache = { jobs, cats, time: Date.now() };
    return cache;
  } catch (e) {
    console.error('❌ Błąd agregacji:', e.message);
    return { jobs: cache.jobs || FALLBACK, cats: cache.cats || baseCats() };
  }
}

/* ---------- ENDPOINTY ---------- */
app.get('/api/skills', async (req, res) => res.json((await refresh()).cats));
app.get('/api/jobs',   async (req, res) => res.json((await refresh()).jobs));

app.listen(PORT, () => console.log('✅ Serwer działa: http://localhost:' + PORT));
