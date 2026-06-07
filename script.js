/* ============================================
   LE RAMBERTOIS — script.js
   Deux enseignes, deux sheets
   ============================================ */

// ── Google Sheets IDs ──
const GRILL_SHEET_ID     = '1rHIKJlpa2VUnGIYbRD84JQuqSzXu_Lgq-QPtXMPST_E';
const BAGUETTE_SHEET_ID  = '1lOiwMCGxMTslq68vyWQtw07MAkPVk5nl4e7D-_okaYk';
const GID = '0';

const csvUrl = id => `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${GID}`;

// ── Navbar & burger ──
const burger     = document.getElementById('burger');
const mobileMenu = document.getElementById('mobileMenu');
const navbar     = document.getElementById('navbar');

burger.addEventListener('click', () => {
  const open = burger.classList.toggle('open');
  mobileMenu.classList.toggle('open', open);
  burger.setAttribute('aria-expanded', open);
  document.body.style.overflow = open ? 'hidden' : '';
});
mobileMenu.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => {
    burger.classList.remove('open');
    mobileMenu.classList.remove('open');
    burger.setAttribute('aria-expanded', false);
    document.body.style.overflow = '';
  });
});
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 60);
}, { passive: true });

// ── Braises ──
// function createEmbers() {
//   const c = document.querySelector('.embers');
//   if (!c) return;
//   for (let i = 0; i < 16; i++) {
//     const e = document.createElement('div');
//     e.className = 'ember';
//     const sz = 2 + Math.random() * 2.5;
//     e.style.cssText = `
//       left:${Math.random()*100}%;
//       width:${sz}px; height:${sz}px;
//       animation-duration:${4+Math.random()*7}s;
//       animation-delay:${Math.random()*9}s;
//       --drift:${(Math.random()-.5)*100}px;
//     `;
//     c.appendChild(e);
//   }
// }
createEmbers();

// ── Reveal ──
const obs = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
}, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });
document.querySelectorAll('.reveal').forEach(el => obs.observe(el));

// ── CSV parser ──
function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = splitLine(lines[0]).map(h => h.trim().toLowerCase());
  return lines.slice(1).map(line => {
    const vals = splitLine(line);
    const obj = {};
    headers.forEach((h, i) => obj[h] = (vals[i] || '').trim());
    return obj;
  }).filter(r => Object.values(r).some(v => v));
}
function splitLine(line) {
  const res = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { if (q && line[i+1]==='"'){cur+='"';i++;} else q=!q; }
    else if (c===',' && !q) { res.push(cur); cur=''; }
    else cur+=c;
  }
  res.push(cur); return res;
}
function fmt(v) { return (v||'').replace(/^["']|["']$/g,'').trim(); }
function fmtPrix(v) {
  if (!v) return '';
  const n = parseFloat(fmt(v).replace(',','.').replace('€',''));
  return isNaN(n) ? fmt(v) : n.toFixed(2).replace('.',',')+' €';
}
function detectCols(row) {
  const keys = Object.keys(row);
  const f = (...c) => keys.find(k => c.some(x => k.includes(x))) || c[0];
  return {
    cat:  f('catégorie','categorie','category','type','section'),
    nom:  f('nom','name','plat','intitulé','intitule'),
    desc: f('description','desc','détail'),
    prix: f('prix','price','tarif'),
  };
}

// ── Moteur menu générique ──
function buildMenu({ sheetId, tabsId, loadingId, gridId, isGreen }) {
  const tabs    = document.getElementById(tabsId);
  const loading = document.getElementById(loadingId);
  const grid    = document.getElementById(gridId);
  let allItems  = [], colMap = {}, activecat = 'Tout';

  fetch(csvUrl(sheetId))
    .then(r => { if (!r.ok) throw new Error('HTTP '+r.status); return r.text(); })
    .then(text => {
      allItems = parseCSV(text);
      if (!allItems.length) { loading.textContent = 'Aucun plat trouvé.'; return; }
      colMap = detectCols(allItems[0]);
      loading.style.display = 'none';

      const cats = ['Tout', ...new Set(allItems.map(r => fmt(r[colMap.cat])).filter(Boolean))];
      tabs.innerHTML = cats.map((c,i) => `
        <button class="tab-btn${isGreen?' green':''}${i===0?' active':''}" data-cat="${c}">${c}</button>
      `).join('');
      tabs.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          tabs.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          activecat = btn.dataset.cat;
          render();
        });
      });
      render();
    })
    .catch(err => { loading.textContent = `Impossible de charger la carte (${err.message}). Vérifiez que la Sheet est publique.`; });

  function render() {
    const filtered = activecat === 'Tout'
      ? allItems
      : allItems.filter(r => fmt(r[colMap.cat]) === activecat);
    if (!filtered.length) { grid.innerHTML = '<p class="menu-loading">Aucun élément.</p>'; return; }
    grid.innerHTML = filtered.map(row => {
      const nom  = fmt(row[colMap.nom])  || '—';
      const desc = fmt(row[colMap.desc]) || '';
      const prix = fmtPrix(row[colMap.prix]);
      return `
        <div class="menu-card reveal">
          <div class="menu-card-header">
            <h3>${nom}</h3>
            ${prix ? `<span class="prix">${prix}</span>` : ''}
          </div>
          ${desc ? `<p>${desc}</p>` : ''}
        </div>
      `;
    }).join('');
    grid.querySelectorAll('.reveal').forEach(el => obs.observe(el));
  }
}

// ── Smooth scroll ──
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const t = document.querySelector(a.getAttribute('href'));
    if (t) {
      e.preventDefault();
      const top = t.getBoundingClientRect().top + window.scrollY - navbar.offsetHeight;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  });
});

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  buildMenu({
    sheetId:   GRILL_SHEET_ID,
    tabsId:    'grillTabs',
    loadingId: 'grillLoading',
    gridId:    'grillGrid',
    isGreen:   false,
  });
  buildMenu({
    sheetId:   BAGUETTE_SHEET_ID,
    tabsId:    'baguetteTabs',
    loadingId: 'baguetteLoading',
    gridId:    'baguetteGrid',
    isGreen:   true,
  });
});
