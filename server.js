/* server.js – Rokuj: oferty per branża + dynamiczny słownik kompetencji */
const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

const APP_ID  = process.env.ADZUNA_APP_ID;
const APP_KEY = process.env.ADZUNA_APP_KEY;

/* ---------- ZAPYTANIA PER BRANŻA (różnorodność ofert) ---------- */
const QUERIES = [
  'magazynier', 'kierowca', 'sprzedawca kasjer', 'kucharz kelner',
  'opiekun pielęgniarka', 'elektryk spawacz', 'operator produkcji',
  'programista tester', 'księgowość kadry', 'biuro administracja',
  'sprzątanie ochrona', 'fryzjer kosmetyczka',
];

/* ---------- SŁOWNIK BAZOWY ---------- */
const SKILL_DEFS = {
  'IT i programowanie': {
    'Python': ['python'], 'JavaScript': ['javascript', 'react', 'node.js'],
    'SQL': ['sql', 'baz danych'], 'Excel': ['excel'],
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

const AUTO_CAT = 'Wykryte automatycznie 🤖';

/* ---------- AUTO-WYKRYWANIE NOWYCH KOMPETENCJI ---------- */
const CUE = /(?:znajomość|znajomości|obsługa|obsługi|uprawnienia|uprawnień|kurs|certyfikat|licencja|umiejętność|doświadczenie w|biegłość w)\s+([a-ząćęłńóśźż0-9#+][a-ząćęłńóśźż0-9#+./-]*(?:\s+[a-ząćęłńóśźż0-9#+][a-ząćęłńóśźż0-9#+./-]*){0,2})/gi;
const STOP = new Set(('i,oraz,w,we,z,ze,na,do,od,po,za,o,u,dla,przy,pod,jest,są,lub,albo,nie,się,' +
  'pracy,pracę,praca,firmie,firmy,osoby,osób,godzin,umowy,mile,widziane,widziana,min,itp,np,tym,' +
  'zakresu,zakresie,obszarze,poziomie,stopniu,warunkiem,atutem,plusem,wymagana,wymagane,dobra,dobrej,bardzo').split(','));
const MIN_OFFERS = 5;   // fraza musi wystąpić w min. tylu ofertach
const MAX_AUTO   = 30;  // max liczba auto-kompetencji

function cleanPhrase(p) {
  let words = p.toLowerCase().trim().split(/\s+/);
  while (words.length && STOP.has(words[words.length - 1])) words.pop();
  while (words.length && STOP.has(words<a href="" class="citation-link" target="_blank" style="vertical-align: super; font-size: 0.8em; margin-left: 3px;">[0]</a>)) words.shift();
  if (!words.length || words.join(' ').length < 4) return null;
  return words.join(' ');
}

function mineSkills(texts) {
  const known = new Set();
  for (const skills of Object.values(SKILL_DEFS))
    for (const kws of Object.values(skills)) kws.forEach(k => known.add(k));

  const freq = {};
  for (const text of texts) {
    const inThis = new Set();
    for (const m of text.toLowerCase().matchAll(CUE)) {
      const p = cleanPhrase(m<a href="" class="citation-link" target="_blank" style="vertical-align: super; font-size: 0.8em; margin-left: 3px;">[1]</a>);
      if (p && !STOP.has(p) && ![...known].some(k => p.includes(k) || k.includes(p)))
        inThis.add(p);
    }
    inThis.forEach(p => freq[p] = (freq[p] || 0) + 1);
  }
  return Object.entries(freq)
    .filter(([, n]) => n >= MIN_OFFERS)
    .sort((a, b) => b<a href="" class="citation-link" target="_blank" style="vertical-align: super; font-size: 0.8em; margin-left: 3px;">[1]</a> - a<a href="" class="citation-link" target="_blank" style="vertical-align: super; font-size: 0.8em; margin-left: 3px;">[1]</a>)
    .slice(0, MAX_AUTO)
    .map(([p]) => [p.charAt(0).toUpperCase() + p.slice(1), [p]]);
}

/* ---------- WYKRYWANIE KOMPETENCJI W OFERCIE ---------- */
function detectSkills(text, autoSkills) {
  const t = text.toLowerCase();
  const found = [];
  for (const skills of Object.values(SKILL_DEFS))
    for (const [skill, kws] of Object.entries(skills))
      if (kws.some(k => t.includes(k))) found.push(skill);
  for (const [skill, kws] of autoSkills)
    if (kws.some(k => t.includes(k))) found.push(skill);
  return found;
}

/* ---------- POBIERANIE Z ADZUNA (cache 2 h – limit API!) ---------- */
let cache = { jobs: null, cats: null, time: 0 };
const TTL = 2 * 60 * 60 * 1000;

const FALLBACK = [{ title: 'Przykładowa oferta (API niedostępne)', company: 'Rokuj',
  location: 'Polska', remote: false, portal: 'demo', url: '#', skills: ['Obsługa klienta'] }];

async function refresh() {
  if (cache.jobs && Date.now() - cache.time < TTL) return cache;
  if (!APP_ID || !APP_KEY) return { jobs: FALLBACK, cats: baseCats() };
  try {
    const raw = [];
    for (const q of QUERIES) {
      const url = `https://api.adzuna.com/v1/api/jobs/pl/search/1?app_id=${APP_ID}&app_key=${APP_KEY}` +
        `&results_per_page=50&what_or=${encodeURIComponent(q)}&content-type=application/json`;
      const resp = await fetch(url);
      if (resp.ok) raw.push(...((await resp.json()).results || []));
    }
    /* deduplikacja po adresie oferty */
    const seen = new Set();
    const unique = raw.filter(r => !seen.has(r.redirect_url) && seen.add(r.redirect_url));

    const texts = unique.map(r => (r.title || '') + ' ' + (r.description || ''));
    const autoSkills = mineSkills(texts);

    const jobs = unique.map((r, i) => ({
      title: r.title || 'Oferta pracy',
      company: r.company?.display_name || '',
      location: r.location?.display_name || '',
      remote: /zdaln|remote|home office/i.test(texts[i]),
      portal: 'Adzuna',
      url: r.redirect_url || '#',
      skills: detectSkills(texts[i], autoSkills),
    })).filter(j => j.skills.length > 0);

    const cats = baseCats();
    if (autoSkills.length) cats[AUTO_CAT] = autoSkills.map(([s]) => s);

    console.log(`✅ ${unique.length} unikalnych ofert, ${jobs.length} z kompetencjami, ${autoSkills.length} auto-skilli: ${autoSkills.slice(0,8).map(s=>s<a href="" class="citation-link" target="_blank" style="vertical-align: super; font-size: 0.8em; margin-left: 3px;">[0]</a>).join(', ')}…`);
    cache = { jobs, cats, time: Date.now() };
    return cache;
  } catch (e) {
    console.error('❌ Błąd Adzuna:', e.message);
    return { jobs: cache.jobs || FALLBACK, cats: cache.cats || baseCats() };
  }
}

function baseCats() {
  return Object.fromEntries(Object.entries(SKILL_DEFS).map(([c, s]) => [c, Object.keys(s)]));
}

/* ---------- ENDPOINTY ---------- */
app.get('/api/skills', async (req, res) => res.json((await refresh()).cats));
app.get('/api/jobs',   async (req, res) => res.json((await refresh()).jobs));

app.listen(PORT, () => console.log(`✅ Serwer działa: http://localhost:${PORT}`));
