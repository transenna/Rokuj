/* server.js – Rokuj: nocna synchronizacja, glebokie pobieranie, jobs.json */
require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();.
const { analyzeAll } = require('./ai');
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

const ADZUNA_ID  = process.env.ADZUNA_APP_ID;
const ADZUNA_KEY = process.env.ADZUNA_APP_KEY;
const JOOBLE_KEY = process.env.JOOBLE_API_KEY;
const CAREERJET_KEY = process.env.CAREERJET_API_KEY;

/* ---------- USTAWIENIA SYNCHRONIZACJI ---------- */
const SYNC_HOURS = Array.of(5);   // godziny nocnego cyklu (mozna dopisac np. Array.of(3, 15))
const MAX_PAGES = 300;         // max stron na zrodlo (300 x 50 = 15000 ofert)
const MAX_AGE_DAYS = 60;       // odcinamy oferty starsze niz 60 dni
/* przelaczniki zrodel: zmien false->true, by wlaczyc z powrotem */
const SOURCES_ENABLED = {
  'Urzędy pracy': false,
  'Adzuna': false,
  'Careerjet': false,
};

const PAUSE_MS = 400;          // grzeczna pauza miedzy zapytaniami
const JOBS_FILE = path.join(__dirname, 'jobs.json');

/* ---------- SLOWNIK BAZOWY ---------- */
const SKILL_DEFS = {
  'Kompetencje uniwersalne': {
    'Kreatywność': ['kreatywn', 'twórcze podejście', 'twórczego podejścia', 'pomysłowoś'],
    'Komunikatywność': ['komunikatywn', 'umiejętności komunikacyjne', 'łatwość nawiązywania'],
    'Praca w zespole': ['w zespole', 'zespołow', 'współprac'],
    'Samodzielność': ['samodzieln'],
    'Dyspozycyjność': ['dyspozycyjn'],
    'Odporność na stres': ['odporność na stres', 'odporności na stres', 'pod presją', 'ze stresem'],
    'Zaangażowanie': ['zaangażowan', 'motywacj'],
    'Dokładność i sumienność': ['dokładnoś', 'skrupulatn', 'sumiennoś', 'rzetelnoś', 'staranności', 'staranność'],
    'Punktualność': ['punktualn'],
    'Dobra organizacja pracy': ['organizacji pracy', 'organizacja pracy', 'organizacji czasu', 'zarządzanie czasem'],
    'Wysoka kultura osobista': ['kultura osobista', 'kultury osobistej'],
    'Umiejętności analityczne': ['analityczn'],
    'Chęć do nauki i rozwoju': ['chęć do nauki', 'chęci do nauki', 'gotowość do nauki', 'szybkiego uczenia', 'chęć rozwoju', 'chęci rozwoju'],
    'Obsługa komputera': ['obsługa komputera', 'obsługi komputera', 'znajomość komputera', 'komputerow'],
    'Sprawność fizyczna': ['praca fizyczna', 'pracy fizycznej', 'sprawność fizyczna', 'sprawności fizycznej', 'dźwigani'],
    'Gotowość do pracy zmianowej': ['zmianow', 'trzy zmiany', 'praca w nocy', 'nocne zmiany'],
    'Niekaralność': ['niekaraln'],
     'Język polski (dla obcokrajowców)': ['języka polskiego', 'język polski'],
 },
  'Języki obce': {
    'Język angielski': ['angielsk', 'english'],
    'Język niemiecki': ['niemieck', 'german'],
    'Język francuski': ['francusk'],
    'Język hiszpański': ['hiszpańsk'],
    'Język włoski': ['włosk'],
    'Język ukraiński': ['ukraińsk'],
    'Język rosyjski': ['rosyjsk'],
    'Język czeski': ['czesk'],
    'Język niderlandzki': ['niderlandzk', 'holendersk'],
  },
  'IT i programowanie': {
    'Python': ['python'],
    'JavaScript': ['javascript', 'react', 'node.js', 'vue', 'angular'],
    'Java': [' java ', 'języka java', 'język java'],
    'C#/.NET': ['c#', '.net'],
    'PHP': ['php'],
    'SQL i bazy danych': ['sql', 'baz danych', 'bazy danych'],
    'Excel (zaawansowany)': ['excel'],
    'Administracja sieciami': ['sieci komputerow', 'lan', 'vpn', 'windows server', 'linux'],
    'Helpdesk / wsparcie IT': ['helpdesk', 'wsparcie it', 'wsparcia it', 'service desk'],
    'Testowanie oprogramowania': ['tester', 'testowani', 'testów oprogramowania', 'qa'],
    'DevOps / chmura': ['devops', 'docker', 'kubernetes', 'aws', 'azure'],
    'Cyberbezpieczeństwo': ['cyberbezpiecze', 'bezpieczeństwa it', 'security'],
  },
  'Produkcja i technika': {
    'Uprawnienia SEP (elektryczne)': ['sep', 'uprawnienia elektryczne', 'elektryk'],
    'Wózek widłowy (UDT)': ['wózki widłowe', 'wózka widłowego', 'wózek widłowy', 'wózków widłowych', 'udt'],
    'Spawanie (MAG/TIG/MMA)': ['spawacz', 'spawani', 'spawanie', 'spawalnicz'],
    'Obsługa CNC': ['cnc'],
    'Obróbka skrawaniem': ['tokarz', 'frezer', 'skrawani'],
    'Czytanie rysunku technicznego': ['rysunku technicznego', 'rysunek techniczny', 'dokumentacji technicznej', 'schemat'],
    'Obsługa maszyn produkcyjnych': ['maszyn produkcyjnych', 'linii produkcyjnej', 'operator produkcji', 'obsługa maszyn'],
    'Montaż i serwis urządzeń': ['monter', 'montaż', 'montażu', 'serwisant', 'konserwator'],
    'Automatyka przemysłowa': ['automatyk', 'plc', 'sterownik'],
    'Kontrola jakości': ['kontrola jakości', 'kontroli jakości', 'kontroler jakości'],
    'Elektronika': ['elektronik', 'lutowani'],
    'Mechanika pojazdowa': ['mechanik samochodow', 'mechanika pojazdow', 'diagnost'],
    'Lakiernictwo': ['lakiernik', 'lakierni'],
    'Ślusarstwo': ['ślusarz', 'ślusarsk'],
     'Obsługa suwnic': ['suwnic'],
    'Obsługa elektronarzędzi': ['elektronarzędzi', 'elektronarzędz'],
    'Narzędzia pomiarowe': ['narzędzi pomiarowych', 'suwmiark', 'mikrometr'],
    'Obsługa maszyn drukujących': ['maszyn drukujących', 'drukarni', 'poligraf'],
 },
  'Budownictwo': {
    'Prace wykończeniowe': ['wykończeniow', 'glazurnik', 'malarz', 'tynkarz', 'szpachlowani', 'gipsow'],
    'Murarstwo': ['murarz', 'murarsk'],
    'Ciesielstwo i zbrojarstwo': ['cieśla', 'ciesielsk', 'zbrojarz', 'szalunk'],
    'Dekarstwo': ['dekarz', 'dekarsk', 'pokryć dachowych'],
    'Instalacje hydrauliczne': ['hydraulik', 'instalacje sanitarne', 'instalacji sanitarnych', 'wod-kan'],
    'Instalacje elektryczne (budowlane)': ['instalacje elektryczne', 'instalacji elektrycznych', 'elektromonter'],
    'Operator maszyn budowlanych': ['koparki', 'koparko-ładowark', 'operator maszyn budowlanych', 'ładowarki'],
    'Brukarstwo': ['brukarz', 'brukarsk', 'kostki brukowej'],
    'Prace na wysokości': ['na wysokości', 'alpinistyczn'],
    'Stolarstwo': ['stolarz', 'stolarsk'],
  },
  'Transport i logistyka': {
    'Prawo jazdy kat. B': ['kat. b', 'kat.b', 'kategorii b', 'prawo jazdy b', 'prawa jazdy b'],
    'Prawo jazdy kat. C': ['kat. c', 'kat.c', 'kategorii c'],
    'Prawo jazdy kat. C+E': ['c+e', 'ce '],
    'Prawo jazdy kat. D': ['kat. d', 'kategorii d', 'autobus'],
    'Karta kierowcy i tachograf': ['karta kierowcy', 'karty kierowcy', 'tachograf'],
    'Przewóz rzeczy (kwalifikacja)': ['przewóz rzeczy', 'przewozu rzeczy', 'kwalifikacja wstępna', 'kod 95'],
    'ADR (materiały niebezpieczne)': ['adr'],
    'Gospodarka magazynowa': ['magazynier', 'magazynie', 'magazynow', 'wms', 'inwentaryzac'],
    'Kompletacja zamówień': ['kompletacj', 'komisjonowani', 'pakowani'],
    'Spedycja': ['spedytor', 'spedycj'],
    'Kurier / dostawca': ['kurier', 'dostawca', 'dowóz', 'dostarczani'],
  },
  'Gastronomia i hotelarstwo': {
    'Książeczka sanepidowska': ['sanepid', 'książeczka zdrowia', 'książeczkę sanepidowską', 'badania sanitarno'],
    'Gotowanie / kuchnia': ['kucharz', 'kuchni', 'gotowani', 'przygotowywanie posiłków', 'przygotowywania posiłków'],
    'Cukiernictwo i piekarstwo': ['cukiernik', 'cukierni', 'piekarz', 'piekarni', 'wypiek'],
    'Pizzerman': ['pizzerman', 'pizzer', 'wypiek pizzy'],
    'Obsługa kelnerska': ['kelner', 'kelnerk'],
    'Barman / barista': ['barman', 'barist', 'przygotowywanie kawy'],
    'Housekeeping': ['pokojow', 'housekeeping', 'sprzątanie pokoi'],
    'Obsługa recepcji': ['recepcj'],
    'Pomoc kuchenna': ['pomoc kuchenna', 'pomocy kuchennej', 'zmywak'],
  },
  'Medycyna i opieka': {
    'PWZ pielęgniarki/położnej': ['pielęgniar', 'położn'],
    'PWZ lekarza': ['lekarz', 'lekarsk'],
    'Ratownictwo medyczne': ['ratownik medyczny', 'ratownictwa medycznego', 'kpp'],
    'Opieka nad seniorami': ['opiekun osób starszych', 'opiekunka osób starszych', 'osób starszych', 'seniora', 'seniorów', 'opiekun medyczny'],
    'Opieka nad dziećmi': ['opiekunka dziecięca', 'niania', 'opieka nad dziećmi', 'opieki nad dziećmi'],
    'Fizjoterapia i masaż': ['fizjoterapeut', 'masażyst', 'rehabilitac'],
    'Farmacja': ['farmaceut', 'technik farmaceutyczny', 'aptek'],
    'Stomatologia': ['stomatolog', 'dentyst', 'higienistka stomatologiczna'],
    'Weterynaria': ['weterynar'],
    'Fryzjerstwo': ['fryzjer', 'strzyżeni'],
    'Kosmetologia': ['kosmetyczk', 'kosmetolog', 'manicure', 'stylizacja paznokci', 'stylizacji paznokci'],
  },
  'Edukacja i szkolenia': {
    'Nauczanie przedszkolne/wczesnoszkolne': ['przedszkol', 'wczesnoszkoln', 'wychowawc'],
    'Nauczanie przedmiotowe': ['nauczyciel', 'nauczaniu', 'pedagogiczne'],
    'Lektor języków': ['lektor', 'nauka języka', 'nauki języka'],
    'Prowadzenie szkoleń': ['trener', 'szkoleniowiec', 'prowadzenie szkoleń', 'prowadzenia szkoleń'],
    'Instruktor (sport/rekreacja)': ['instruktor'],
    'Psychologia i terapia': ['psycholog', 'terapeut', 'logoped'],
  },
  'Finanse i ubezpieczenia': {
    'Księgowość': ['księgow', 'rachunkow'],
    'Kadry i płace': ['kadry i płace', 'kadrowo-płacow', 'kadr i płac', 'naliczanie wynagrodzeń'],
    'Doradztwo finansowe': ['doradca finansowy', 'doradztwa finansowego', 'produktów finansowych', 'kredyt'],
    'Ubezpieczenia': ['ubezpiecze', 'agent ubezpieczeniowy'],
    'Windykacja': ['windykac'],
    'Analiza finansowa': ['analityk finansowy', 'analizy finansowej', 'controlling'],
    'Fakturowanie': ['faktur'],
    'Podatki': ['podatk', 'deklaracji vat', 'vat'],
  },
  'Sprzedaż i obsługa klienta': {
    'Obsługa kasy fiskalnej': ['kasy fiskalnej', 'kasa fiskalna', 'kasjer'],
    'Techniki sprzedaży': ['sprzedawca', 'sprzedaży', 'handlowiec', 'handlow'],
    'Obsługa klienta': ['obsługa klienta', 'obsługi klienta', 'obsłudze klienta', 'obsługę klienta'],
    'CRM': ['crm'],
    'Call center / infolinia': ['call center', 'infolini', 'telefoniczna obsługa', 'telemarket'],
    'Merchandising': ['merchandis', 'ekspozycj', 'wykładanie towaru', 'wykładania towaru'],
    'Sprzedaż B2B': ['b2b', 'klienta biznesowego', 'klientów biznesowych'],
    'Doradztwo techniczne': ['doradca techniczny', 'doradztwo techniczne'],
  },
  'Biuro i administracja': {
    'MS Office': ['ms office', 'pakiet office', 'pakietu office', 'word', 'powerpoint'],
    'Prace biurowe': ['prace biurowe', 'prac biurowych', 'administracyjn', 'biurow'],
    'Obsługa sekretariatu': ['sekretariat', 'sekretarka', 'asystentka zarządu', 'asystent zarządu'],
    'Obieg dokumentów': ['dokumentacj', 'archiwizacj', 'obieg dokumentów'],
    'HR i rekrutacja': ['rekrutac', 'hr ', 'zasobów ludzkich'],
    'Zamówienia publiczne': ['zamówień publicznych', 'zamówienia publiczne', 'przetarg'],
    'Prawo i umowy': ['prawnik', 'radca prawny', 'umów', 'prawne'],
  },
  'Marketing i media': {
    'Marketing internetowy': ['marketing', 'kampanii reklamowych', 'kampanie reklamowe'],
    'Social media': ['social media', 'facebook', 'instagram', 'tiktok'],
    'Grafika komputerowa': ['grafik', 'photoshop', 'canva', 'illustrator'],
    'Copywriting': ['copywrit', 'tworzenie treści', 'tworzenia treści', 'redagowani'],
    'Fotografia i wideo': ['fotograf', 'montaż wideo', 'montażu wideo', 'filmowani'],
    'SEO/SEM': ['seo', 'sem', 'google ads', 'pozycjonowani'],
  },
  'Usługi i inne': {
    'Sprzątanie obiektów': ['sprzątacz', 'sprzątani', 'utrzymania czystości', 'utrzymanie czystości', 'porządkow'],
    'Ochrona mienia': ['ochroniarz', 'ochrony fizycznej', 'dozór', 'dozoru', 'kwalifikowany pracownik ochrony', 'portier'],
    'Ogrodnictwo i zieleń': ['ogrodnik', 'ogrodnicz', 'pielęgnacja zieleni', 'pielęgnacji zieleni', 'koszeni'],
    'Rolnictwo': ['rolnicz', 'rolnik', 'zbiory', 'gospodarstw'],
    'Krawiectwo': ['krawiec', 'krawcow', 'szyci'],
    'Praca przy taśmie / pakowanie': ['pakowacz', 'taśmie produkcyjnej', 'sortowani', 'etykietowani'],
    'Kierowanie zespołem': ['kierownik', 'brygadzist', 'lider zespołu', 'zarządzanie zespołem', 'zarządzania zespołem', 'koordynator'],
  },
};


/* ---------- AUTO-WYKRYWANIE KOMPETENCJI ---------- */
const CUE = /(?:znajomość|znajomości|obsługa|obsługi|uprawnienia|uprawnień|kurs|certyfikat|licencja|umiejętność|doświadczenie w|biegłość w)\s+([a-ząćęłńóśźż0-9#+][a-ząćęłńóśźż0-9#+./-]*(?:\s+[a-ząćęłńóśźż0-9#+][a-ząćęłńóśźż0-9#+./-]*){0,2})/gi;

const STOP = new Set(('i,oraz,w,we,z,ze,na,do,od,po,za,o,u,dla,przy,pod,jest,są,lub,albo,nie,się,' +
  'pracy,pracę,praca,firmie,firmy,osoby,osób,godzin,umowy,mile,widziane,widziana,min,itp,np,tym,' +
  'zakresu,zakresie,obszarze,poziomie,stopniu,warunkiem,atutem,plusem,wymagana,wymagane,dobra,dobrej,bardzo,' +
  'zawodzie,zawodu,podobnym,podobnego,stanowisku,stanowiska,branży,branża,doświadczenie,doświadczenia,' +
  'presją,presja,wózków,wózkami,schematów,czytania,czytanie,obsługi,obsługa,znajomość,znajomości,' +
  'innych,inne,każdym,swojej,swojego,naszej,naszego,ważne,gotowość,gotowości,umiejętność,umiejętności').split(','));


const MAX_AUTO = 150;

const BAD_LAST = new Set(('nad,pod,przy,dla,do,od,po,za,bez,sobie,zgodnie,wyłącznie,powyżej,poniżej,' +
  'związanych,związane,dotyczących,dotyczące,oraz,czy,jako,typu,wobec,według,celu,ramach').split(','));
const BAD_FIRST = new Set(('wykonywania,wykonywanie,radzenia,radzenie,prowadzenia,prowadzenie,' +
  'nadzór,nadzoru,kontrola,kontroli,zagadnień,zagadnienia,najlepszych,ustawy,ustaw,programu,podstawowych,' +
  'innych,inne,pozostałych,wszystkich,klienta,klientów,zespole,zespołu,numerze,numeru').split(','));

function cleanPhrase(p) {
  const words = p.toLowerCase().trim().split(/\s+/);
  while (words.length && STOP.has(words.at(-1))) words.pop();
  while (words.length && STOP.has(words.at(0))) words.shift();
  if (!words.length) return null;
  /* fraza nie moze konczyc sie ani zaczynac slowem wymagajacym kontynuacji */
  if (BAD_LAST.has(words.at(-1))) return null;
  if (BAD_FIRST.has(words.at(0))) return null;
  /* frazy z cyframi lub krotsze niz 4 znaki = smieci */
  const joined = words.join(' ');
  if (joined.length < 4) return null;
  if (/[0-9]/.test(joined)) return null;
  /* pojedyncze slowo w przypadku zaleznym = odrzuc */
  if (words.length === 1) {
    const w = words.at(0);
    const badEnd = ['ym', 'im', 'ego', 'emu', 'ach', 'ami', 'ą', 'ę', 'em', 'owi', 'ów'];
    for (const e of badEnd) {
      if (w.endsWith(e)) return null;
    }
  }
  return joined;
}



function mineSkills(items) {
  /* prog zalezny od wielkosci bazy: 3 przy malej, wiecej przy duzej */
  const minOffers = Math.max(3, Math.round(items.length / 1500));
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
      if (!overlaps) {
        for (const w of p.split(' ')) {
          for (const k of known) {
            if (w.length > 4 && (k.includes(w.slice(0, 5)) || w.includes(k))) { overlaps = true; break; }
          }
          if (overlaps) break;
        }
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
   result.push({ name, keywords: [item.phrase], regexes: [kwToRegex(item.phrase)], cat: bestCat });
   
  }
  console.log('Auto-skille: ' + result.length + ' (prog: ' + minOffers + ' ofert)');
  return result;
}

/* ---------- DOPASOWANIE Z GRANICAMI SLOW ---------- */
const PL_CHARS = 'a-ząćęłńóśźż0-9';

function kwToRegex(kw) {
  const k = kw.trim().toLowerCase();
  const esc = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  /* lewa granica zawsze; prawa tylko dla krotkich fraz (sep, adr, qa, ce, hr, seo, vat...) */
  const right = k.length <= 4 ? `(?![${PL_CHARS}])` : '';
  return new RegExp(`(?<![${PL_CHARS}#+])${esc}${right}`, 'i');
}

/* prekompilacja slownika (raz, przy starcie) */
const SKILL_REGEX = {};
for (const [catName, skills] of Object.entries(SKILL_DEFS)) {
  SKILL_REGEX[catName] = {};
  for (const [skillName, kws] of Object.entries(skills)) {
    SKILL_REGEX[catName][skillName] = kws.map(kwToRegex);
  }
}

function detectSkills(text, autoSkills) {
  const t = text.toLowerCase();
  const found = [];
  for (const skills of Object.values(SKILL_REGEX)) {
    for (const [skillName, regexes] of Object.entries(skills)) {
      if (regexes.some(re => re.test(t))) found.push(skillName);
    }
  }
  for (const a of autoSkills) {
    if (a.regexes
      ? a.regexes.some(re => re.test(t))
      : a.keywords.some(k => t.includes(k))) found.push(a.name);
  }
  return found;
}


/* przypisanie kategorii po tresci oferty */
function categoryFor(text) {
  const t = text.toLowerCase();
  let bestCat = 'Biuro i administracja';
  let bestN = 0;
  for (const catName of Object.keys(SKILL_REGEX)) {
    let n = 0;
    for (const regexes of Object.values(SKILL_REGEX[catName])) {
      if (regexes.some(re => re.test(t))) n += 1;
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
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
}
/* wynagrodzenie: zwraca np. "5 000 - 7 000 zł" albo null */
function formatSalary(min, max) {
  const f = n => Math.round(n).toLocaleString('pl-PL');
  if (min && max && min !== max) return f(min) + ' - ' + f(max) + ' zł';
  if (min) return f(min) + ' zł';
  if (max) return 'do ' + f(max) + ' zł';
  return null;
}
/* Adzuna czasem podaje kwoty roczne lub smieciowe - odsiewamy niewiarygodne */
function formatAdzunaSalary(min, max) {
  const lo = min || max;
  const hi = max || min;
  if (!lo) return null;
  if (hi / lo > 20) return null;   /* absurdalne widelki, np. 2256 - 2244000 */
  if (hi > 60000) return null;     /* powyzej 60 tys./mies. = dane roczne/niewiarygodne */
  return formatSalary(min, max);
}

/* zarobki z Careerjet: np. "zl33 per hour" -> "33 zł/godz." */
function normalizeCareerjetSalary(s) {
  if (!s) return null;
  const t = String(s).replace(/<[^>]*>/g, ' ');
  const nums = t.replace(/,(?=\d{3})/g, '').match(/\d+(?:\.\d+)?/g);
  if (!nums || !nums.length) return null;
  const f = n => Math.round(parseFloat(n)).toLocaleString('pl-PL');
  let kwota = (nums.length >= 2 && nums.at(0) !== nums.at(1))
    ? f(nums.at(0)) + ' - ' + f(nums.at(1))
    : f(nums.at(0));
  let okres = '';
  if (/hour|godz/i.test(t)) okres = '/godz.';
  else if (/week|tydz/i.test(t)) okres = '/tydz.';
  else if (/year|annum|rocz/i.test(t)) okres = '/rok';
  return kwota + ' zł' + okres;
}

function pause(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
/* ---------- ZRODLO 3: CBOP - urzedy pracy (pelne tresci) ---------- */
function daysAgoPL(dateStr) {
  /* format "20.07.2026" */
  if (!dateStr) return null;
  const m = String(dateStr).match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return null;
  const d = new Date(Number(m.at(3)), Number(m.at(2)) - 1, Number(m.at(1)));
  if (isNaN(d.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
}

async function fetchCBOP() {
  const out = [];
  for (let page = 0; page <= 500; page++) {
    try {
      const resp = await fetch('https://oferty.praca.gov.pl/portal-api/v3/oferta/wyszukiwanie?page=' + page + '&size=50', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: '{}',
      });
      if (!resp.ok) { console.error('CBOP str. ' + page + ': HTTP ' + resp.status); break; }
      const data = await resp.json();
      const results = (data.payload && data.payload.ofertyPracyPage && data.payload.ofertyPracyPage.content) || [];
      if (!results.length) break;
      for (const r of results) {
        if (r.typOfertyEnum && r.typOfertyEnum !== 'OFERTA_PRACY') continue;
        const age = daysAgoPL(r.dataDodaniaCbop);
        if (age !== null && age > MAX_AGE_DAYS) continue;
        out.push({
          title: r.stanowisko || 'Oferta pracy',
          company: r.pracodawca || '',
          location: r.miejscePracy || '',
          text: (r.stanowisko || '') + '\n' + (r.zakresObowiazkow || '') + '\n' + (r.wymagania || ''),
          url: 'https://oferty.praca.gov.pl/portal/oferta/' + r.id,
          portal: 'Urzędy pracy',
          age: age,
          salary: r.wynagrodzenie ? String(r.wynagrodzenie).replace(/\s*PLN/g, ' zł').trim() : null,
        });
      }
      await pause(PAUSE_MS);
    } catch (e) {
      console.error('CBOP str. ' + page + ':', e.message);
      break;
    }
  }
  console.log('CBOP: pobrano ' + out.length + ' ofert');
  return out;
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
          salary: formatAdzunaSalary(r.salary_min, r.salary_max),
        });
      }
      /* sortujemy po dacie, wiec gdy zaczely sie stare - konczymy */
      if (tooOld) { console.log('Adzuna: str. ' + page + ' - osiagnieto granice 60 dni'); break; }
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
          'Referer': 'https://rokuj.pl',
          'User-Agent': 'Mozilla/5.0 (RokujPL; +https://rokuj.pl)',
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
          salary: normalizeCareerjetSalary(r.salary),
        });
      }
      if (tooOld) { console.log('Careerjet: str. ' + page + ' - osiagnieto granice 60 dni'); break; }
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
    if (seen.has(r.url)) continue;
    /* duplikat po tresci tylko gdy znamy firme; uwzgledniamy miasto */
    const keyText = (r.title + '|' + r.company + '|' + r.location)
      .toLowerCase().replace(/\s+/g, ' ').trim();
    if (r.company && seen.has(keyText)) continue;
    seen.add(r.url);
    if (r.company) seen.add(keyText);
    out.push(r);
  }
  return out;
}

const RESCUE_RATIO = 0.6; /* ratujemy stare oferty zrodla, gdy da mniej niz 60% wczorajszego stanu */

async function syncAll() {
  if (syncing) { console.log('Sync: juz trwa, pomijam'); return; }
  syncing = true;
  console.log('=== SYNC START ' + new Date().toISOString() + ' ===');
  try {
    const cbop = SOURCES_ENABLED['Urzędy pracy'] ? await fetchCBOP() : [];
    const careerjet = SOURCES_ENABLED['Careerjet'] ? await fetchCareerjet() : [];
    const adzuna = SOURCES_ENABLED['Adzuna'] ? await fetchAdzuna() : [];
    const fresh = dedupe(cbop.concat(careerjet).concat(adzuna));
    console.log('Sync: pobrano ' + fresh.length + ' unikalnych ofert');

    /* ile ofert per zrodlo: teraz vs poprzednio */
    const freshPer = {};
    for (const r of fresh) freshPer[r.portal] = (freshPer[r.portal] || 0) + 1;
    const oldPer = {};
    for (const j of (DATA.jobs || [])) oldPer[j.portal] = (oldPer[j.portal] || 0) + 1;

    /* zrodla z czkawka */
    const rescue = new Set();
    for (const portal of Object.keys(oldPer)) {
            if (!SOURCES_ENABLED[portal]) continue;  /* zrodlo wylaczone celowo - nie ratuj */
      const oldN = oldPer[portal];
      const newN = freshPer[portal] || 0;
      if (oldN >= 200 && newN < oldN * RESCUE_RATIO) {
        rescue.add(portal);
        console.log('Sync: UWAGA - ' + portal + ' dal tylko ' + newN +
          ' ofert (bylo ' + oldN + '). Ratuje wczorajsze oferty tego zrodla.');
      }
    }

    /* klucze nowych ofert - zeby uratowane sie nie dublowaly */
    const seen = new Set();
    for (const r of fresh) {
      seen.add(r.url);
      if (r.company) {
        seen.add((r.title + '|' + r.company + '|' + r.location)
          .toLowerCase().replace(/\s+/g, ' ').trim());
      }
    }

    const now = Date.now();
    const kept = [];
    for (const j of (DATA.jobs || [])) {
      if (!rescue.has(j.portal)) continue;
      const posted = j.posted ? new Date(j.posted).getTime() : null;
      const age = (posted !== null && !isNaN(posted))
        ? Math.floor((now - posted) / 86400000)
        : (j.age != null ? j.age + 1 : null);
      if (age !== null && age > MAX_AGE_DAYS) continue;
      if (seen.has(j.url)) continue;
      const keyText = (j.title + '|' + j.company + '|' + j.location)
        .toLowerCase().replace(/\s+/g, ' ').trim();
      if (j.company && seen.has(keyText)) continue;
      seen.add(j.url);
      if (j.company) seen.add(keyText);
      const copy = Object.assign({}, j);
      copy.age = age;
      if (!copy.posted) copy.posted = new Date(now - (age || 0) * 86400000).toISOString();
      kept.push(copy);
    }
    if (kept.length) console.log('Sync: uratowano ' + kept.length + ' ofert z poprzedniej bazy');

    await analyzeAll(fresh);   /* AI czyta nowe oferty (stare bierze z cache) */

    const jobs = [];
    for (const r of fresh) {
      jobs.push({
        title: r.title,
        company: r.company,
        location: r.location,
        remote: /zdaln|remote|home office/i.test(r.text),
        portal: r.portal,
        url: r.url,
        skills: r.ai ? Array.from(new Set(r.ai.skills.map(s => s.k))) : detectSkills(r.text, []),
        skillsOrig: r.ai ? r.ai.skills : [],
        edu: r.ai ? r.ai.edu : null,
        age: r.age,
        posted: new Date(now - (r.age || 0) * 86400000).toISOString(),
        salary: r.salary || (r.ai && r.ai.salary) || null,
      });
    }
    for (const j of kept) jobs.push(j);

    const cats = baseCats();
    for (const r of fresh) {
      if (!r.ai) continue;
      for (const s of r.ai.skills) {
        if (!cats[s.cat]) cats[s.cat] = [];
        if (!cats[s.cat].includes(s.k)) cats[s.cat].push(s.k);
      }
    }

    const perPortal = {};
    for (const j of jobs) perPortal[j.portal] = (perPortal[j.portal] || 0) + 1;
    console.log('=== SYNC OK: ' + jobs.length + ' ofert (nowych: ' + fresh.length +
      ', uratowanych: ' + kept.length + '), zrodla: ' + JSON.stringify(perPortal) + ' ===');

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
/* reczne uruchomienie synchronizacji (tylko z haslem) */
const SYNC_TOKEN = process.env.SYNC_TOKEN;
app.get('/api/sync', (req, res) => {
  if (!SYNC_TOKEN || req.query.haslo !== SYNC_TOKEN) {
    return res.status(403).json({ blad: 'Brak dostępu' });
  }
  if (syncing) {
    return res.json({ info: 'Synchronizacja już trwa', ofert: DATA.jobs.length });
  }
  syncAll();
  res.json({ info: 'Synchronizacja uruchomiona w tle. Postęp sprawdzisz pod /api/status' });
});

/* ---------- START ---------- */
app.listen(PORT, () => {
  console.log('Serwer dziala: http://localhost:' + PORT);
  if (!loadFromFile()) {
    console.log('Start: brak jobs.json - uruchamiam pierwsza synchronizacje...');
    syncAll();
  }
});
