const SUPABASE_URL = 'https://mbgdesaueodahxwmydnn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_lNHmPFBuqHZYcKov9QmprQ_oIq1Jry9';
const AUTH_REDIRECT_URL = 'https://fischer-tennis.github.io/rodinna-kucharka/';
let sbClient = null;
let cloudAvailable = false;
let cloudStarted = false;

function connectSupabase(){
  const client = window.supabase;
  if (!client || typeof client.createClient !== 'function') return false;
  if (!sbClient) sbClient = client.createClient(SUPABASE_URL, SUPABASE_KEY);
  cloudAvailable = true;
  return true;
}

function waitForSupabase(timeoutMs = 8000){
  return new Promise(resolve => {
    if (connectSupabase()) return resolve(true);
    const started = Date.now();
    const timer = setInterval(() => {
      if (connectSupabase()) { clearInterval(timer); resolve(true); }
      else if (Date.now() - started >= timeoutMs) { clearInterval(timer); resolve(false); }
    }, 150);
  });
}

async function startCloud(){
  if (cloudStarted || !connectSupabase()) return false;
  cloudStarted = true;
  try {
    const {data:{session}} = await sbClient.auth.getSession();
    currentUser = session?.user || null;
    sbClient.auth.onAuthStateChange((event,session)=>{
      currentUser=session?.user||null;
      if(event==='PASSWORD_RECOVERY') showPasswordRecovery();
      updateAccountUI();
      loadCloudData();
    });
    updateAccountUI();
    await loadCloudData();
    subscribeRealtime();
    return true;
  } catch (error) {
    console.error('Cloud sa nepodarilo spustiť:', error);
    cloudStarted = false;
    return false;
  }
}

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
let favoriteIds = [];
try {
  const storedFavorites = JSON.parse(localStorage.getItem('rodinnaKucharkaFavorites') || '[]');
  favoriteIds = Array.isArray(storedFavorites) ? storedFavorites : [];
} catch (error) {
  console.warn('Poškodené uložené obľúbené recepty boli vymazané.', error);
  localStorage.removeItem('rodinnaKucharkaFavorites');
}
const favorites = new Set(favoriteIds);
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
  try {
    const localRes = await fetch('recipes.json', {cache:'no-store'});
    localRecipes = await localRes.json();
  } catch (error) {
    console.error('Nepodarilo sa načítať miestne recepty:', error);
    localRecipes = [];
  }

  // Najprv vždy zobrazíme miestne recepty, aby aplikácia okamžite reagovala.
  recipes = localRecipes.map(normalizeLocal);
  confirmations = [];
  updateAccountUI();
  buildCategories();
  renderFeatured();
  render();

  // Cloud sa pripája na pozadí; neblokuje tlačidlá ani zobrazenie receptov.
  const ready = await waitForSupabase(8000);
  if (ready) await startCloud();
  else console.warn('Supabase knižnica sa nenačítala. Aplikácia zostáva v miestnom režime.');
}

async function loadCloudData(){
  if (!sbClient) { recipes=localRecipes.map(normalizeLocal); confirmations=[]; buildCategories(); renderFeatured(); render(); return; }
  const [{data:cloud,error},{data:conf}] = await Promise.all([
    sbClient.from('recipes').select('*').order('created_at',{ascending:false}),
    sbClient.from('recipe_confirmations').select('*')
  ]);
  if(error){console.error(error); recipes=localRecipes.map(normalizeLocal);} else recipes=(cloud?.length?cloud:localRecipes.map(normalizeLocal));
  confirmations=conf||[]; buildCategories(); renderFeatured(); render();
}
function normalizeLocal(r){return {...r,title:r.name,author_name:r.author,ingredients:r.ingredients||[],instructions:r.method||'',notebook_image_url:r.source?`images/${r.source}`:null,is_local:true};}
function subscribeRealtime(){
  if (!sbClient) return;
  sbClient.channel('kucharka-zmeny')
   .on('postgres_changes',{event:'*',schema:'public',table:'recipes'},()=>loadCloudData())
   .on('postgres_changes',{event:'*',schema:'public',table:'recipe_confirmations'},()=>loadCloudData())
   .on('postgres_changes',{event:'*',schema:'public',table:'recipe_images'},()=>loadCloudData())
   .on('postgres_changes',{event:'*',schema:'public',table:'recipe_comments'},()=>{})
   .on('postgres_changes',{event:'*',schema:'public',table:'recipe_history'},()=>{})
   .subscribe();
}

function buildCategories(){const cats=[...new Set(recipes.map(r=>r.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'sk'));categoryChips.innerHTML=`<button class="category-chip active" data-category=""><span>✨</span>Všetky</button>`+cats.map(c=>`<button class="category-chip" data-category="${esc(c)}"><span>${iconFor(c)}</span>${esc(c)}</button>`).join('');categoryChips.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>setCategory(b.dataset.category)));}
function setCategory(cat){activeCategory=cat;activeView='recipes';updateNavigation('recipes');categoryChips.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.category===cat));document.getElementById('listTitle').textContent=cat||'Všetky recepty';document.getElementById('listLabel').textContent=cat?'Vybraná kategória':'Naša zbierka';render();document.querySelector('.recipes-section').scrollIntoView({behavior:'smooth'});}
function renderFeatured(){if(!recipes.length)return;const r=recipes[Math.floor(Date.now()/86400000)%recipes.length];featuredRecipe.innerHTML=`<article class="featured-card" data-open="${esc(r.id)}"><div class="featured-image" style="background-image:url('${esc(imageFor(r))}')"></div><div class="featured-copy"><span class="tag">${iconFor(r.category)} ${esc(r.category)}</span><h3>${esc(r.title||r.name)}</h3><p>Rodinný recept z našej zbierky.</p><span class="open-link">Otvoriť recept →</span></div></article>`;featuredRecipe.querySelector('[data-open]').addEventListener('click',()=>openRecipe(r.id));}
function filteredRecipes(){const q=search.value.toLocaleLowerCase('sk').trim();return recipes.filter(r=>{const hay=[r.title||r.name,authorFor(r),r.category,...(r.ingredients||[]),r.instructions||r.method].join(' ').toLocaleLowerCase('sk');return(!q||hay.includes(q))&&(!activeCategory||r.category===activeCategory)&&(activeView!=='favorites'||favorites.has(r.id));});}
function render(){const list=filteredRecipes();document.getElementById('stats').textContent=`${list.length} z ${recipes.length} receptov`;clearBtn.hidden=!(search.value||activeCategory||activeView==='favorites');empty.hidden=!!list.length;cards.innerHTML=list.map(r=>{const count=confirmationCount(r.id);return `<article class="recipe-card" data-open="${esc(r.id)}"><div class="recipe-thumb" style="background-image:url('${esc(imageFor(r))}')"><span class="category-badge">${iconFor(r.category)} ${esc(r.category)}</span><button class="favorite ${favorites.has(r.id)?'on':''}" data-fav="${esc(r.id)}">${favorites.has(r.id)?'♥':'♡'}</button></div><div class="recipe-body"><h3>${esc(r.title||r.name)}</h3><div class="recipe-meta"><span>${authorFor(r)?`👤 ${esc(authorFor(r))}`:'👤 Autor nezadaný'}</span></div><div class="recipe-status ${count?'confirmed':'pending'}">${count?`✓ ${count} potvrden${count===1?'ie':'ia'}`:'○ Čaká na kontrolu'}</div></div></article>`}).join('');cards.querySelectorAll('[data-open]').forEach(el=>el.addEventListener('click',()=>openRecipe(el.dataset.open)));cards.querySelectorAll('[data-fav]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();toggleFavorite(b.dataset.fav);}));}
function toggleFavorite(id){favorites.has(id)?favorites.delete(id):favorites.add(id);saveFavorites();render();}

async function openRecipe(id){
  const r=recipes.find(x=>String(x.id)===String(id));
  if(!r)return;
  const count=confirmationCount(r.id), mine=confirmedByMe(r.id);
  let history=[], comments=[];
  if(currentUser&&!r.is_local&&sbClient){
    const [h,c]=await Promise.all([
      sbClient.from('recipe_history').select('*').eq('recipe_id',r.id).order('created_at',{ascending:false}).limit(20),
      sbClient.from('recipe_comments').select('*').eq('recipe_id',r.id).order('created_at',{ascending:true})
    ]);
    history=h.data||[]; comments=c.data||[];
  }
  const updatedText=r.updated_at?new Date(r.updated_at).toLocaleString('sk-SK'):'';
  detailContent.innerHTML=`
    <div class="detail-hero" style="background-image:url('${esc(imageFor(r))}')"><div class="detail-title"><span>${iconFor(r.category)} ${esc(r.category)}</span><h2>${esc(r.title||r.name)}</h2></div></div>
    <div class="detail-content">
      <div class="detail-actions"><span class="pill">👤 ${esc(authorFor(r)||'Autor nezadaný')}</span><span class="pill">✅ ${count} potvrdení</span>${updatedText?`<span class="pill">🕒 ${esc(updatedText)}</span>`:''}${currentUser&&!r.is_local?'<button id="toggleEdit" class="secondary-button edit-toggle" type="button">✏️ Upraviť recept</button>':''}</div>
      <section class="recipe-review ${count?'is-confirmed':''}">
        <div class="review-heading"><div><span>Spoločná kontrola</span><h3>${count?'Recept bol potvrdený':'Recept čaká na kontrolu'}</h3></div><div class="review-state">${count?'✓':'○'}</div></div>
        ${currentUser&&!r.is_local?`<label class="review-check"><input id="confirmRecipe" type="checkbox" ${mine?'checked':''}><span>Potvrdzujem, že recept je správne prepísaný.</span></label><div class="image-upload-row"><label class="upload-button">📷 Pridať fotku<input id="detailImage" type="file" accept="image/*" hidden></label></div>`:`<p class="login-note">${r.is_local?'Najprv prenesieme pôvodné recepty do cloudu.':'Pre potvrdenie a úpravy sa prihlás.'}</p>`}
        <p id="detailMessage" class="save-message"></p>
      </section>
      ${currentUser&&!r.is_local?`<section id="recipeEditPanel" class="recipe-edit-panel" hidden><h3>Upraviť recept</h3><label>Názov</label><input id="editTitle" value="${esc(r.title||r.name)}"><label>Kategória</label><input id="editCategory" value="${esc(r.category||'')}"><label>Autor receptu</label><input id="editAuthor" value="${esc(authorFor(r))}"><label>Suroviny – každá na nový riadok</label><textarea id="editIngredients" rows="8">${esc((r.ingredients||[]).join('\n'))}</textarea><label>Postup</label><textarea id="editInstructions" rows="10">${esc(r.instructions||r.method||'')}</textarea><label>Poznámka k úprave</label><input id="editNote" placeholder="Napr. opravené množstvo múky"><div class="recipe-edit-actions"><button id="saveRecipeEdit" class="primary-button" type="button">💾 Uložiť zmeny</button><button id="cancelRecipeEdit" class="secondary-button" type="button">Zrušiť</button></div></section>`:''}
      <div class="detail-columns"><div><h3>Suroviny</h3><ul>${(r.ingredients||[]).map(i=>`<li>${esc(i)}</li>`).join('')}</ul><h3>Postup</h3><p>${esc(r.instructions||r.method||'Postup zatiaľ nie je prepísaný.')}</p></div><div><h3>Pôvodná stránka zo zošita</h3><img class="source" src="${esc(r.notebook_image_url||(r.source?`images/${r.source}`:imageFor(r)))}" alt="Originálny recept"></div></div>
      ${currentUser&&!r.is_local?`<section class="history-panel"><h3>História úprav</h3><div class="history-list">${history.length?history.map(h=>`<div class="history-item"><strong>${esc(h.changed_by_name||'Člen rodiny')}</strong><div>${esc(h.change_note||'Upravený recept')}</div><div class="meta-small">${new Date(h.created_at).toLocaleString('sk-SK')}</div></div>`).join(''):'<p>Zatiaľ bez uložených úprav.</p>'}</div></section><section class="comments-panel"><h3>Rodinné poznámky</h3><div class="comments-list">${comments.length?comments.map(c=>`<div class="comment-item"><strong>${esc(c.user_name||'Člen rodiny')}</strong><div class="comment-text">${esc(c.comment_text)}</div><div class="meta-small">${new Date(c.created_at).toLocaleString('sk-SK')}</div></div>`).join(''):'<p>Zatiaľ bez poznámok.</p>'}</div><div class="comment-form"><label>Pridať poznámku</label><textarea id="newComment" rows="3" placeholder="Skúsenosť, tip alebo návrh…"></textarea><button id="saveComment" class="secondary-button" type="button">Pridať poznámku</button></div></section>`:''}
    </div>`;
  openDialog(detail);
  if(currentUser&&!r.is_local){
    document.getElementById('confirmRecipe').addEventListener('change',e=>setConfirmation(r.id,e.target.checked));
    document.getElementById('detailImage').addEventListener('change',e=>uploadExtraImage(r.id,e.target.files[0]));
    document.getElementById('toggleEdit').addEventListener('click',()=>document.getElementById('recipeEditPanel').hidden=false);
    document.getElementById('cancelRecipeEdit').addEventListener('click',()=>document.getElementById('recipeEditPanel').hidden=true);
    document.getElementById('saveRecipeEdit').addEventListener('click',()=>saveRecipeEdit(r));
    document.getElementById('saveComment').addEventListener('click',()=>saveComment(r.id));
  }
}

async function saveRecipeEdit(original){
  const msg=document.getElementById('detailMessage');
  const ingredients=document.getElementById('editIngredients').value.split('\n').map(x=>x.trim()).filter(Boolean);
  const payload={title:document.getElementById('editTitle').value.trim(),category:document.getElementById('editCategory').value.trim()||'Ostatné',author_name:document.getElementById('editAuthor').value.trim()||null,ingredients,instructions:document.getElementById('editInstructions').value.trim(),updated_at:new Date().toISOString(),updated_by:currentUser.id};
  if(!payload.title){msg.textContent='Názov receptu nemôže byť prázdny.';return;}
  msg.textContent='Ukladám zmeny…';
  const displayName=currentUser.user_metadata?.display_name||currentUser.email?.split('@')[0]||'Člen rodiny';
  const snapshot={title:original.title,category:original.category,author_name:original.author_name,ingredients:original.ingredients,instructions:original.instructions,main_image_url:original.main_image_url,notebook_image_url:original.notebook_image_url};
  const hist=await sbClient.from('recipe_history').insert({recipe_id:original.id,changed_by:currentUser.id,changed_by_name:displayName,change_note:document.getElementById('editNote').value.trim()||'Upravený recept',snapshot});
  if(hist.error){msg.textContent='Históriu sa nepodarilo uložiť: '+hist.error.message;return;}
  const {error}=await sbClient.from('recipes').update(payload).eq('id',original.id);
  if(error){msg.textContent='Chyba: '+error.message;return;}
  msg.textContent='Zmeny boli uložené pre celú rodinu.';
  await loadCloudData();
  await openRecipe(original.id);
}

async function saveComment(recipeId){
  const field=document.getElementById('newComment');
  const text=field.value.trim();
  if(!text)return;
  const userName=currentUser.user_metadata?.display_name||currentUser.email?.split('@')[0]||'Člen rodiny';
  const {error}=await sbClient.from('recipe_comments').insert({recipe_id:recipeId,user_id:currentUser.id,user_name:userName,comment_text:text});
  if(error){document.getElementById('detailMessage').textContent='Chyba: '+error.message;return;}
  await openRecipe(recipeId);
}

async function setConfirmation(recipeId,checked){const msg=document.getElementById('detailMessage');if(checked){const {error}=await sbClient.from('recipe_confirmations').insert({recipe_id:recipeId,user_id:currentUser.id});if(error&&!error.message.includes('duplicate'))msg.textContent='Chyba: '+error.message;}else await sbClient.from('recipe_confirmations').delete().eq('recipe_id',recipeId).eq('user_id',currentUser.id);await loadCloudData();openRecipe(recipeId);}
async function saveAuthor(recipeId){const author=document.getElementById('editAuthor').value.trim();const {error}=await sbClient.from('recipes').update({author_name:author||null}).eq('id',recipeId);document.getElementById('detailMessage').textContent=error?'Chyba: '+error.message:'Autor bol uložený pre všetkých.';if(!error)await loadCloudData();}
async function uploadExtraImage(recipeId,file){if(!file)return;const msg=document.getElementById('detailMessage');msg.textContent='Nahrávam fotografiu…';const path=`${currentUser.id}/${recipeId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;const {error}=await sbClient.storage.from('recipe-images').upload(path,file,{upsert:false});if(error){msg.textContent='Chyba: '+error.message;return;}const {data}=sbClient.storage.from('recipe-images').getPublicUrl(path);await sbClient.from('recipe_images').insert({recipe_id:recipeId,image_url:data.publicUrl,image_type:'food',uploaded_by:currentUser.id});await sbClient.from('recipes').update({main_image_url:data.publicUrl}).eq('id',recipeId);msg.textContent='Fotografia bola pridaná.';await loadCloudData();openRecipe(recipeId);}

function updateAccountUI(){const name=currentUser?.user_metadata?.display_name||currentUser?.email?.split('@')[0];accountBtn.textContent=currentUser?`👤 ${name}`:'👤 Prihlásiť';addRecipeBtn.hidden=!currentUser;document.getElementById('importBtn').hidden=!(currentUser&&recipes.every(r=>r.is_local));}
accountBtn.addEventListener('click',()=>{document.getElementById('newPasswordFields').hidden=true;document.getElementById('authTitle').textContent=currentUser?'Účet':'Prihlásenie';if(!sbClient){document.getElementById('authMessage').textContent='Pripájam cloud… Skús o chvíľu znova.';}else{document.getElementById('authMessage').textContent='';}if(currentUser){document.getElementById('authTitle').textContent='Účet';document.getElementById('authFields').hidden=true;document.getElementById('logoutBtn').hidden=false;document.getElementById('authMessage').textContent=currentUser.email;openDialog(authDialog);}else{document.getElementById('authFields').hidden=false;document.getElementById('logoutBtn').hidden=true;openDialog(authDialog);}});
document.getElementById('loginBtn').addEventListener('click',async()=>{if(!sbClient){document.getElementById('authMessage').textContent='Cloud ešte nie je pripojený. Skontroluj internet a skús znova.';return;}const email=document.getElementById('authEmail').value.trim(),password=document.getElementById('authPassword').value;const {error}=await sbClient.auth.signInWithPassword({email,password});document.getElementById('authMessage').textContent=error?'Chyba: '+error.message:'Prihlásenie úspešné.';if(!error)setTimeout(()=>closeDialog(authDialog),400);});
document.getElementById('signupBtn').addEventListener('click',async()=>{
  const message=document.getElementById('authMessage');
  if(!sbClient){message.textContent='Cloud ešte nie je pripojený. Skontroluj internet a skús znova.';return;}
  const email=document.getElementById('authEmail').value.trim();
  const password=document.getElementById('authPassword').value;
  const display_name=document.getElementById('authName').value.trim();
  if(!display_name){message.textContent='Zadaj meno.';return;}
  if(!email){message.textContent='Zadaj e-mail.';return;}
  if(password.length<6){message.textContent='Heslo musí mať minimálne 6 znakov.';return;}
  message.textContent='Vytváram účet…';
  const {data,error}=await sbClient.auth.signUp({
    email,
    password,
    options:{
      data:{display_name},
      emailRedirectTo:AUTH_REDIRECT_URL
    }
  });
  message.textContent=error?friendlyAuthError(error):(data.session?'Účet bol vytvorený a si prihlásený.':'Účet bol vytvorený. Skontroluj potvrdzovací e-mail.');
});

document.getElementById('logoutBtn').addEventListener('click',async()=>{if(!sbClient)return;await sbClient.auth.signOut();closeDialog(authDialog);});


function friendlyAuthError(error){
  const text=(error?.message||'').toLowerCase();
  const seconds=text.match(/after\s+(\d+)\s+seconds?/i)?.[1];
  if(seconds) return `Z bezpečnostných dôvodov počkaj ${seconds} sekúnd a skús to znova.`;
  if(text.includes('email rate limit exceeded')) return 'Bol prekročený limit odosielania e-mailov. Počkaj približne hodinu a skús to znova.';
  if(text.includes('invalid login credentials')) return 'Nesprávny e-mail alebo heslo.';
  if(text.includes('email not confirmed')) return 'E-mail ešte nie je potvrdený. Použi možnosť „Poslať potvrdenie znova“.';
  if(text.includes('user already registered')) return 'Tento e-mail je už zaregistrovaný. Skús sa prihlásiť alebo obnoviť heslo.';
  if(text.includes('password should be at least')) return 'Heslo musí mať minimálne 6 znakov.';
  return 'Chyba: '+(error?.message||'Neznáma chyba');
}

function showPasswordRecovery(){
  document.getElementById('authTitle').textContent='Nastaviť nové heslo';
  document.getElementById('authFields').hidden=true;
  document.getElementById('logoutBtn').hidden=true;
  document.getElementById('newPasswordFields').hidden=false;
  document.getElementById('authMessage').textContent='Zadaj nové heslo s minimálne 6 znakmi.';
  openDialog(authDialog);
}

document.getElementById('resendConfirmationBtn').addEventListener('click',async()=>{
  const message=document.getElementById('authMessage');
  if(!sbClient){message.textContent='Cloud ešte nie je pripojený.';return;}
  const email=document.getElementById('authEmail').value.trim();
  if(!email){message.textContent='Najprv zadaj e-mail.';return;}
  message.textContent='Odosielam potvrdzovací e-mail…';
  const {error}=await sbClient.auth.resend({
    type:'signup',
    email,
    options:{emailRedirectTo:AUTH_REDIRECT_URL}
  });
  message.textContent=error?friendlyAuthError(error):'Potvrdzovací e-mail bol odoslaný znova.';
});

document.getElementById('forgotPasswordBtn').addEventListener('click',async()=>{
  if(!sbClient){document.getElementById('authMessage').textContent='Cloud ešte nie je pripojený.';return;}
  const email=document.getElementById('authEmail').value.trim();
  if(!email){document.getElementById('authMessage').textContent='Najprv zadaj e-mail.';return;}
  const {error}=await sbClient.auth.resetPasswordForEmail(email,{redirectTo:AUTH_REDIRECT_URL});
  document.getElementById('authMessage').textContent=error?friendlyAuthError(error):'Odkaz na zmenu hesla bol odoslaný na e-mail.';
});

document.getElementById('saveNewPasswordBtn').addEventListener('click',async()=>{
  const password=document.getElementById('newPassword').value;
  if(password.length<6){document.getElementById('authMessage').textContent='Heslo musí mať minimálne 6 znakov.';return;}
  const {error}=await sbClient.auth.updateUser({password});
  document.getElementById('authMessage').textContent=error?'Chyba: '+error.message:'Heslo bolo úspešne zmenené.';
  if(!error)setTimeout(()=>closeDialog(authDialog),800);
});

addRecipeBtn.addEventListener('click',()=>addDialog.showModal());
document.getElementById('saveNewRecipe').addEventListener('click',async()=>{const title=document.getElementById('newTitle').value.trim();if(!title){document.getElementById('addMessage').textContent='Zadaj názov receptu.';return;}const ingredients=document.getElementById('newIngredients').value.split('\n').map(x=>x.trim()).filter(Boolean);const payload={title,category:document.getElementById('newCategory').value.trim()||'Ostatné',ingredients,instructions:document.getElementById('newInstructions').value.trim(),author_name:document.getElementById('newAuthor').value.trim()||null,added_by:currentUser.id};const {data,error}=await sbClient.from('recipes').insert(payload).select().single();if(error){document.getElementById('addMessage').textContent='Chyba: '+error.message;return;}for(const [input,type,column] of [['newFoodImage','food','main_image_url'],['newNotebookImage','notebook','notebook_image_url']]){const file=document.getElementById(input).files[0];if(file){const path=`${currentUser.id}/${data.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;const up=await sbClient.storage.from('recipe-images').upload(path,file);if(!up.error){const {data:urlData}=sbClient.storage.from('recipe-images').getPublicUrl(path);await sbClient.from('recipe_images').insert({recipe_id:data.id,image_url:urlData.publicUrl,image_type:type,uploaded_by:currentUser.id});await sbClient.from('recipes').update({[column]:urlData.publicUrl}).eq('id',data.id);}}}document.getElementById('addMessage').textContent='Recept bol uložený a už ho vidia všetci.';await loadCloudData();setTimeout(()=>closeDialog(addDialog),700);});

document.getElementById('importBtn').addEventListener('click',async()=>{if(!currentUser||!confirm(`Preniesť ${localRecipes.length} pôvodných receptov do spoločnej databázy?`))return;const btn=document.getElementById('importBtn');btn.disabled=true;for(const r of localRecipes){const payload={title:r.name,category:r.category||'Ostatné',ingredients:r.ingredients||[],instructions:r.method||'',author_name:r.author&&r.author!=='Autor ze sešitu'?r.author:null,added_by:currentUser.id,source_note:`legacy:${r.id}`,notebook_image_url:r.source?`images/${r.source}`:null};const {error}=await sbClient.from('recipes').insert(payload);if(error){alert('Import sa zastavil: '+error.message);btn.disabled=false;return;}}alert('Pôvodné recepty boli prenesené do cloudu.');await loadCloudData();});

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

window.addEventListener('supabase-ready',()=>{ startCloud(); });
window.addEventListener('online',()=>{ startCloud(); });

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
