let recipes = [], installPrompt;
const cards = document.getElementById('cards');
const search = document.getElementById('search');
const detail = document.getElementById('detail');
const detailContent = document.getElementById('detailContent');
const clearBtn = document.getElementById('clearBtn');
const empty = document.getElementById('empty');
const categoryChips = document.getElementById('categoryChips');
const featuredRecipe = document.getElementById('featuredRecipe');
const infoDialog = document.getElementById('infoDialog');
const favorites = new Set(JSON.parse(localStorage.getItem('rodinnaKucharkaFavorites') || '[]'));
let activeCategory = '';
let activeView = 'home';

const categoryIcons = {
  'Kynuté a pečivo':'🥐','Chléb a pečivo':'🍞','Vánoční cukroví':'🍪','Dezerty':'🍮',
  'Zákusky':'🍰','Dorty':'🎂','Polévky':'🥣','Hlavní jídla':'🍲','Nepečené':'🍫'
};

window.addEventListener('load', () => setTimeout(() => document.getElementById('splash').classList.add('hide'), 700));

fetch('recipes.json')
  .then(r => { if (!r.ok) throw new Error('Nepodarilo sa načítať recepty.'); return r.json(); })
  .then(data => { recipes = data; buildCategories(); renderFeatured(); render(); })
  .catch(err => { cards.innerHTML = `<p>${esc(err.message)}</p>`; });

function esc(value=''){return String(value).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function saveFavorites(){localStorage.setItem('rodinnaKucharkaFavorites',JSON.stringify([...favorites]));}
function iconFor(category){return categoryIcons[category] || '📖';}

function buildCategories(){
  const categories=[...new Set(recipes.map(r=>r.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'sk'));
  categoryChips.innerHTML = `<button class="category-chip active" data-category=""><span>✨</span>Všetky</button>` + categories.map(c=>`<button class="category-chip" data-category="${esc(c)}"><span>${iconFor(c)}</span>${esc(c)}</button>`).join('');
  categoryChips.querySelectorAll('.category-chip').forEach(btn=>btn.addEventListener('click',()=>setCategory(btn.dataset.category)));
}

function setCategory(cat){
  activeCategory=cat;
  activeView='recipes';
  updateNavigation('recipes');
  categoryChips.querySelectorAll('.category-chip').forEach(btn=>btn.classList.toggle('active',btn.dataset.category===cat));
  document.getElementById('listTitle').textContent=cat || 'Všetky recepty';
  document.getElementById('listLabel').textContent=cat ? 'Vybraná kategória' : 'Naša zbierka';
  render();
  document.querySelector('.recipes-section').scrollIntoView({behavior:'smooth',block:'start'});
}

function renderFeatured(){
  if(!recipes.length)return;
  const dayNumber=Math.floor(Date.now()/86400000);
  const r=recipes[dayNumber%recipes.length];
  featuredRecipe.innerHTML=`<article class="featured-card" onclick="openRecipe('${esc(r.id)}')">
    <div class="featured-image" style="background-image:url('images/${encodeURIComponent(r.source)}')"></div>
    <div class="featured-copy"><span class="tag">${iconFor(r.category)} ${esc(r.category)}</span><h3>${esc(r.name)}</h3><p>${r.time?`Príprava približne ${esc(r.time)}.`:'Rodinný recept z pôvodného zošita.'}</p><span class="open-link">Otvoriť recept →</span></div>
  </article>`;
}

function filteredRecipes(){
  const q=search.value.toLocaleLowerCase('sk').trim();
  return recipes.filter(r=>{
    const hay=[r.name,r.author,r.category,...(r.ingredients||[]),r.method].join(' ').toLocaleLowerCase('sk');
    return (!q||hay.includes(q)) && (!activeCategory||r.category===activeCategory) && (activeView!=='favorites'||favorites.has(r.id));
  });
}

function render(){
  const filtered=filteredRecipes();
  document.getElementById('stats').textContent=`${filtered.length} z ${recipes.length} receptov`;
  clearBtn.hidden=!(search.value||activeCategory||activeView==='favorites');
  empty.hidden=filtered.length!==0;
  cards.innerHTML=filtered.map(r=>`<article class="recipe-card" onclick="openRecipe('${esc(r.id)}')">
    <div class="recipe-thumb" style="background-image:url('images/${encodeURIComponent(r.source)}')">
      <span class="category-badge">${iconFor(r.category)} ${esc(r.category)}</span>
      <button class="favorite ${favorites.has(r.id)?'on':''}" onclick="toggleFavorite('${esc(r.id)}',event)" aria-label="Obľúbené">${favorites.has(r.id)?'♥':'♡'}</button>
    </div>
    <div class="recipe-body"><h3>${esc(r.name)}</h3><div class="recipe-meta">${r.time?`<span>⏱ ${esc(r.time)}</span>`:''}${r.temperature?`<span>🔥 ${esc(r.temperature)}</span>`:''}<span>${r.author&&r.author!=='Autor ze sešitu'?`👤 ${esc(r.author)}`:'📖 Rodinný recept'}</span></div>${r.status?`<div class="recipe-status">${esc(r.status)}</div>`:''}</div>
  </article>`).join('');
}

function toggleFavorite(id,event){event?.stopPropagation();favorites.has(id)?favorites.delete(id):favorites.add(id);saveFavorites();render();if(detail.open)openRecipe(id);}
function resetFilters(){search.value='';activeCategory='';activeView='recipes';updateNavigation('recipes');categoryChips.querySelectorAll('.category-chip').forEach(btn=>btn.classList.toggle('active',btn.dataset.category===''));document.getElementById('listTitle').textContent='Všetky recepty';document.getElementById('listLabel').textContent='Naša zbierka';render();}

search.addEventListener('input',()=>{activeView='recipes';updateNavigation('recipes');render();if(search.value)document.querySelector('.recipes-section').scrollIntoView({behavior:'smooth',block:'start'});});
clearBtn.addEventListener('click',resetFilters);
document.getElementById('allCategoriesBtn').addEventListener('click',()=>setCategory(''));

document.querySelectorAll('.nav-item').forEach(btn=>btn.addEventListener('click',()=>{
  const view=btn.dataset.view;
  if(view==='settings'){infoDialog.showModal();return;}
  activeView=view;
  updateNavigation(view);
  if(view==='home'){
    search.value='';activeCategory='';
    categoryChips.querySelectorAll('.category-chip').forEach(x=>x.classList.toggle('active',x.dataset.category===''));
    document.getElementById('listTitle').textContent='Všetky recepty';
    document.getElementById('listLabel').textContent='Naša zbierka';
    window.scrollTo({top:0,behavior:'smooth'});
  }else if(view==='favorites'){
    document.getElementById('listTitle').textContent='Obľúbené recepty';
    document.getElementById('listLabel').textContent='Tvoj výber';
    document.querySelector('.recipes-section').scrollIntoView({behavior:'smooth',block:'start'});
  }else{
    document.getElementById('listTitle').textContent=activeCategory||'Všetky recepty';
    document.getElementById('listLabel').textContent=activeCategory?'Vybraná kategória':'Naša zbierka';
    document.querySelector('.recipes-section').scrollIntoView({behavior:'smooth',block:'start'});
  }
  render();
}));
function updateNavigation(view){document.querySelectorAll('.nav-item').forEach(btn=>btn.classList.toggle('active',btn.dataset.view===view));}

function openRecipe(id){
  const r=recipes.find(x=>x.id===id); if(!r)return;
  detailContent.innerHTML=`<div class="detail-hero" style="background-image:url('images/${encodeURIComponent(r.source)}')"><div class="detail-title"><span>${iconFor(r.category)} ${esc(r.category)}</span><h2>${esc(r.name)}</h2></div></div>
  <div class="detail-content"><div class="detail-actions">${r.author?`<span class="pill">👤 ${esc(r.author)}</span>`:''}${r.temperature?`<span class="pill">🔥 ${esc(r.temperature)}</span>`:''}${r.time?`<span class="pill">⏱ ${esc(r.time)}</span>`:''}<button class="detail-fav ${favorites.has(r.id)?'on':''}" onclick="toggleFavorite('${esc(r.id)}',event)">${favorites.has(r.id)?'♥ Uložené':'♡ Obľúbené'}</button></div>
  ${r.status?`<div class="note">${esc(r.status)}${/overovať|kontrol/i.test(r.status)?' – nejasné miesta postupne overíme podľa originálu.':''}</div>`:''}
  <div class="detail-columns"><div><h3>Suroviny</h3><ul>${(r.ingredients||[]).map(i=>`<li>${esc(i)}</li>`).join('')}</ul><h3>Postup</h3><p>${esc(r.method||'Postup zatiaľ nie je prepísaný.')}</p></div><div><h3>Pôvodná stránka zo zošita</h3><img class="source" src="images/${encodeURIComponent(r.source)}" alt="Originálny recept ${esc(r.name)}"></div></div></div>`;
  detail.showModal();
}
window.openRecipe=openRecipe;window.toggleFavorite=toggleFavorite;
document.querySelector('#detail .close').addEventListener('click',()=>detail.close());
detail.addEventListener('click',e=>{if(e.target===detail)detail.close();});
document.querySelector('.info-close').addEventListener('click',()=>infoDialog.close());
infoDialog.addEventListener('click',e=>{if(e.target===infoDialog)infoDialog.close();});

window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;document.getElementById('installBtn').hidden=false;});
document.getElementById('installBtn').onclick=async()=>{if(installPrompt){installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;document.getElementById('installBtn').hidden=true;}};
window.addEventListener('appinstalled',()=>document.getElementById('installBtn').hidden=true);
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js'));
