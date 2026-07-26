import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.95.0/+esm';

const supabase=createClient('https://mbgdesaueodahxwmydnn.supabase.co','sb_publishable_lNHmPFBuqHZYcKov9QmprQ_oIq1Jry9');
const $=id=>document.getElementById(id);
let recipes=[],localRecipes=[],installPrompt,currentUser=null,confirmations=[],activeCategory='',activeView='home',previewUrl='';
const favorites=new Set(JSON.parse(localStorage.getItem('rodinnaKucharkaFavorites')||'[]'));
const categoryIcons={'Kynuté a pečivo':'🥐','Chléb a pečivo':'🍞','Vánoční cukroví':'🍪','Dezerty':'🍮','Zákusky':'🍰','Dorty':'🎂','Polévky':'🥣','Hlavní jídla':'🍲','Nepečené':'🍫'};
const esc=(v='')=>String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const iconFor=c=>categoryIcons[c]||'📖';
const imageFor=r=>r.main_image_url||r.notebook_image_url||(r.source?`images/${encodeURIComponent(r.source)}`:'icons/icon-512.png');
const authorFor=r=>r.author_name||r.author||'';
const confirmationCount=id=>confirmations.filter(c=>String(c.recipe_id)===String(id)).length;
const confirmedByMe=id=>!!(currentUser&&confirmations.some(c=>String(c.recipe_id)===String(id)&&c.user_id===currentUser.id));
const saveFavorites=()=>localStorage.setItem('rodinnaKucharkaFavorites',JSON.stringify([...favorites]));

window.addEventListener('load',()=>setTimeout(()=>$('splash')?.classList.add('hide'),500));

async function init(){
  try{const res=await fetch('recipes.json');if(res.ok)localRecipes=await res.json()}catch(err){console.info('Lokálne recepty nie sú dostupné.',err)}
  const {data:{session}}=await supabase.auth.getSession();currentUser=session?.user||null;
  supabase.auth.onAuthStateChange((_event,session)=>{currentUser=session?.user||null;updateAccountUI();loadCloudData()});
  updateAccountUI();await loadCloudData();subscribeRealtime();
}
async function loadCloudData(){
  const [{data:cloud,error},{data:conf,error:confError}]=await Promise.all([supabase.from('recipes').select('*').order('created_at',{ascending:false}),supabase.from('recipe_confirmations').select('*')]);
  if(error){console.error(error);recipes=localRecipes.map(normalizeLocal)}else recipes=(cloud?.length?cloud:localRecipes.map(normalizeLocal));
  confirmations=confError?[]:(conf||[]);buildCategories();renderFeatured();render();
}
function normalizeLocal(r){return {...r,title:r.name,author_name:r.author,ingredients:r.ingredients||[],instructions:r.method||'',notebook_image_url:r.source?`images/${r.source}`:null,is_local:true}}
function subscribeRealtime(){supabase.channel('kucharka-zmeny').on('postgres_changes',{event:'*',schema:'public',table:'recipes'},loadCloudData).on('postgres_changes',{event:'*',schema:'public',table:'recipe_confirmations'},loadCloudData).on('postgres_changes',{event:'*',schema:'public',table:'recipe_images'},loadCloudData).subscribe()}
function buildCategories(){const cats=[...new Set(recipes.map(r=>r.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'sk'));$('categoryChips').innerHTML=`<button class="category-chip active" data-category=""><span>✨</span>Všetky</button>`+cats.map(c=>`<button class="category-chip" data-category="${esc(c)}"><span>${iconFor(c)}</span>${esc(c)}</button>`).join('');$('categoryChips').querySelectorAll('button').forEach(b=>b.onclick=()=>setCategory(b.dataset.category))}
function setCategory(cat){activeCategory=cat;activeView='recipes';updateNavigation('recipes');$('categoryChips').querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.category===cat));$('listTitle').textContent=cat||'Všetky recepty';$('listLabel').textContent=cat?'Vybraná kategória':'Naša zbierka';render();document.querySelector('.recipes-section').scrollIntoView({behavior:'smooth'})}
function renderFeatured(){if(!recipes.length){$('featuredSection').hidden=true;return}$('featuredSection').hidden=false;const r=recipes[Math.floor(Date.now()/86400000)%recipes.length];$('featuredRecipe').innerHTML=`<article class="featured-card" data-open="${esc(r.id)}"><div class="featured-image" style="background-image:url('${esc(imageFor(r))}')"></div><div class="featured-copy"><span class="tag">${iconFor(r.category)} ${esc(r.category||'Ostatné')}</span><h3>${esc(r.title||r.name)}</h3><p>Rodinný recept z našej zbierky.</p><span class="open-link">Otvoriť recept →</span></div></article>`;$('featuredRecipe').querySelector('[data-open]').onclick=()=>openRecipe(r.id)}
function filteredRecipes(){const q=$('search').value.toLocaleLowerCase('sk').trim();return recipes.filter(r=>{const hay=[r.title||r.name,authorFor(r),r.category,...(r.ingredients||[]),r.instructions||r.method].join(' ').toLocaleLowerCase('sk');return(!q||hay.includes(q))&&(!activeCategory||r.category===activeCategory)&&(activeView!=='favorites'||favorites.has(String(r.id)))})}
function render(){const list=filteredRecipes();$('stats').textContent=`${list.length} z ${recipes.length} receptov`;$('clearBtn').hidden=!($('search').value||activeCategory||activeView==='favorites');$('empty').hidden=!!list.length;$('cards').innerHTML=list.map(r=>{const id=String(r.id),count=confirmationCount(r.id);return `<article class="recipe-card" data-open="${esc(id)}"><div class="recipe-thumb" style="background-image:url('${esc(imageFor(r))}')"><span class="category-badge">${iconFor(r.category)} ${esc(r.category||'Ostatné')}</span><button class="favorite ${favorites.has(id)?'on':''}" data-fav="${esc(id)}" aria-label="Obľúbený recept">${favorites.has(id)?'♥':'♡'}</button></div><div class="recipe-body"><h3>${esc(r.title||r.name)}</h3><div class="recipe-meta"><span>${authorFor(r)?`👤 ${esc(authorFor(r))}`:'👤 Autor nezadaný'}</span></div><div class="recipe-status ${count?'confirmed':'pending'}">${count?`✓ ${count} potvrden${count===1?'ie':'ia'}`:'○ Čaká na kontrolu'}</div></div></article>`}).join('');$('cards').querySelectorAll('[data-open]').forEach(el=>el.onclick=()=>openRecipe(el.dataset.open));$('cards').querySelectorAll('[data-fav]').forEach(b=>b.onclick=e=>{e.stopPropagation();toggleFavorite(b.dataset.fav)})}
function toggleFavorite(id){favorites.has(id)?favorites.delete(id):favorites.add(id);saveFavorites();render()}
async function openRecipe(id){const r=recipes.find(x=>String(x.id)===String(id));if(!r)return;const count=confirmationCount(r.id),mine=confirmedByMe(r.id);$('detailContent').innerHTML=`<div class="detail-hero" style="background-image:url('${esc(imageFor(r))}')"><div class="detail-title"><span>${iconFor(r.category)} ${esc(r.category||'Ostatné')}</span><h2>${esc(r.title||r.name)}</h2></div></div><div class="detail-content"><div class="detail-actions"><span class="pill">👤 ${esc(authorFor(r)||'Autor nezadaný')}</span><span class="pill">✅ ${count} potvrdení</span></div><section class="recipe-review ${count?'is-confirmed':''}"><div class="review-heading"><div><span>Spoločná kontrola</span><h3>${count?'Recept bol potvrdený':'Recept čaká na kontrolu'}</h3></div><div class="review-state">${count?'✓':'○'}</div></div>${currentUser&&!r.is_local?`<label class="review-check"><input id="confirmRecipe" type="checkbox" ${mine?'checked':''}><span>Potvrdzujem, že recept je správne prepísaný.</span></label><label class="author-label">Autor receptu</label><div class="author-editor"><input id="editAuthor" value="${esc(authorFor(r))}" placeholder="Meno autora"><button id="saveAuthor" type="button">Uložiť</button></div><div class="image-upload-row"><label class="upload-button">📷 Pridať fotku<input id="detailImage" type="file" accept="image/*" hidden></label></div>`:`<p class="login-note">${r.is_local?'Najprv prenesieme pôvodné recepty do cloudu.':'Pre potvrdenie a úpravy sa prihlás.'}</p>`}<p id="detailMessage" class="save-message"></p></section><div class="detail-columns"><div><h3>Suroviny</h3><ul>${(r.ingredients||[]).map(i=>`<li>${esc(i)}</li>`).join('')}</ul><h3>Postup</h3><p>${esc(r.instructions||r.method||'Postup zatiaľ nie je prepísaný.')}</p></div><div><h3>Pôvodná stránka zo zošita</h3><img class="source" src="${esc(r.notebook_image_url||(r.source?`images/${r.source}`:imageFor(r)))}" alt="Originálny recept"></div></div></div>`;$('detail').showModal();if(currentUser&&!r.is_local){$('confirmRecipe').onchange=e=>setConfirmation(r.id,e.target.checked);$('saveAuthor').onclick=()=>saveAuthor(r.id);$('detailImage').onchange=e=>uploadExtraImage(r.id,e.target.files[0])}}
async function setConfirmation(recipeId,checked){const msg=$('detailMessage');if(checked){const {error}=await supabase.from('recipe_confirmations').insert({recipe_id:recipeId,user_id:currentUser.id});if(error&&!error.message.toLowerCase().includes('duplicate'))msg.textContent='Chyba: '+error.message}else await supabase.from('recipe_confirmations').delete().eq('recipe_id',recipeId).eq('user_id',currentUser.id);await loadCloudData();openRecipe(recipeId)}
async function saveAuthor(recipeId){const {error}=await supabase.from('recipes').update({author_name:$('editAuthor').value.trim()||null}).eq('id',recipeId);$('detailMessage').textContent=error?'Chyba: '+error.message:'Autor bol uložený pre všetkých.';if(!error)await loadCloudData()}
async function uploadExtraImage(recipeId,file){if(!file)return;const msg=$('detailMessage');msg.textContent='Nahrávam fotografiu…';try{const url=await uploadImage(file,recipeId,'food','main_image_url');msg.textContent=url?'Fotografia bola pridaná.':'Fotografiu sa nepodarilo uložiť.';await loadCloudData();openRecipe(recipeId)}catch(e){msg.textContent='Chyba: '+e.message}}
function updateAccountUI(){const name=currentUser?.user_metadata?.display_name||currentUser?.email?.split('@')[0];$('accountBtn').textContent=currentUser?`👤 ${name}`:'👤 Prihlásiť';$('addRecipeBtn').hidden=!currentUser;$('importBtn').hidden=!(currentUser&&localRecipes.length&&recipes.every(r=>r.is_local))}

$('accountBtn').onclick=()=>{if(currentUser){$('authTitle').textContent='Účet';$('authFields').hidden=true;$('logoutBtn').hidden=false;$('authMessage').textContent=currentUser.email}else{$('authTitle').textContent='Prihlásenie';$('authFields').hidden=false;$('logoutBtn').hidden=true;$('authMessage').textContent=''}$('authDialog').showModal()};
$('loginBtn').onclick=async()=>{const {error}=await supabase.auth.signInWithPassword({email:$('authEmail').value.trim(),password:$('authPassword').value});$('authMessage').textContent=error?'Chyba: '+error.message:'Prihlásenie úspešné.';if(!error)setTimeout(()=>$('authDialog').close(),400)};
$('signupBtn').onclick=async()=>{const {data,error}=await supabase.auth.signUp({email:$('authEmail').value.trim(),password:$('authPassword').value,options:{data:{display_name:$('authName').value.trim()}}});$('authMessage').textContent=error?'Chyba: '+error.message:(data.session?'Účet vytvorený a prihlásený.':'Účet vytvorený. Skontroluj potvrdzovací e-mail.')};
$('forgotBtn').onclick=async()=>{const email=$('authEmail').value.trim();if(!email){$('authMessage').textContent='Najprv zadaj e-mail.';return}const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:new URL('.',location.href).href});$('authMessage').textContent=error?'Chyba: '+error.message:'Odkaz na nové heslo bol odoslaný.'};
$('logoutBtn').onclick=async()=>{await supabase.auth.signOut();$('authDialog').close()};

const chatPrompt=`Prepíš recept z priloženej fotografie. Text môže byť po slovensky alebo česky. Zachovaj presne všetky množstvá, jednotky, teploty a časy. Nič si nevymýšľaj. Nečitateľné miesto označ [nečitateľné]. Odpovedz iba v tomto formáte:\n\nNÁZOV: ...\nKATEGÓRIA: ...\nAUTOR: ...\nSUROVINY:\n- ...\nPOSTUP:\n...`;
function chooseRecipePhoto(file){if(!file)return;if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=URL.createObjectURL(file);$('aiPhotoPreview').hidden=false;$('aiPhotoPreview').innerHTML=`<img src="${previewUrl}" alt="Náhľad"><div><strong>${esc(file.name||'Fotografia receptu')}</strong><small>Fotografia sa použije aj ako originál zo zošita.</small></div>`;try{const dt=new DataTransfer();dt.items.add(file);$('newNotebookImage').files=dt.files}catch(err){console.info('Fotografiu treba prípadne zvoliť aj v poli originálu.',err)}}
$('cameraRecipeImage').onchange=e=>chooseRecipePhoto(e.target.files[0]);$('galleryRecipeImage').onchange=e=>chooseRecipePhoto(e.target.files[0]);
async function copyChatPrompt(){
  const message=$('aiMessage');
  const button=$('copyPromptBtn');
  const originalText=button.textContent;
  let copied=false;
  try{
    if(navigator.clipboard&&window.isSecureContext){
      await navigator.clipboard.writeText(chatPrompt);
      copied=true;
    }
  }catch(err){console.info('Clipboard API nie je dostupné.',err)}
  if(!copied){
    const ta=document.createElement('textarea');
    ta.value=chatPrompt;
    ta.setAttribute('readonly','');
    ta.style.position='fixed';
    ta.style.left='-9999px';
    ta.style.top='0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0,ta.value.length);
    try{copied=document.execCommand('copy')}catch(err){console.info('Náhradné kopírovanie zlyhalo.',err)}
    ta.remove();
  }
  if(copied){
    message.textContent='✓ Zadanie je skopírované. Teraz otvor ChatGPT a pridaj fotografiu.';
    button.textContent='✓ Skopírované';
    setTimeout(()=>button.textContent=originalText,1800);
  }else{
    window.prompt('Kopírovanie sa nepodarilo automaticky. Podrž prst na texte, označ všetko a zvoľ Kopírovať:',chatPrompt);
    message.textContent='Zadanie sa otvorilo na ručné skopírovanie.';
  }
}
$('copyPromptBtn').onclick=copyChatPrompt;
$('openChatGPTBtn').onclick=()=>{
  const fallback=encodeURIComponent('https://chatgpt.com/');
  const androidIntent=`intent://chatgpt.com/#Intent;scheme=https;package=com.openai.chatgpt;S.browser_fallback_url=${fallback};end`;
  if(/Android/i.test(navigator.userAgent)){
    window.location.href=androidIntent;
  }else{
    window.open('https://chatgpt.com/','_blank','noopener,noreferrer');
  }
};
function cleanHeading(s){return s.replace(/^\s*[#>*_`-]+\s*/,'').replace(/[\s*_`]+$/,'').trim()}
function parseChatResult(text){const t=text.replace(/\r/g,'').replace(/\*\*/g,'').trim();const headings=['NÁZOV','KATEGÓRIA','AUTOR','SUROVINY','POSTUP'];const result={};for(let i=0;i<headings.length;i++){const h=headings[i],next=headings.slice(i+1).join('|');const re=new RegExp(`(?:^|\\n)\\s*(?:#+\\s*)?${h}\\s*:\\s*([\\s\\S]*?)${next?`(?=\\n\\s*(?:#+\\s*)?(?:${next})\\s*:)`:'$'}`,'i');result[h]=cleanHeading(t.match(re)?.[1]||'')}return result}
$('fillFromChatGPTBtn').onclick=()=>{const p=parseChatResult($('chatgptResult').value);const ing=(p.SUROVINY||'').split('\n').map(x=>x.replace(/^\s*[-•*]\s*/,'').trim()).filter(Boolean);if(!p['NÁZOV']&&!ing.length&&!p.POSTUP){$('aiMessage').textContent='Odpoveď sa nepodarilo rozpoznať. Skontroluj, či obsahuje NÁZOV, SUROVINY a POSTUP.';return}$('newTitle').value=p['NÁZOV'];$('newCategory').value=p['KATEGÓRIA'];$('newAuthor').value=p.AUTOR;$('newIngredients').value=ing.join('\n');$('newInstructions').value=p.POSTUP;$('aiMessage').textContent='Polia boli vyplnené. Pred uložením ich skontroluj.'};

function clearAddForm(){['newTitle','newCategory','newAuthor','newIngredients','newInstructions','chatgptResult'].forEach(id=>$(id).value='');['newFoodImage','newNotebookImage','cameraRecipeImage','galleryRecipeImage'].forEach(id=>$(id).value='');$('aiMessage').textContent='';$('addMessage').textContent='';$('aiPhotoPreview').hidden=true;$('aiPhotoPreview').innerHTML='';if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=''}}
$('addRecipeBtn').onclick=()=>{clearAddForm();$('addDialog').showModal()};
async function uploadImage(file,recipeId,type,column){if(!file)return null;const path=`${currentUser.id}/${recipeId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;const {error}=await supabase.storage.from('recipe-images').upload(path,file,{upsert:false});if(error)throw error;const {data}=supabase.storage.from('recipe-images').getPublicUrl(path);const imageUrl=data.publicUrl;const {error:imgError}=await supabase.from('recipe_images').insert({recipe_id:recipeId,image_url:imageUrl,image_type:type,uploaded_by:currentUser.id});if(imgError)throw imgError;const {error:updateError}=await supabase.from('recipes').update({[column]:imageUrl}).eq('id',recipeId);if(updateError)throw updateError;return imageUrl}
$('saveNewRecipe').onclick=async()=>{if(!currentUser){$('addMessage').textContent='Najprv sa prihlás.';return}const title=$('newTitle').value.trim();if(!title){$('addMessage').textContent='Zadaj názov receptu.';return}const btn=$('saveNewRecipe');btn.disabled=true;$('addMessage').textContent='Ukladám recept…';const payload={title,category:$('newCategory').value.trim()||'Ostatné',ingredients:$('newIngredients').value.split('\n').map(x=>x.trim()).filter(Boolean),instructions:$('newInstructions').value.trim(),author_name:$('newAuthor').value.trim()||null,added_by:currentUser.id};const {data,error}=await supabase.from('recipes').insert(payload).select().single();if(error){$('addMessage').textContent='Chyba: '+error.message;btn.disabled=false;return}try{await uploadImage($('newFoodImage').files[0],data.id,'food','main_image_url');await uploadImage($('newNotebookImage').files[0],data.id,'notebook','notebook_image_url');$('addMessage').textContent='Recept bol uložený a už ho vidia všetci.';await loadCloudData();setTimeout(()=>{$('addDialog').close();clearAddForm()},800)}catch(e){$('addMessage').textContent='Recept je uložený, ale fotografiu sa nepodarilo nahrať: '+e.message}finally{btn.disabled=false}};
$('importBtn').onclick=async()=>{if(!currentUser||!localRecipes.length||!confirm(`Preniesť ${localRecipes.length} pôvodných receptov do spoločnej databázy?`))return;const btn=$('importBtn');btn.disabled=true;for(const r of localRecipes){const {error}=await supabase.from('recipes').insert({title:r.name,category:r.category||'Ostatné',ingredients:r.ingredients||[],instructions:r.method||'',author_name:r.author&&r.author!=='Autor ze sešitu'?r.author:null,added_by:currentUser.id,source_note:`legacy:${r.id}`,notebook_image_url:r.source?`images/${r.source}`:null});if(error){alert('Import sa zastavil: '+error.message);btn.disabled=false;return}}alert('Pôvodné recepty boli prenesené do cloudu.');await loadCloudData();btn.disabled=false};

$('search').oninput=()=>{activeView='recipes';updateNavigation('recipes');render()};$('clearBtn').onclick=()=>{$('search').value='';activeCategory='';activeView='recipes';$('listTitle').textContent='Všetky recepty';$('listLabel').textContent='Naša zbierka';buildCategories();render()};$('allCategoriesBtn').onclick=()=>setCategory('');
document.querySelectorAll('.nav-item').forEach(btn=>btn.onclick=()=>{const view=btn.dataset.view;if(view==='settings'){$('infoDialog').showModal();return}activeView=view;updateNavigation(view);if(view==='home')window.scrollTo({top:0,behavior:'smooth'});else document.querySelector('.recipes-section').scrollIntoView({behavior:'smooth'});render()});
function updateNavigation(view){document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===view))}
document.querySelectorAll('dialog .close').forEach(b=>b.onclick=()=>b.closest('dialog').close());
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;$('installBtn').hidden=false});$('installBtn').onclick=async()=>{if(installPrompt){installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$('installBtn').hidden=true}};
if('serviceWorker' in navigator){
  window.addEventListener('load', async()=>{
    try{
      const reg=await navigator.serviceWorker.register('sw.js?v=2.0.3',{updateViaCache:'none'});
      await reg.update();
    }catch(err){console.info('Service worker sa nepodarilo aktualizovať.',err)}
  });
}
init().catch(err=>{console.error(err);$('cards').innerHTML='<p>Nepodarilo sa spustiť aplikáciu.</p>'});
