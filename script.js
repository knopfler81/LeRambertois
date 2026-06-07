/* ============================================
   LE RAMBERTOIS GRILL — script.js
   ============================================ */

// ── ID de la Google Sheet (colonne CSV publique) ──
const SHEET_ID  = '1rHIKJlpa2VUnGIYbRD84JQuqSzXu_Lgq-QPtXMPST_E';
const SHEET_GID = '0';
const CSV_URL   = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;

// ───────────────────────────────────────────
//  NAVIGATION — burger + scroll
// ───────────────────────────────────────────
const burger     = document.getElementById('burger');
const mobileMenu = document.getElementById('mobileMenu');
const navbar     = document.getElementById('navbar');

burger.addEventListener('click', () => {
  const isOpen = burger.classList.toggle('open');
  mobileMenu.classList.toggle('open', isOpen);
  burger.setAttribute('aria-expanded', isOpen);
  document.body.style.overflow = isOpen ? 'hidden' : '';
});

// Fermer le menu mobile au clic sur un lien
mobileMenu.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    burger.classList.remove('open');
    mobileMenu.classList.remove('open');
    burger.setAttribute('aria-expanded', false);
    document.body.style.overflow = '';
  });
});

// Navbar scrolled
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 60);
}, { passive: true });

// ───────────────────────────────────────────
//  BRAISES ANIMÉES
// ───────────────────────────────────────────
function createEmbers() {
  const container = document.querySelector('.embers');
  if (!container) return;
  const count = 18;
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'ember';
    const left     = Math.random() * 100;
    const duration = 4 + Math.random() * 6;
    const delay    = Math.random() * 8;
    const drift    = (Math.random() - 0.5) * 120 + 'px';
    const size     = 2 + Math.random() * 3;
    el.style.cssText = `
      left: ${left}%;
      width: ${size}px; height: ${size}px;
      animation-duration: ${duration}s;
      animation-delay: ${delay}s;
      --drift: ${drift};
    `;
    container.appendChild(el);
  }
}
createEmbers();

// ───────────────────────────────────────────
//  REVEAL AU SCROLL (IntersectionObserver)
// ───────────────────────────────────────────
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

// ───────────────────────────────────────────
//  PARSE CSV (gère les guillemets RFC 4180)
// ───────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = splitCSVLine(lines[0]).map(h => h.trim().toLowerCase());

  return lines.slice(1).map(line => {
    const vals = splitCSVLine(line);
    const obj  = {};
    headers.forEach((h, i) => {
      obj[h] = (vals[i] || '').trim();
    });
    return obj;
  }).filter(row => Object.values(row).some(v => v !== ''));
}

function splitCSVLine(line) {
  const result = [];
  let cur = '', inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

// ───────────────────────────────────────────
//  AFFICHAGE MENU DEPUIS LA SHEET
// ───────────────────────────────────────────
/*
  Structure attendue dans la Sheet (colonnes flexibles) :
  - categorie  : ex "Entrées", "Grillades", "Desserts"
  - nom        : nom du plat
  - description: description courte (optionnel)
  - prix       : ex "12.50" ou "12,50" ou "12.50€"

  Les colonnes peuvent être dans n'importe quel ordre.
  Le script s'adapte aux noms de colonnes en minuscules.
*/

let allItems = [];
let activeCategory = 'all';

async function loadMenu() {
  const grid    = document.getElementById('menuGrid');
  const tabsEl  = document.getElementById('menuTabs');
  const loading = document.getElementById('menuLoading');

  try {
    const resp = await fetch(CSV_URL);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const text = await resp.text();
    allItems   = parseCSV(text);

    // Détecter les colonnes (synonymes tolérés)
    const colMap = detectColumns(allItems[0] || {});

    loading.style.display = 'none';

    if (allItems.length === 0) {
      grid.innerHTML = '<p class="menu-loading">Aucun plat trouvé dans la feuille.</p>';
      return;
    }

    // Construire les catégories
    const cats = ['Tout', ...new Set(
      allItems.map(r => formatCell(r[colMap.cat])).filter(Boolean)
    )];

    tabsEl.innerHTML = cats.map((c, i) => `
      <button class="tab-btn${i === 0 ? ' active' : ''}"
              data-cat="${c}">${c}</button>
    `).join('');

    tabsEl.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        tabsEl.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeCategory = btn.dataset.cat;
        renderCards(colMap);
      });
    });

    renderCards(colMap);

  } catch (err) {
    loading.innerHTML = `
      <p>Impossible de charger le menu (${err.message}).<br>
      Vérifiez que la feuille est bien partagée en lecture publique.</p>`;
    console.error('Erreur chargement menu:', err);
  }
}

function detectColumns(firstRow) {
  const keys = Object.keys(firstRow);
  const find  = (...candidates) =>
    keys.find(k => candidates.some(c => k.includes(c))) || candidates[0];

  return {
    cat:  find('catégorie', 'categorie', 'category', 'type', 'section'),
    nom:  find('nom', 'name', 'plat', 'intitulé', 'intitule', 'titre'),
    desc: find('description', 'desc', 'détail', 'detail', 'info'),
    prix: find('prix', 'price', 'tarif', 'coût', 'cout'),
  };
}

function formatCell(val) {
  return (val || '').replace(/^["']|["']$/g, '').trim();
}

function formatPrice(val) {
  if (!val) return '';
  val = formatCell(val).replace(',', '.').replace('€', '').trim();
  const n = parseFloat(val);
  return isNaN(n) ? val : n.toFixed(2).replace('.', ',') + ' €';
}

function renderCards(colMap) {
  const grid = document.getElementById('menuGrid');
  const filtered = activeCategory === 'Tout'
    ? allItems
    : allItems.filter(r => formatCell(r[colMap.cat]) === activeCategory);

  if (filtered.length === 0) {
    grid.innerHTML = '<p class="menu-loading">Aucun élément dans cette catégorie.</p>';
    return;
  }

  grid.innerHTML = filtered.map(row => {
    const nom  = formatCell(row[colMap.nom])  || '—';
    const desc = formatCell(row[colMap.desc]) || '';
    const prix = formatPrice(row[colMap.prix]);
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

  // Observer les nouvelles cartes
  grid.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
}

// ───────────────────────────────────────────
//  DONNÉES INFOS DEPUIS LA SHEET
// ───────────────────────────────────────────
/*
  Si la sheet contient des lignes avec une colonne "type" = "info" ou "horaire",
  on les injecte dans les cartes d'infos. Sinon, les données fallback restent.
*/
function injectInfosFromSheet(rows) {
  // Chercher une ligne avec le téléphone
  const telRow = rows.find(r =>
    Object.values(r).some(v => /^0[0-9]{1}\s?[0-9]{2}/.test(formatCell(v)))
  );
  if (telRow) {
    const tel = Object.values(telRow).find(v => /^0[0-9]/.test(formatCell(v)));
    if (tel) {
      const telEl = document.getElementById('infoTel');
      if (telEl) {
        const clean = formatCell(tel).replace(/\s/g, '');
        telEl.href        = `tel:${clean}`;
        telEl.textContent = formatCell(tel);
      }
    }
  }
}

// ───────────────────────────────────────────
//  INIT
// ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadMenu();

  // Smooth scroll sur les ancres natives (fallback si CSS scroll-behavior absent)
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const target = document.querySelector(a.getAttribute('href'));
      if (target) {
        e.preventDefault();
        const offset = document.getElementById('navbar').offsetHeight;
        const top    = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });
});
