/* server.js – Rokuj: oferty per branża + auto-kompetencje w normalnych kategoriach */
const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

const APP_ID  = process.env.ADZUNA_APP_ID;
const APP_KEY = process.env.ADZUNA_APP_KEY;

/* ---------- ZAPYTANIA PER BRANŻA (zapytanie -> kategoria) ---------- */
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

/* ---------- AUTO-WYKRYWANIE NOWYCH KOMPETENCJI ---------- */
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

/* Auto-skille z przypisaną kategorią (tą, w której fraza pada najczęściej) */
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
      const kws = skills[skillName];
      if (kws.some(k => t.includes(k))) found.push(skillName);
    }
  }
  for (const a of autoSkills) {
    if (a.keywords.some(k => t.includes(k))) found.push(a.name);
  }
  return found;
}

/* ---------- POBIERANIE Z ADZUNA (cache 2 h) ---------- */
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

async function refresh() {
  if (cache.jobs && Date.now() - cache.time < TTL) return cache;
  if (!APP_ID || !APP_KEY) return { jobs: FALLBACK, cats: baseCats() };

  try {
    const raw = [];
    for (const query of QUERIES) {
      const url = 'https://api.adzuna.com/v1/api/jobs/pl/search/1' +
        '?app_id=' + APP_ID + '&app_key=' + APP_KEY +
        '&results_per_page=50&what_or=' + encodeURIComponent(query.q) +
        '&content-type=application/json';
      const resp = await fetch(url);
      if (resp.ok) {
        const data = await resp.json();
        for (const r of (data.results || [])) {
          r._cat = query.cat;
          raw.push(r);
        }
      }
    }

    /* deduplikacja po adresie oferty */
    const seen = new Set();
    const unique = raw.filter(r => !seen.has(r.redirect_url) && seen.add(r.redirect_url));

    const items = unique.map(r => ({
      text: (r.title || '') + ' ' + (r.description || ''),
      cat: r._cat,
    }));

    const autoSkills = mineSkills(items);

    const jobs = [];
    for (let i = 0; i < unique.length; i++) {
      const r = unique.at(i);
      const it = items.at(i);
      const skills = detectSkills(it.text, autoSkills);
      if (!skills.length) continue;
      jobs.push({
        title: r.title || 'Oferta pracy',
        company: (r.company && r.company.display_name) ? r.company.display_name : '',
        location: (r.location && r.location.display_name) ? r.location.display_name : '',
        remote: /zdaln|remote|home office/i.test(it.text),
        portal: 'Adzuna',
        url: r.redirect_url || '#',
        skills: skills,
      });
    }

    /* auto-skille dopisywane do NORMALNYCH kategorii */
    const cats = baseCats();
    for (const a of autoSkills) {
      if (!cats[a.cat]) cats[a.cat] = [];
      if (!cats[a.cat].includes(a.name)) cats[a.cat].push(a.name);
    }

    console.log('✅ ' + unique.length + ' unikalnych ofert, ' + jobs.length +
      ' z kompetencjami, ' + autoSkills.length + ' auto-skilli');

    cache = { jobs, cats, time: Date.now() };
    return cache;
  } catch (e) {
    console.error('❌ Błąd Adzuna:', e.message);
    return { jobs: cache.jobs || FALLBACK, cats: cache.cats || baseCats() };
  }
}

/* ---------- ENDPOINTY ---------- */
app.get('/api/skills', async (req, res) => res.json((await refresh()).cats));
app.get('/api/jobs',   async (req, res) => res.json((await refresh()).jobs));

app.listen(PORT, () => console.log('✅ Serwer działa: http://localhost:' + PORT));
