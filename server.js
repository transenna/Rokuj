/* server.js – Rokuj: nocna synchronizacja, glebokie pobieranie, jobs.json */
require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

const ADZUNA_ID  = process.env.ADZUNA_APP_ID;
const ADZUNA_KEY = process.env.ADZUNA_APP_KEY;
const JOOBLE_KEY = process.env.JOOBLE_API_KEY;
const CAREERJET_KEY = process.env.CAREERJET_API_KEY;

/* ---------- USTAWIENIA SYNCHRONIZACJI ---------- */
const SYNC_HOURS = Array.of(3);   // godziny nocnego cyklu (mozna dopisac np. Array.of(3, 15))
const MAX_PAGES = 100;         // max stron na zrodlo (100 x 50 = 5000 ofert)
const MAX_AGE_DAYS = 30;       // odcinamy oferty starsze niz 30 dni
const PAUSE_MS = 400;          // grzeczna pauza miedzy zapytaniami
const JOBS_FILE = path.join(__dirname, 'jobs.json');

/* ---------- SLOWNIK BAZOWY ---------- */
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

const MAX_AUTO = 150;

function cleanPhrase(p) {
  const words = p.toLowerCase().trim().split(/\s+/);
  while (words.length && STOP.has(words.at(-1))) words.pop();
  while (words.length && STOP.has(words.at(0))) words.shift();
  if (!words.length || words.join(' ').length < 4) return null;
  return words.join(' ');
}

function mineSkills(items) {
  /* prog zalezny od wielkosci bazy: 3 przy malej, wiecej przy duzej */
  const minOffers = Math.max(3, Math.round(items.length / 500));
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
    if (info.total >= minOffers) list.push({ phrase, info });
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
  console.log('Auto-skille: ' + result.length + ' (prog: ' + minOffers + ' ofert)');
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

/* przypisanie kategorii po tresci oferty */
function categoryFor(text) {
  const t = text.toLowerCase();
  let bestCat = 'Biuro i administracja';
  let bestN = 0;
  for (const catName of Object.keys(SKILL_DEFS)) {
    let n = 0;
    for (const kws of Object.values(SKILL_DEFS[catName])) {
      if (kws.some(k => t.includes(k))) n += 1;
    }
    if (n > bestN) { bestN = n; bestCat = catName; }
  }
  return bestCat;
}

function baseCats() {
  const cats = {};
  for (const catName of Object.keys(SKILL_DEFS)) {
    cats[catName] = Object.keys(SKILL_DEFS[catName]);
  }
  return cats;
}

function daysAgo(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

function pause(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
/* ---------- ZRODLO 1: Adzuna (pelna paginacja) ---------- */
async function fetchAdzuna() {
  if (!ADZUNA_ID || !ADZUNA_KEY) { console.log('Adzuna: brak kluczy'); return []; }
  const out = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    try {
      const url = 'https://api.adzuna.com/v1/api/jobs/pl/search/' + page +
        '?app_id=' + ADZUNA_ID + '&app_key=' + ADZUNA_KEY +
        '&results_per_page=50&sort_by=date&content-type=application/json';
      const resp = await fetch(url);
      if (!resp.ok) { console.error('Adzuna str. ' + page + ': HTTP ' + resp.status); break; }
      const data = await resp.json();
      const results = data.results || [];
      if (!results.length) break;
      let tooOld = false;
      for (const r of results) {
        const age = daysAgo(r.created);
        if (age !== null && age > MAX_AGE_DAYS) { tooOld = true; continue; }
        out.push({
          title: r.title || 'Oferta pracy',
          company: (r.company && r.company.display_name) ? r.company.display_name : '',
          location: (r.location && r.location.display_name) ? r.location.display_name : '',
          text: (r.title || '') + ' ' + (r.description || ''),
          url: r.redirect_url || '#',
          portal: 'Adzuna',
          age: age,
        });
      }
      /* sortujemy po dacie, wiec gdy zaczely sie stare - konczymy */
      if (tooOld) { console.log('Adzuna: str. ' + page + ' - osiagnieto granice 30 dni'); break; }
      await pause(PAUSE_MS);
    } catch (e) {
      console.error('Adzuna str. ' + page + ':', e.message);
      break;
    }
  }
  console.log('Adzuna: pobrano ' + out.length + ' ofert');
  return out;
}
/* ---------- ZRODLO 2: Careerjet (pelna paginacja) ---------- */
async function fetchCareerjet() {
  if (!CAREERJET_KEY) { console.log('Careerjet: brak klucza'); return []; }
  const auth = 'Basic ' + Buffer.from(CAREERJET_KEY + ':').toString('base64');
  const out = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    try {
      const url = 'https://search.api.careerjet.net/v4/query' +
        '?locale_code=pl_PL&sort=date' +
        '&pagesize=50&page=' + page +
        '&user_ip=146.59.12.98' +
        '&user_agent=' + encodeURIComponent('Mozilla/5.0 (RokujPL)');
      const resp = await fetch(url, {
        headers: {
          'Authorization': auth,
          'Referer': 'https://rokuj.onrender.com',
          'User-Agent': 'Mozilla/5.0 (RokujPL; +https://rokuj.onrender.com)',
        },
      });
      if (!resp.ok) { console.error('Careerjet str. ' + page + ': HTTP ' + resp.status); break; }
      const data = await resp.json();
      const results = data.jobs || [];
      if (!results.length) break;
      let tooOld = false;
      for (const r of results) {
        const age = daysAgo(r.date);
        if (age !== null && age > MAX_AGE_DAYS) { tooOld = true; continue; }
        out.push({
          title: (r.title || 'Oferta pracy').replace(/<[^>]*>/g, ''),
          company: r.company || '',
          location: r.locations || r.location || '',
          text: ((r.title || '') + ' ' + (r.description || '')).replace(/<[^>]*>/g, ' '),
          url: r.url || '#',
          portal: 'Careerjet',
          age: age,
        });
      }
      if (tooOld) { console.log('Careerjet: str. ' + page + ' - osiagnieto granice 30 dni'); break; }
      await pause(PAUSE_MS);
    } catch (e) {
      console.error('Careerjet str. ' + page + ':', e.message);
      break;
    }
  }
  console.log('Careerjet: pobrano ' + out.length + ' ofert');
  return out;
}

/* ---------- SYNCHRONIZACJA ---------- */
let DATA = { jobs: [], cats: baseCats(), lastSync: null };
let syncing = false;

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

async function syncAll() {
  if (syncing) { console.log('Sync: juz trwa, pomijam'); return; }
  syncing = true;
  console.log('=== SYNC START ' + new Date().toISOString() + ' ===');
  try {
    const adzuna = await fetchAdzuna();
    const careerjet = await fetchCareerjet();
    const unique = dedupe(adzuna.concat(careerjet));
    console.log('Sync: ' + unique.length + ' unikalnych ofert');

    const items = unique.map(r => ({ text: r.text, cat: categoryFor(r.text) }));
    const autoSkills = mineSkills(items);

    const jobs = [];
    for (let i = 0; i < unique.length; i++) {
      const r = unique.at(i);
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
        age: r.age,
      });
    }

    const cats = baseCats();
    for (const a of autoSkills) {
      if (!cats[a.cat]) cats[a.cat] = [];
      if (!cats[a.cat].includes(a.name)) cats[a.cat].push(a.name);
    }

    const perPortal = {};
    for (const j of jobs) perPortal[j.portal] = (perPortal[j.portal] || 0) + 1;
    console.log('=== SYNC OK: ' + jobs.length + ' ofert z kompetencjami, zrodla: ' +
      JSON.stringify(perPortal) + ' ===');

    DATA = { jobs, cats, lastSync: new Date().toISOString() };
    fs.writeFileSync(JOBS_FILE, JSON.stringify(DATA));
    console.log('Sync: zapisano jobs.json');
  } catch (e) {
    console.error('SYNC BLAD:', e.message);
  }
  syncing = false;
}

/* wczytaj dane z pliku przy starcie (jesli istnieja) */
function loadFromFile() {
  try {
    if (fs.existsSync(JOBS_FILE)) {
      DATA = JSON.parse(fs.readFileSync(JOBS_FILE, 'utf8'));
      console.log('Start: wczytano ' + DATA.jobs.length + ' ofert z jobs.json (sync: ' + DATA.lastSync + ')');
      return true;
    }
  } catch (e) {
    console.error('Start: blad odczytu jobs.json:', e.message);
  }
  return false;
}

/* harmonogram: sprawdzaj co minute, czy wybila godzina synchronizacji */
let lastSyncDay = '';
setInterval(() => {
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  if (SYNC_HOURS.includes(now.getHours()) && lastSyncDay !== day) {
    lastSyncDay = day;
    syncAll();
  }
}, 60000);

/* ---------- ENDPOINTY ---------- */
app.get('/api/skills', (req, res) => res.json(DATA.cats));
app.get('/api/jobs',   (req, res) => res.json(DATA.jobs));
app.get('/api/status', (req, res) => res.json({
  ofert: DATA.jobs.length,
  ostatniaSynchronizacja: DATA.lastSync,
  trwaSynchronizacja: syncing,
}));

/* ---------- START ---------- */
app.listen(PORT, () => {
  console.log('Serwer dziala: http://localhost:' + PORT);
  if (!loadFromFile()) {
    console.log('Start: brak jobs.json - uruchamiam pierwsza synchronizacje...');
    syncAll();
  }
});
