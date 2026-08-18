/* ai.js - modul AI: czyta oferty, wyciaga kompetencje, wyksztalcenie i stawki (z cache) */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { allItems } = require('./taxonomy');

const KEY = process.env.OPENAI_API_KEY;
const MODEL = 'gpt-4o-mini';
const CACHE_FILE = path.join(__dirname, 'ai-cache.json');
const MAX_NEW_PER_SYNC = 3000;  /* bezpiecznik budzetu */
const AI_PAUSE_MS = 120;

const KATEGORIE = ['Kompetencje uniwersalne', 'Języki obce', 'IT i programowanie',
  'Produkcja i technika', 'Budownictwo', 'Transport i logistyka',
  'Gastronomia i hotelarstwo', 'Medycyna i opieka', 'Edukacja i szkolenia',
  'Finanse i ubezpieczenia', 'Sprzedaż i obsługa klienta', 'Biuro i administracja',
  'Marketing i media', 'Usługi i inne'];

/* ---------- SYNONIMY -> NAZWA KANONICZNA (bedziemy rozbudowywac) ---------- */
const SYNONIMY = {
  'kreatywnosc': 'Kreatywność', 'kreatywność': 'Kreatywność',
  'twórcze podejście': 'Kreatywność', 'twórcze myślenie': 'Kreatywność',
  'pomysłowość': 'Kreatywność', 'postawa kreatywna': 'Kreatywność',
  'komunikatywność': 'Komunikatywność', 'umiejętności komunikacyjne': 'Komunikatywność',
  'dobra komunikacja': 'Komunikatywność', 'łatwość nawiązywania kontaktów': 'Komunikatywność',
  'praca w zespole': 'Praca w zespole', 'umiejętność pracy w zespole': 'Praca w zespole',
  'współpraca w zespole': 'Praca w zespole', 'praca zespołowa': 'Praca w zespole',
  'samodzielność': 'Samodzielność', 'samodzielność w pracy': 'Samodzielność',
  'dyspozycyjność': 'Dyspozycyjność',
  'odporność na stres': 'Odporność na stres', 'praca pod presją': 'Odporność na stres',
  'radzenie sobie ze stresem': 'Odporność na stres', 'praca pod presją czasu': 'Odporność na stres',
  'zaangażowanie': 'Zaangażowanie', 'motywacja do pracy': 'Zaangażowanie',
  'dokładność': 'Dokładność i sumienność', 'sumienność': 'Dokładność i sumienność',
  'skrupulatność': 'Dokładność i sumienność', 'rzetelność': 'Dokładność i sumienność',
  'staranność': 'Dokładność i sumienność', 'dbałość o szczegóły': 'Dokładność i sumienność',
  'punktualność': 'Punktualność',
  'dobra organizacja pracy': 'Dobra organizacja pracy', 'organizacja pracy': 'Dobra organizacja pracy',
  'organizacja pracy własnej': 'Dobra organizacja pracy', 'bardzo dobra organizacja pracy': 'Dobra organizacja pracy',
  'zarządzanie czasem': 'Dobra organizacja pracy', 'systematyczność': 'Dobra organizacja pracy',
  'wysoka kultura osobista': 'Wysoka kultura osobista', 'kultura osobista': 'Wysoka kultura osobista',
  'umiejętności analityczne': 'Umiejętności analityczne', 'myślenie analityczne': 'Umiejętności analityczne',
  'chęć do nauki': 'Chęć do nauki i rozwoju', 'chęć rozwoju': 'Chęć do nauki i rozwoju',
  'gotowość do nauki': 'Chęć do nauki i rozwoju', 'chęć doskonalenia umiejętności': 'Chęć do nauki i rozwoju',
  'chęć podnoszenia kwalifikacji': 'Chęć do nauki i rozwoju', 'szybkie uczenie się': 'Chęć do nauki i rozwoju',
  'obsługa komputera': 'Obsługa komputera', 'znajomość obsługi komputera': 'Obsługa komputera',
  'język angielski': 'Język angielski', 'znajomość języka angielskiego': 'Język angielski',
  'angielski': 'Język angielski',
  'język niemiecki': 'Język niemiecki', 'niemiecki': 'Język niemiecki',
  'prawo jazdy kat. b': 'Prawo jazdy kat. B', 'prawo jazdy kategorii b': 'Prawo jazdy kat. B',
  'prawo jazdy b': 'Prawo jazdy kat. B',
  'prawo jazdy kat. c': 'Prawo jazdy kat. C', 'prawo jazdy kat. c+e': 'Prawo jazdy kat. C+E',
  'obsługa kasy fiskalnej': 'Obsługa kasy fiskalnej', 'kasa fiskalna': 'Obsługa kasy fiskalnej',
  'obsługa klienta': 'Obsługa klienta', 'profesjonalna obsługa klienta': 'Obsługa klienta',
  'obsługa wózka widłowego': 'Wózek widłowy (UDT)', 'uprawnienia na wózki widłowe': 'Wózek widłowy (UDT)',
  'wózek widłowy': 'Wózek widłowy (UDT)', 'uprawnienia udt': 'Wózek widłowy (UDT)',
  'książeczka sanepidowska': 'Książeczka sanepidowska', 'książeczka do celów sanitarno-epidemiologicznych': 'Książeczka sanepidowska',
  'aktualna książeczka sanepidowska': 'Książeczka sanepidowska',
  'doświadczenie na podobnym stanowisku': 'Doświadczenie na podobnym stanowisku',
  'doświadczenie zawodowe': 'Doświadczenie na podobnym stanowisku',
  'niekaralność': 'Niekaralność', 'zaświadczenie o niekaralności': 'Niekaralność',
  'ms office': 'MS Office', 'pakiet ms office': 'MS Office', 'znajomość pakietu office': 'MS Office',
  'excel': 'Excel (zaawansowany)', 'znajomość programu excel': 'Excel (zaawansowany)',
};

function norm(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function canonical(label) {
  const n = norm(label);
  if (SYNONIMY[n]) return SYNONIMY[n];
  /* dopasowanie po poczatku frazy: "twórcze podejście do układania menu" -> "twórcze podejście" */
  for (const key of Object.keys(SYNONIMY)) {
    if (key.length >= 8 && n.startsWith(key)) return SYNONIMY[key];
  }
  const t = String(label).trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}


/* ---------- CACHE ---------- */
let cache = {};
function loadCache() {
  try { if (fs.existsSync(CACHE_FILE)) cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); }
  catch (e) { console.error('AI cache: blad odczytu, zaczynam od zera'); cache = {}; }
}
function saveCache() {
  try { fs.writeFileSync(CACHE_FILE, JSON.stringify(cache)); }
  catch (e) { console.error('AI cache: blad zapisu:', e.message); }
}
function hashText(text) {
  return crypto.createHash('md5').update(String(text)).digest('hex');
}

/* ---------- INSTRUKCJA DLA AI ---------- */
const PROMPT = 'Jestes ekspertem HR. Przeczytaj ogloszenie o prace i zwroc JSON:\n' +
  '{"kompetencje":[{"nazwa":"...","kategoria":"..."}],' +
  '"wyksztalcenie":{"poziom":"...","kierunek":"..."} albo null,' +
  '"doswiadczenie":[{"dziedzina":"...","lata":liczba albo null}] albo [],' +
  '"stawka":"..." albo null}\n' +
  'ZASADY dla "kompetencje":\n' +
  '- wypisz WSZYSTKIE wymagane lub mile widziane: umiejetnosci, uprawnienia, certyfikaty, jezyki obce, technologie i cechy osobowe\n' +
  '- NIE umieszczaj tu wyksztalcenia ani doswiadczenia (maja osobne pola)\n' +
  '- "nazwa": krotko, po polsku, w mianowniku, dokladnie wg tresci (nie wymyslaj)\n' +
  '- "kategoria": wybierz JEDNA z listy: ' + KATEGORIE.join(' | ') + '\n' +
  'ZASADY dla "wyksztalcenie" (null jesli brak wymogu):\n' +
  '- "poziom": podstawowe | zawodowe | srednie | wyzsze\n' +
  '- "kierunek": nazwa kierunku jesli wymagany kierunkowy; null jesli dowolny\n' +
  'ZASADY dla "doswiadczenie" (pusta lista jesli brak wymogu):\n' +
  '- "dziedzina": DZIEDZINA doswiadczenia, NIGDY nazwa stanowiska (np. "spedycja", nie "spedytor"; ' +
  '"prowadzenie pojazdow", nie "kierowca")\n' +
  '- forma: krotko, mianownik, male litery, poprawna polszczyzna Z POLSKIMI ZNAKAMI ' +
  '(np. "sprzedaż", "księgowość", "obsługa klienta", "zarządzanie zespołem")\n' +
  '- NIE twórz wpisow bez tresci typu "podobne stanowisko", "branża", "technika"; ' +
  'jesli oferta wymaga tylko "doswiadczenia na podobnym stanowisku", wywnioskuj dziedzine ' +
  'z nazwy stanowiska (np. oferta dla kucharza -> "gastronomia"); jesli sie nie da - pomiń\n' +
  '- "lata": liczba lat jesli podana (np. "min. 2 lata" -> 2), inaczej null\n' +

  'ZASADY dla "stawka":\n' +
  '- tylko jesli podano kwote wynagrodzenia; przepisz np. "5 000 - 7 000 zl/mies. brutto"; brak = null';

async function askAI(text) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + KEY },
      signal: AbortSignal.timeout(60000),
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: PROMPT },
          { role: 'user', content: String(text).slice(0, 8000) },
        ],
      }),
    });
    if (resp.status === 429 && attempt < 3) {
      await new Promise(r => setTimeout(r, 15000 * attempt));
      continue;
    }
    if (!resp.ok) throw new Error('OpenAI HTTP ' + resp.status);
    const data = await resp.json();
    return JSON.parse(data.choices.at(0).message.content);
  }
}

function toResult(raw) {
  const skills = [];
  for (const k of (raw.kompetencje || [])) {
    const label = (k && k.nazwa) ? String(k.nazwa).trim() : '';
    if (!label || label.length < 3) continue;
    const cat = KATEGORIE.includes(k.kategoria) ? k.kategoria : 'Kompetencje uniwersalne';
    skills.push({ o: label, k: canonical(label), cat: cat });
  }
  let edu = null;
  if (raw.wyksztalcenie && raw.wyksztalcenie.poziom) {
    const p = norm(raw.wyksztalcenie.poziom).replace('srednie', 'średnie').replace('wyzsze', 'wyższe');
    if (['podstawowe', 'zawodowe', 'średnie', 'wyższe'].includes(p)) {
       let kier = raw.wyksztalcenie.kierunek ? norm(raw.wyksztalcenie.kierunek) : null;
      /* smieci: "null", "kierunkowe", "brak" itp. = brak konkretnego kierunku */
      if (kier && (kier === 'null' || kier === 'brak' || kier === 'kierunkowe' ||
          kier === 'dowolny' || kier === 'ogólnokształcące' || kier === 'branżowe' ||
          kier.length < 4)) kier = null;
      edu = { poziom: p, kierunek: kier };
    }
  }
    const exp = [];
  for (const d of (raw.doswiadczenie || [])) {
    if (!d || !d.dziedzina) continue;
    const dz = norm(d.dziedzina);
    if (dz.length < 3 || dz.length > 40) continue;
    exp.push({ dz, lata: (typeof d.lata === 'number' && d.lata > 0 && d.lata < 30) ? d.lata : null });
  }

  const salary = raw.stawka ? String(raw.stawka).trim() : null;
  return { skills, edu, exp, salary };
}

/* ---------- GLOWNA FUNKCJA: analiza listy ofert ---------- */
async function analyzeAll(offers) {
  if (!KEY) { console.log('AI: brak klucza OPENAI_API_KEY - pomijam'); return; }
  loadCache();
  let hits = 0, calls = 0, errors = 0;
  for (const o of offers) {
    const h = hashText(o.text);
    if (cache[h]) { o.ai = cache[h]; hits += 1; continue; }
    if (calls >= MAX_NEW_PER_SYNC) continue;
    try {
      const raw = await askAI(o.text);
      o.ai = toResult(raw);
      cache[h] = o.ai;
      calls += 1;
      if (calls % 200 === 0) { saveCache(); console.log('AI: przeanalizowano ' + calls + ' nowych ofert...'); }
      await new Promise(r => setTimeout(r, AI_PAUSE_MS));
    } catch (e) {
      errors += 1;
      if (errors <= 3) console.error('AI blad: ' + e.message);
      if (errors >= 20) { console.error('AI: za duzo bledow, przerywam analize'); break; }
    }
  }
  saveCache();
  console.log('AI: gotowe (z cache: ' + hits + ', nowych: ' + calls + ', bledow: ' + errors + ')');
}

/* ---------- AUTOTEST: uruchom "node ai.js" ---------- */
if (require.main === module) {
  (async () => {
    const sample = [{
      text: 'Kucharz. Wymagania: wykształcenie zawodowe gastronomiczne, doświadczenie min. 2 lata na podobnym stanowisku, aktualna książeczka sanepidowska, umiejętność pracy w zespole, twórcze podejście do układania menu. Oferujemy 5500-6500 zł brutto miesięcznie.',
    }];
    await analyzeAll(sample);
    console.log(JSON.stringify(sample.at(0).ai, null, 2));
  })();
}

/* ---------- GRUPOWANIE KOMPETENCJI (drugi przebieg AI) ---------- */
const GROUPS_FILE = path.join(__dirname, 'ai-groups.json');

const GROUP_PROMPT_HEADER = 'Dostaniesz liste fraz-kompetencji z ogloszen o prace oraz zamknieta LISTE POZYCJI taksonomii. ' +
  'Kazda fraze przyporzadkuj do JEDNEJ pozycji z listy (pole "cel"). ' +
  'WAZNE: frazy o znajomosci jezykow obcych ZAWSZE mapuj na odpowiednia pozycje jezykowa z listy ' +
  '(np. "biegla znajomosc jezyka angielskiego" -> "Język angielski"; "komunikacja w jezyku angielskim" -> "Język angielski"; ' +
  'poziom znajomosci ignoruj). ' +
  'Ustaw "cel": "ODRZUC" TYLKO w dwoch przypadkach: ' +
  '(1) fraza dotyczy poziomu WYKSZTALCENIA lub dyplomu (np. "magister farmacji", "wyksztalcenie kierunkowe", "studia wyzsze"), ' +
  '(2) fraza jest tak ogolna, ze nic nie mowi (np. "inne umiejetnosci", "doswiadczenie w branzy", samo "organizacja"). ' +
  'W kazdym innym przypadku wybierz najblizsza znaczeniowo pozycje z listy. ' +
  'Zwroc JSON: {"mapa":[{"fraza":"...","cel":"..."}]}. "cel" musi byc DOKLADNIE nazwa pozycji z listy albo "ODRZUC".\n\nLISTA POZYCJI:\n';


let groups = {};   /* fraza (norm) -> nazwa grupy */
function loadGroups() {
  try { if (fs.existsSync(GROUPS_FILE)) groups = JSON.parse(fs.readFileSync(GROUPS_FILE, 'utf8')); }
  catch (e) { groups = {}; }
}
function saveGroups() {
  try { fs.writeFileSync(GROUPS_FILE, JSON.stringify(groups)); }
  catch (e) { console.error('AI groups: blad zapisu:', e.message); }
}

async function groupSkills(allNames) {
  if (!KEY) return;
  loadGroups();
  const items = allItems();
  const itemNames = items.map(x => x.item);
  const listText = itemNames.join('\n');
  const unknown = [];
  for (const n of allNames) {
    if (!groups[norm(n)]) unknown.push(n);
  }
  if (!unknown.length) { console.log('AI mapowanie: brak nowych fraz'); return; }
  console.log('AI mapowanie: ' + unknown.length + ' nowych fraz');
  for (let i = 0; i < unknown.length; i += 100) {
    const batch = unknown.slice(i, i + 100);
    try {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + KEY },
        body: JSON.stringify({
          model: MODEL,
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: GROUP_PROMPT_HEADER + listText },
            { role: 'user', content: JSON.stringify(batch) },
          ],
        }),
      });
      if (!resp.ok) throw new Error('OpenAI HTTP ' + resp.status);
      const data = await resp.json();
      const parsed = JSON.parse(data.choices.at(0).message.content);
      for (const m of (parsed.mapa || [])) {
        if (!m || !m.fraza || !m.cel) continue;
        if (m.cel === 'ODRZUC') { groups[norm(m.fraza)] = '__ODRZUC__'; continue; }
        if (itemNames.includes(m.cel)) groups[norm(m.fraza)] = m.cel;
        /* cel spoza listy = ignorujemy, fraza zostanie zmapowana nastepnym razem */
      }
    } catch (e) {
      console.error('AI mapowanie blad: ' + e.message);
    }
  }
  saveGroups();
  console.log('AI mapowanie: slownik ma ' + Object.keys(groups).length + ' fraz');
}


function groupName(name) {
  return groups[norm(name)] || name;
}
/* ---------- NORMALIZACJA KIERUNKOW WYKSZTALCENIA ---------- */
const EDU_PROMPT = 'Dostaniesz liste nazw kierunkow wyksztalcenia z ogloszen o prace (po polsku, rozne formy gramatyczne). ' +
  'Zgrupuj te oznaczajace ten sam kierunek i nadaj grupie krotka nazwe-rzeczownik (np. "pedagogika", "elektrotechnika", "budownictwo", "ekonomia", "gastronomia", "informatyka", "mechanika"). ' +
  'Fraza typu "elektryczny, elektroenergetyczny lub pokrewny" -> "elektrotechnika". ' +
  'Zwroc JSON: {"grupy":[{"nazwa":"...","frazy":["..."]}]}.';

async function normalizeEduDirs(allDirs) {
  if (!KEY) return;
  loadGroups();
  const unknown = allDirs.filter(d => !groups['EDUDIR:' + norm(d)]);
  if (!unknown.length) return;
  console.log('AI kierunki: ' + unknown.length + ' nowych do znormalizowania');
  for (let i = 0; i < unknown.length; i += 150) {
    const batch = unknown.slice(i, i + 150);
    try {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + KEY },
        body: JSON.stringify({
          model: MODEL, temperature: 0, response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: EDU_PROMPT },
            { role: 'user', content: JSON.stringify(batch) },
          ],
        }),
      });
      if (!resp.ok) throw new Error('OpenAI HTTP ' + resp.status);
      const data = await resp.json();
      const parsed = JSON.parse(data.choices.at(0).message.content);
      for (const g of (parsed.grupy || [])) {
        if (!g || !g.nazwa || !Array.isArray(g.frazy)) continue;
        for (const f of g.frazy) groups['EDUDIR:' + norm(f)] = norm(g.nazwa);
      }
    } catch (e) { console.error('AI kierunki blad: ' + e.message); }
  }
  saveGroups();
}

/* ---------- NORMALIZACJA DZIEDZIN DOSWIADCZENIA ---------- */
const EXP_PROMPT = 'Dostaniesz JSON: {"istniejace_grupy":[...],"frazy":[...]}. ' +
  '"frazy" to dziedziny doswiadczenia zawodowego z ogloszen o prace (po polsku, rozne formy, literowki, czasem inne jezyki). ' +
  'Przypisz KAZDA fraze do grupy. ZASADY: ' +
  '1) Jesli pasuje ktoras z "istniejace_grupy" (nawet w przyblizeniu) - uzyj DOKLADNIE tej nazwy. Nowa grupe utworz TYLKO, gdy zadna istniejaca nie pasuje. ' +
  '2) Nazwa grupy: SZEROKA dziedzina (poziom: "księgowość", "spawanie", "logistyka", "marketing"), 1-3 slowa, mianownik, male litery, poprawna polszczyzna Z POLSKIMI ZNAKAMI. ' +
  '3) DZIEDZINA, nie stanowisko: "spedytor międzynarodowy" -> "spedycja", "kierowca" -> "prowadzenie pojazdów", "pizzerman" -> "gastronomia". ' +
  '4) Lacz agresywnie: synonimy, odmiany gramatyczne, literowki, wersje jezykowe i mikro-specjalizacje ida do JEDNEJ grupy ("praca magazynowa", "magazynowanie", "praca na magazynie" -> "magazynowanie"; "wdrożenia erp" i "wdrażanie systemów erp" -> "wdrożenia erp"; "development" -> "rozwój oprogramowania"; "svařování" -> "spawanie"; "obsługa minikoparki", "obsługa równiarki" -> "obsługa maszyn budowlanych"). ' +
  '5) Do grupy "ODRZUC" wrzuc TYLKO frazy, z ktorych nie da sie odczytac zadnej dziedziny: ogolniki ("branża", "technika", "technologia", "analiza", "kontrola", "współpraca", "inżynieria", "konstrukcja", "instalacja", "operacje", "praca w korporacji", "podobne stanowisko"), cechy osobowe i kompetencje miekkie ("komunikatywność", "praca w zespole") oraz frazy niezrozumiale lub uciete. W razie jakichkolwiek watpliwosci NIE odrzucaj - przypisz do najblizszej szerokiej grupy. ' +
  'Zwroc JSON: {"grupy":[{"nazwa":"...","frazy":["..."]}]}.';

async function normalizeExpDirs(allDirs) {
  if (!KEY) return;
  loadGroups();
  const unknown = allDirs.filter(d => !groups['EXP:' + norm(d)]);
  if (!unknown.length) return;
  console.log('AI doswiadczenia: ' + unknown.length + ' nowych do znormalizowania');
  for (let i = 0; i < unknown.length; i += 150) {
    const batch = unknown.slice(i, i + 150);
    /* lista istniejacych nazw grup - zeby AI nie wymyslalo dubli */
    const znane = Array.from(new Set(
      Object.keys(groups).filter(k => k.startsWith('EXP:'))
        .map(k => groups[k]).filter(v => v && v !== 'ODRZUC')
    )).sort();
    try {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + KEY },
        body: JSON.stringify({
          model: MODEL, temperature: 0, response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: EXP_PROMPT },
            { role: 'user', content: JSON.stringify({ istniejace_grupy: znane, frazy: batch }) },
          ],
        }),
      });
      if (!resp.ok) throw new Error('OpenAI HTTP ' + resp.status);
      const data = await resp.json();
      const parsed = JSON.parse(data.choices.at(0).message.content);
      for (const g of (parsed.grupy || [])) {
        if (!g || !g.nazwa || !Array.isArray(g.frazy)) continue;
        const nazwa = norm(g.nazwa) === 'odrzuc' ? 'ODRZUC' : norm(g.nazwa);
        for (const f of g.frazy) groups['EXP:' + norm(f)] = nazwa;
      }
    } catch (e) { console.error('AI doswiadczenia blad: ' + e.message); }
  }
  saveGroups();
}

function eduDirName(d) {
  return groups['EDUDIR:' + norm(d)] || norm(d);
}
/* KOREKTY DZIEDZIN: reczne poprawki nakladane ZAWSZE przy odczycie -
   odporne na nadpisania slownika przez sync; ODRZUC = wpis znika z listy */
const EXP_FIX = {
  'praca':'ODRZUC','ogólne':'ODRZUC','obsługa':'ODRZUC','analiza':'ODRZUC',
  'inżynieria':'ODRZUC','przestrzeganie przepisów':'ODRZUC','zarządzanie':'ODRZUC',
  'technika':'ODRZUC','technologie':'ODRZUC','technologia':'ODRZUC',
  'praca w zespole':'ODRZUC','branża':'ODRZUC','operacje':'ODRZUC',
  'biophysics':'biofizyka','murarskie':'murarstwo','kosmetyka':'kosmetologia',
  'rachunkowość':'księgowość','leczenie':'medycyna','trybowanie mięsa':'trybowanie',
  'elektromontera':'elektryka','roboty elektryczne':'elektryka',
  'technologie ai':'sztuczna inteligencja','aplikacje ai':'sztuczna inteligencja',
  'infrastruktura ai':'sztuczna inteligencja',
  'infrastruktura':'infrastruktura it','infrastruktura centrów danych':'infrastruktura it',
  'obsługa koparek':'obsługa maszyn budowlanych','obsługa koparko-ładowarki':'obsługa maszyn budowlanych',
  'korzystanie z narzędzi cad':'cad/cam','platform danych':'inżynieria danych',
  'endpoint engineering':'zarządzanie punktami końcowymi',
  'konfiguracja platformy veeva vault':'wdrażanie systemów informatycznych',
  'praca z sap lub innymi systemami mrp':'wdrożenia erp',
  'projektowanie gier':'tworzenie gier','badania':'badania i rozwój',
  'obsługa piły panelowej':'stolarstwo','stolarka meblowa':'stolarstwo',
  'sprzedaż aut terenowych':'handel','sprzedaż drzwi':'handel','prowadzenie sklepu':'handel',
  'opieka nad ludźmi w podeszłym wieku':'opieka nad osobami starszymi',
  'praca produkcyjna':'produkcja','prace budowlane':'budownictwo','rynek budowlany':'budownictwo',
  'utrzymanie czystości':'sprzątanie','doradztwo strategiczne':'doradztwo','doradztwo techniczne':'doradztwo',
};
function expDirName(d) {
  let g = groups['EXP:' + norm(d)] || norm(d);
  if (EXP_FIX[g] !== undefined) g = EXP_FIX[g];
  if (g === 'ODRZUC' || g === 'odrzuc') return null;  /* smiec - pomijamy wpis */
  return g;
}

module.exports = { analyzeAll, groupSkills, groupName, loadGroups, normalizeEduDirs, eduDirName, normalizeExpDirs, expDirName };


