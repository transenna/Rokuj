/* test-careerjet.js – diagnoza paginacji Careerjet */
require('dotenv').config();
const KEY = process.env.CAREERJET_API_KEY;
const auth = 'Basic ' + Buffer.from(KEY + ':').toString('base64');

(async () => {
  const seen = new Set();
  for (let page = 1; page <= 12; page++) {
    const url = 'https://search.api.careerjet.net/v4/query' +
      '?locale_code=pl_PL&sort=date&pagesize=50&page=' + page +
      '&user_ip=146.59.12.98&user_agent=' + encodeURIComponent('Mozilla/5.0 (RokujPL)');
    const resp = await fetch(url, {
      headers: {
        'Authorization': auth,
        'Referer': 'https://rokuj.pl',
        'User-Agent': 'Mozilla/5.0 (RokujPL; +https://rokuj.pl)',
      },
    });
    if (!resp.ok) { console.log('str. ' + page + ': HTTP ' + resp.status); break; }
    const data = await resp.json();
    const jobs = data.jobs || [];
    let nowe = 0;
    for (const j of jobs) { if (!seen.has(j.url)) { seen.add(j.url); nowe++; } }
    console.log('str. ' + page + ': ofert ' + jobs.length + ', w tym NOWYCH ' + nowe +
      ' | lacznie w bazie Careerjet: hits=' + (data.hits ?? '?') + ', stron=' + (data.pages ?? '?'));
    await new Promise(r => setTimeout(r, 400));
  }
  console.log('=== Unikalnych ofert po 12 stronach: ' + seen.size + ' ===');
})();
