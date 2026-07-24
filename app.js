
let recipes=[], installPrompt;
const cards=document.getElementById('cards'), search=document.getElementById('search'), category=document.getElementById('category');
const detail=document.getElementById('detail'), detailContent=document.getElementById('detailContent');

fetch('recipes.json').then(r=>r.json()).then(data=>{
  recipes=data;
  [...new Set(recipes.map(r=>r.category))].sort().forEach(c=>{
    const o=document.createElement('option');o.value=c;o.textContent=c;category.appendChild(o);
  });
  render();
});

function esc(s=''){return s.replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function render(){
  const q=search.value.toLowerCase().trim(), cat=category.value;
  const filtered=recipes.filter(r=>{
    const hay=[r.name,r.author,r.category,...r.ingredients,r.method].join(' ').toLowerCase();
    return (!q||hay.includes(q))&&(!cat||r.category===cat);
  });
  document.getElementById('stats').textContent=`${filtered.length} receptů z ${recipes.length}`;
  cards.innerHTML=filtered.map(r=>`
    <article class="card" onclick="openRecipe('${r.id}')">
      <div class="thumb" style="background-image:url('images/${r.source}')"><span class="badge">${esc(r.category)}</span></div>
      <div class="cardbody"><h3>${esc(r.name)}</h3><div class="meta">Autor: ${esc(r.author)}</div>
      <div class="status">${esc(r.status)}</div></div>
    </article>`).join('');
}
search.addEventListener('input',render); category.addEventListener('change',render);

function openRecipe(id){
  const r=recipes.find(x=>x.id===id);
  detailContent.innerHTML=`<div class="detailwrap">
    <h2>${esc(r.name)}</h2>
    <span class="pill">${esc(r.category)}</span><span class="pill">Autor: ${esc(r.author)}</span>
    ${r.temperature?`<span class="pill">🔥 ${esc(r.temperature)}</span>`:''}
    ${r.time?`<span class="pill">⏱ ${esc(r.time)}</span>`:''}
    <div class="note">⚠️ ${esc(r.status)} – nejasná místa budeme postupně ověřovat podle originálu.</div>
    <div class="cols">
      <div><h3>Suroviny</h3><ul>${r.ingredients.map(i=>`<li>${esc(i)}</li>`).join('')}</ul><h3>Postup</h3><p>${esc(r.method)}</p></div>
      <div><h3>Původní stránka</h3><img class="source" src="images/${r.source}" alt="Originální recept"></div>
    </div>
  </div>`;
  detail.showModal();
}

window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;document.getElementById('installBtn').hidden=false});
document.getElementById('installBtn').onclick=async()=>{if(installPrompt){installPrompt.prompt();installPrompt=null}};
if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
