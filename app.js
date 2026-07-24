const SUPABASE_URL = 'https://mbgdesaueodahxwmydnn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_lNHmPFBuqHZYcKov9QmprQ_oIq1Jry9';
const supabaseClient = window.supabase;
const cloudAvailable = Boolean(supabaseClient && typeof supabaseClient.createClient === 'function');
const supabase = cloudAvailable ? supabaseClient.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

let recipes = [], localRecipes = [], installPrompt, currentUser = null, confirmations = [];
const cards = document.getElementById('cards');
const search = document.getElementById('search');
const detail = document.getElementById('detail');
const detailContent = document.getElementById('detailContent');
const clearBtn = document.getElementById('clearBtn');
const empty = document.getElementById('empty');
const categoryChips = document.getElementById('categoryChips');
const featuredRecipe = document.getElementById('featuredRecipe');
const infoDialog = document.getElementById('infoDialog');
const authDialog = document.getElementById('authDialog');
const addDialog = document.getElementById('addDialog');
const accountBtn = document.getElementById('accountBtn');
const addRecipeBtn = document.getElementById('addRecipeBtn');
const favorites = new Set(JSON.parse(localStorage.getItem('rodinnaKucharkaFavorites') || '[]'));
let activeCategory = '', activeView = 'home';

function openDialog(dialog) {
  if (!dialog) return;
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
}
function closeDialog(dialog) {
  if (!dialog) return;
  if (typeof dialog.close === 'function') dialog.close();
  else dialog.removeAttribute('open');
}

const categoryIcons = {'Kynuté a pečivo':'🥐','Chléb a pečivo':'🍞','Vánoční cukroví':'🍪','Dezerty':'🍮','Zákusky':'🍰','Dorty':'🎂','Polévky':'🥣','Hlavní jídla':'🍲','Nepečené':'🍫'};

const esc=(v='')=>String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const iconFor=c=>categoryIcons[c]||'📖';
const saveFavorites=()=>localStorage.setItem('rodinnaKucharkaFavorites',JSON.stringify([...favorites]));
const imageFor=r=>r.main_image_url||r.notebook_image_url||(r.source?`images/${encodeURIComponent(r.source)}`:'icons/icon-512.png');
const authorFor=r=>r.author_name||r.author||'';
const confirmationCount=id=>confirmations.filter(c=>c.recipe_id===id).length;
const confirmedByMe=id=>currentUser&&confirmations.some(c=>c.recipe_id===id&&c.user_id===currentUser.id);

async function init(){
  const splash=document.getElementById('splash');
  if(splash) splash.classList.add('hide');
  try {
    const localRes = await fetch('recipes.json', {cache:'no-store'});
    localRecipes = await localRes.json();
  } catch (error) {
    console.error('Nepodarilo sa načítať miestne recepty:', error);
    localRecipes = [];
  }

  if (!cloudAvailable) {
    recipes = localRecipes.map(normalizeLocal);
    confirmations = [];
    updateAccountUI();
    buildCategories();
    renderFeatured();
    render();
    accountBtn.addEventListener('click', () => {
      alert('Cloudové prihlásenie sa nenačítalo. Skontroluj internet a obnov stránku. Miestne recepty však môžeš prezerať.');
    }, { once: true });
    return;
  }

  const {data:{session}} = await supabase.auth.getSession();
  currentUser = session?.user || null;
  supabase.auth.onAuthStateChange((_event,session)=>{
    currentUser=session?.user||null;
    updateAccountUI();
    loadCloudData();
  });
  updateAccountUI();
  await loadCloudData();
  subscribeRealtime();
}

async function loadCloudData(){
  if (!supabase) { recipes=localRecipes.map(normalizeLocal); confirmations=[]; buildCategories(); renderFeatured(); render(); return; }
  const [{data:cloud,error},{data:conf}] = await Promise.all([
    supabase.from('recipes').select('*').order('created_at',{ascending:false}),
    supabase.from('recipe_confirmations').select('*')
  ]);
  if(error){console.error(error); recipes=localRecipes.map(normalizeLocal);} else recipes=(cloud?.length?cloud:localRecipes.map(normalizeLocal));
  confirmations=conf||[]; buildCategories(); renderFeatured(); render();
}
function normalizeLocal(r){return {...r,title:r.name,author_name:r.author,ingredients:r.ingredients||[],instructions:r.method||'',notebook_image_url:r.source?`images/${r.source}`:null,is_local:true};}
function subscribeRealtime(){
  if (!supabase) return;
  supabase.channel('kucharka-zmeny')
   .on('postgres_changes',{event:'*',schema:'public',table:'recipes'},()=>loadCloudData())
   .on('postgres_changes',{event:'*',schema:'public',table:'recipe_confirmations'},()=>loadCloudData())
   .on('postgres_changes',{event:'*',schema:'public',table:'recipe_images'},()=>loadCloudData())
   .subscribe();
}

function buildCategories(){const cats=[...new Set(recipes.map(r=>r.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'sk'));categoryChips.innerHTML=`<button class="category-chip active" data-category=""><span>✨</span>Všetky</button>`+cats.map(c=>`<button class="category-chip" data-category="${esc(c)}"><span>${iconFor(c)}</span>${esc(c)}</button>`).join('');categoryChips.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>setCategory(b.dataset.category)));}
function setCategory(cat){activeCategory=cat;activeView='recipes';updateNavigation('recipes');categoryChips.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.category===cat));document.getElementById('listTitle').textContent=cat||'Všetky recepty';document.getElementById('listLabel').textContent=cat?'Vybraná kategória':'Naša zbierka';render();document.querySelector('.recipes-section').scrollIntoView({behavior:'smooth'});}
function renderFeatured(){if(!recipes.length)return;const r=recipes[Math.floor(Date.now()/86400000)%recipes.length];featuredRecipe.innerHTML=`<article class="featured-card" data-open="${esc(r.id)}"><div class="featured-image" style="background-image:url('${esc(imageFor(r))}')"></div><div class="featured-copy"><span class="tag">${iconFor(r.category)} ${esc(r.category)}</span><h3>${esc(r.title||r.name)}</h3><p>Rodinný recept z našej zbierky.</p><span class="open-link">Otvoriť recept →</span></div></article>`;featuredRecipe.querySelector('[data-open]').addEventListener('click',()=>openRecipe(r.id));}
function filteredRecipes(){const q=search.value.toLocaleLowerCase('sk').trim();return recipes.filter(r=>{const hay=[r.title||r.name,authorFor(r),r.category,...(r.ingredients||[]),r.instructions||r.method].join(' ').toLocaleLowerCase('sk');return(!q||hay.includes(q))&&(!activeCategory||r.category===activeCategory)&&(activeView!=='favorites'||favorites.has(r.id));});}
function render(){const list=filteredRecipes();document.getElementById('stats').textContent=`${list.length} z ${recipes.length} receptov`;clearBtn.hidden=!(search.value||activeCategory||activeView==='favorites');empty.hidden=!!list.length;cards.innerHTML=list.map(r=>{const count=confirmationCount(r.id);return `<article class="recipe-card" data-open="${esc(r.id)}"><div class="recipe-thumb" style="background-image:url('${esc(imageFor(r))}')"><span class="category-badge">${iconFor(r.category)} ${esc(r.category)}</span><button class="favorite ${favorites.has(r.id)?'on':''}" data-fav="${esc(r.id)}">${favorites.has(r.id)?'♥':'♡'}</button></div><div class="recipe-body"><h3>${esc(r.title||r.name)}</h3><div class="recipe-meta"><span>${authorFor(r)?`👤 ${esc(authorFor(r))}`:'👤 Autor nezadaný'}</span></div><div class="recipe-status ${count?'confirmed':'pending'}">${count?`✓ ${count} potvrden${count===1?'ie':'ia'}`:'○ Čaká na kontrolu'}</div></div></article>`}).join('');cards.querySelectorAll('[data-open]').forEach(el=>el.addEventListener('click',()=>openRecipe(el.dataset.open)));cards.querySelectorAll('[data-fav]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();toggleFavorite(b.dataset.fav);}));}
function toggleFavorite(id){favorites.has(id)?favorites.delete(id):favorites.add(id);saveFavorites();render();}

async function openRecipe(id){const r=recipes.find(x=>String(x.id)===String(id));if(!r)return;const count=confirmationCount(r.id), mine=confirmedByMe(r.id);detailContent.innerHTML=`<div class="detail-hero" style="background-image:url('${esc(imageFor(r))}')"><div class="detail-title"><span>${iconFor(r.category)} ${esc(r.category)}</span><h2>${esc(r.title||r.name)}</h2></div></div><div class="detail-content"><div class="detail-actions"><span class="pill">👤 ${esc(authorFor(r)||'Autor nezadaný')}</span><span class="pill">✅ ${count} potvrdení</span></div><section class="recipe-review ${count?'is-confirmed':''}"><div class="review-heading"><div><span>Spoločná kontrola</span><h3>${count?'Recept bol potvrdený':'Recept čaká na kontrolu'}</h3></div><div class="review-state">${count?'✓':'○'}</div></div>${currentUser&&!r.is_local?`<label class="review-check"><input id="confirmRecipe" type="checkbox" ${mine?'checked':''}><span>Potvrdzujem, že recept je správne prepísaný.</span></label><label class="author-label">Autor receptu</label><div class="author-editor"><input id="editAuthor" value="${esc(authorFor(r))}" placeholder="Meno autora"><button id="saveAuthor" type="button">Uložiť</button></div><div class="image-upload-row"><label class="upload-button">📷 Pridať fotku<input id="detailImage" type="file" accept="image/*" hidden></label></div>`:`<p class="login-note">${r.is_local?'Najprv prenesieme pôvodné recepty do cloudu.':'Pre potvrdenie a úpravy sa prihlás.'}</p>`}<p id="detailMessage" class="save-message"></p></section><div class="detail-columns"><div><h3>Suroviny</h3><ul>${(r.ingredients||[]).map(i=>`<li>${esc(i)}</li>`).join('')}</ul><h3>Postup</h3><p>${esc(r.instructions||r.method||'Postup zatiaľ nie je prepísaný.')}</p></div><div><h3>Pôvodná stránka zo zošita</h3><img class="source" src="${esc(r.notebook_image_url||(r.source?`images/${r.source}`:imageFor(r)))}" alt="Originálny recept"></div></div></div>`;openDialog(detail);if(currentUser&&!r.is_local){document.getElementById('confirmRecipe').addEventListener('change',e=>setConfirmation(r.id,e.target.checked));document.getElementById('saveAuthor').addEventListener('click',()=>saveAuthor(r.id));document.getElementById('detailImage').addEventListener('change',e=>uploadExtraImage(r.id,e.target.files[0]));}}
async function setConfirmation(recipeId,checked){const msg=document.getElementById('detailMessage');if(checked){const {error}=await supabase.from('recipe_confirmations').insert({recipe_id:recipeId,user_id:currentUser.id});if(error&&!error.message.includes('duplicate'))msg.textContent='Chyba: '+error.message;}else await supabase.from('recipe_confirmations').delete().eq('recipe_id',recipeId).eq('user_id',currentUser.id);await loadCloudData();openRecipe(recipeId);}
async function saveAuthor(recipeId){const author=document.getElementById('editAuthor').value.trim();const {error}=await supabase.from('recipes').update({author_name:author||null}).eq('id',recipeId);document.getElementById('detailMessage').textContent=error?'Chyba: '+error.message:'Autor bol uložený pre všetkých.';if(!error)await loadCloudData();}
async function uploadExtraImage(recipeId,file){if(!file)return;const msg=document.getElementById('detailMessage');msg.textContent='Nahrávam fotografiu…';const path=`${currentUser.id}/${recipeId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;const {error}=await supabase.storage.from('recipe-images').upload(path,file,{upsert:false});if(error){msg.textContent='Chyba: '+error.message;return;}const {data}=supabase.storage.from('recipe-images').getPublicUrl(path);await supabase.from('recipe_images').insert({recipe_id:recipeId,image_url:data.publicUrl,image_type:'food',uploaded_by:currentUser.id});await supabase.from('recipes').update({main_image_url:data.publicUrl}).eq('id',recipeId);msg.textContent='Fotografia bola pridaná.';await loadCloudData();openRecipe(recipeId);}

function updateAccountUI(){const name=currentUser?.user_metadata?.display_name||currentUser?.email?.split('@')[0];accountBtn.textContent=currentUser?`👤 ${name}`:'👤 Prihlásiť';addRecipeBtn.hidden=!currentUser;document.getElementById('importBtn').hidden=!(currentUser&&recipes.every(r=>r.is_local));}
accountBtn.addEventListener('click',()=>{if(currentUser){document.getElementById('authTitle').textContent='Účet';document.getElementById('authFields').hidden=true;document.getElementById('logoutBtn').hidden=false;document.getElementById('authMessage').textContent=currentUser.email;openDialog(authDialog);}else{document.getElementById('authFields').hidden=false;document.getElementById('logoutBtn').hidden=true;openDialog(authDialog);}});
document.getElementById('loginBtn').addEventListener('click',async()=>{if(!supabase){document.getElementById('authMessage').textContent='Cloudové prihlásenie sa nenačítalo. Obnov stránku.';return;}const email=document.getElementById('authEmail').value.trim(),password=document.getElementById('authPassword').value;const {error}=await supabase.auth.signInWithPassword({email,password});document.getElementById('authMessage').textContent=error?'Chyba: '+error.message:'Prihlásenie úspešné.';if(!error)setTimeout(()=>closeDialog(authDialog),400);});
document.getElementById('signupBtn').addEventListener('click',async()=>{if(!supabase){document.getElementById('authMessage').textContent='Cloudové prihlásenie sa nenačítalo. Obnov stránku.';return;}const email=document.getElementById('authEmail').value.trim(),password=document.getElementById('authPassword').value,display_name=document.getElementById('authName').value.trim();const {data,error}=await supabase.auth.signUp({email,password,options:{data:{display_name}}});document.getElementById('authMessage').textContent=error?'Chyba: '+error.message:(data.session?'Účet vytvorený a prihlásený.':'Účet vytvorený. Skontroluj potvrdzovací e-mail.');});
document.getElementById('logoutBtn').addEventListener('click',async()=>{if(supabase) await supabase.auth.signOut();closeDialog(authDialog);});

addRecipeBtn.addEventListener('click',()=>openDialog(addDialog));
document.getElementById('saveNewRecipe').addEventListener('click',async()=>{const title=document.getElementById('newTitle').value.trim();if(!title){document.getElementById('addMessage').textContent='Zadaj názov receptu.';return;}const ingredients=document.getElementById('newIngredients').value.split('\n').map(x=>x.trim()).filter(Boolean);const payload={title,category:document.getElementById('newCategory').value.trim()||'Ostatné',ingredients,instructions:document.getElementById('newInstructions').value.trim(),author_name:document.getElementById('newAuthor').value.trim()||null,added_by:currentUser.id};const {data,error}=await supabase.from('recipes').insert(payload).select().single();if(error){document.getElementById('addMessage').textContent='Chyba: '+error.message;return;}for(const [input,type,column] of [['newFoodImage','food','main_image_url'],['newNotebookImage','notebook','notebook_image_url']]){const file=document.getElementById(input).files[0];if(file){const path=`${currentUser.id}/${data.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;const up=await supabase.storage.from('recipe-images').upload(path,file);if(!up.error){const {data:urlData}=supabase.storage.from('recipe-images').getPublicUrl(path);await supabase.from('recipe_images').insert({recipe_id:data.id,image_url:urlData.publicUrl,image_type:type,uploaded_by:currentUser.id});await supabase.from('recipes').update({[column]:urlData.publicUrl}).eq('id',data.id);}}}document.getElementById('addMessage').textContent='Recept bol uložený a už ho vidia všetci.';await loadCloudData();setTimeout(()=>closeDialog(addDialog),700);});

document.getElementById('importBtn').addEventListener('click',async()=>{if(!currentUser||!confirm(`Preniesť ${localRecipes.length} pôvodných receptov do spoločnej databázy?`))return;const btn=document.getElementById('importBtn');btn.disabled=true;for(const r of localRecipes){const payload={title:r.name,category:r.category||'Ostatné',ingredients:r.ingredients||[],instructions:r.method||'',author_name:r.author&&r.author!=='Autor ze sešitu'?r.author:null,added_by:currentUser.id,source_note:`legacy:${r.id}`,notebook_image_url:r.source?`images/${r.source}`:null};const {error}=await supabase.from('recipes').insert(payload);if(error){alert('Import sa zastavil: '+error.message);btn.disabled=false;return;}}alert('Pôvodné recepty boli prenesené do cloudu.');await loadCloudData();});

search.addEventListener('input',()=>{activeView='recipes';updateNavigation('recipes');render();});clearBtn.addEventListener('click',()=>{search.value='';activeCategory='';activeView='recipes';render();});document.getElementById('allCategoriesBtn').addEventListener('click',()=>setCategory(''));
document.querySelectorAll('.nav-item').forEach(btn=>btn.addEventListener('click',()=>{const view=btn.dataset.view;if(view==='settings'){openDialog(infoDialog);return;}activeView=view;updateNavigation(view);if(view==='home')window.scrollTo({top:0,behavior:'smooth'});else document.querySelector('.recipes-section').scrollIntoView({behavior:'smooth'});render();}));
function updateNavigation(view){document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===view));}
document.querySelectorAll('dialog .close').forEach(b=>b.addEventListener('click',()=>closeDialog(b.closest('dialog'))));
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;document.getElementById('installBtn').hidden=false;});
document.getElementById('installBtn').onclick=async()=>{
  if(window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone){alert('Aplikácia je už nainštalovaná.');return;}
  if(installPrompt){installPrompt.prompt();const result=await installPrompt.userChoice;installPrompt=null;if(result.outcome==='accepted')document.getElementById('installBtn').hidden=true;return;}
  alert('V prehliadači Chrome otvor menu ⋮ a zvoľ „Pridať na plochu“ alebo „Nainštalovať aplikáciu“.');
};
if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(console.error));

function startApp(){
  init().catch(err=>{
    console.error(err);
    const splash=document.getElementById('splash');
    if(splash) splash.classList.add('hide');
    cards.innerHTML='<p>Nepodarilo sa úplne spustiť cloudové funkcie. Obnov stránku alebo skontroluj internetové pripojenie.</p>';
  });
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',startApp,{once:true});
else startApp();
