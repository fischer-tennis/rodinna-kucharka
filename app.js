import{createClient}from'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.95.0/+esm';
const sb=createClient('https://mbgdesaueodahxwmydnn.supabase.co','sb_publishable_lNHmPFBuqHZYcKov9QmprQ_oIq1Jry9'),$=x=>document.getElementById(x);
let user=null,recipes=[],photo=null;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function load(){const{data,error}=await sb.from('recipes').select('*').order('created_at',{ascending:false});recipes=error?[]:data||[];render()}
function render(){const q=$('search').value.toLowerCase();$('cards').innerHTML=recipes.filter(r=>[r.title,r.category,r.author_name,...(r.ingredients||[]),r.instructions].join(' ').toLowerCase().includes(q)).map(r=>`<article><div class="img" style="background-image:url('${esc(r.main_image_url||r.notebook_image_url||'icons/icon-512.png')}')"></div><h3>${esc(r.title)}</h3><p>${esc(r.category||'Ostatné')} · ${esc(r.author_name||'Autor nezadaný')}</p><details><summary>Zobraziť recept</summary><h4>Suroviny</h4><ul>${(r.ingredients||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul><h4>Postup</h4><p>${esc(r.instructions||'')}</p>${r.notebook_image_url?`<img class="source" src="${esc(r.notebook_image_url)}">`:''}</details></article>`).join('')}
function account(){const name=user?.user_metadata?.display_name||user?.email?.split('@')[0];$('accountBtn').textContent=user?`👤 ${name}`:'👤 Prihlásiť';$('addRecipeBtn').hidden=!user;$('logoutBtn').hidden=!user}
sb.auth.getSession().then(({data})=>{user=data.session?.user||null;account();load()});sb.auth.onAuthStateChange((_,s)=>{user=s?.user||null;account();load()});
$('search').oninput=render;$('accountBtn').onclick=()=>{$('authDialog').showModal();$('authMessage').textContent=user?user.email:''};$('addRecipeBtn').onclick=()=>{$('addDialog').showModal()};
document.querySelectorAll('.close').forEach(b=>b.onclick=()=>b.closest('dialog').close());
$('loginBtn').onclick=async()=>{const{error}=await sb.auth.signInWithPassword({email:$('authEmail').value.trim(),password:$('authPassword').value});$('authMessage').textContent=error?'Chyba: '+error.message:'Prihlásenie úspešné'};
$('signupBtn').onclick=async()=>{const{error}=await sb.auth.signUp({email:$('authEmail').value.trim(),password:$('authPassword').value,options:{data:{display_name:$('authName').value.trim()}}});$('authMessage').textContent=error?'Chyba: '+error.message:'Skontroluj potvrdzovací e-mail'};
$('forgotBtn').onclick=async()=>{const email=$('authEmail').value.trim();if(!email)return $('authMessage').textContent='Najprv zadaj e-mail.';const{error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});$('authMessage').textContent=error?'Chyba: '+error.message:'Odkaz bol odoslaný'};
$('logoutBtn').onclick=async()=>{await sb.auth.signOut();$('authDialog').close()};
const prompt=`Prepíš recept z priloženej fotografie. Text môže byť po slovensky alebo česky. Zachovaj presne množstvá, jednotky, teploty a časy. Nič si nevymýšľaj. Nečitateľné miesto označ [nečitateľné].
Odpovedz presne:
NÁZOV: ...
KATEGÓRIA: ...
AUTOR: ...
SUROVINY:
- ...
POSTUP:
...`;
function choose(f){if(!f)return;photo=f;const url=URL.createObjectURL(f);$('aiPhotoPreview').hidden=false;$('aiPhotoPreview').innerHTML=`<img src="${url}"><b>${esc(f.name)}</b>`;try{const d=new DataTransfer();d.items.add(f);$('newNotebookImage').files=d.files}catch{}}
$('cameraRecipeImage').onchange=e=>choose(e.target.files[0]);$('galleryRecipeImage').onchange=e=>choose(e.target.files[0]);
$('copyPromptBtn').onclick=async()=>{await navigator.clipboard.writeText(prompt);$('aiMessage').textContent='Zadanie skopírované. V ChatGPT prilož fotografiu.'};
$('openChatGPTBtn').onclick=()=>window.open('https://chatgpt.com/','_blank','noopener');
function part(t,a,next){const ends=next.map(x=>`(?=\\n\\s*${x}\\s*:)`).join('|')||'$';return(t.match(new RegExp(`${a}\\s*:\\s*([\\s\\S]*?)(?:${ends}|$)`,'i'))?.[1]||'').trim()}
$('fillFromChatGPTBtn').onclick=()=>{const t=$('chatgptResult').value.replace(/\r/g,'');const title=part(t,'NÁZOV',['KATEGÓRIA','AUTOR','SUROVINY','POSTUP']),cat=part(t,'KATEGÓRIA',['AUTOR','SUROVINY','POSTUP']),author=part(t,'AUTOR',['SUROVINY','POSTUP']),ing=part(t,'SUROVINY',['POSTUP']).split('\n').map(x=>x.replace(/^\s*[-•*]\s*/,'').trim()).filter(Boolean),proc=part(t,'POSTUP',[]);if(!title&&!ing.length&&!proc)return $('aiMessage').textContent='Výsledok sa nepodarilo rozpoznať.';$('newTitle').value=title;$('newCategory').value=cat;$('newAuthor').value=author;$('newIngredients').value=ing.join('\n');$('newInstructions').value=proc;$('aiMessage').textContent='Polia boli vyplnené. Skontroluj ich.'};
async function upload(file,id,type,col){if(!file)return;const path=`${user.id}/${id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`,up=await sb.storage.from('recipe-images').upload(path,file);if(up.error)throw up.error;const{data}=sb.storage.from('recipe-images').getPublicUrl(path);await sb.from('recipe_images').insert({recipe_id:id,image_url:data.publicUrl,image_type:type,uploaded_by:user.id});await sb.from('recipes').update({[col]:data.publicUrl}).eq('id',id)}
$('saveNewRecipe').onclick=async()=>{const title=$('newTitle').value.trim();if(!title)return $('addMessage').textContent='Zadaj názov receptu.';$('addMessage').textContent='Ukladám…';const{data,error}=await sb.from('recipes').insert({title,category:$('newCategory').value.trim()||'Ostatné',author_name:$('newAuthor').value.trim()||null,ingredients:$('newIngredients').value.split('\n').map(x=>x.trim()).filter(Boolean),instructions:$('newInstructions').value.trim(),added_by:user.id}).select().single();if(error)return $('addMessage').textContent='Chyba: '+error.message;try{await upload($('newFoodImage').files[0],data.id,'food','main_image_url');await upload($('newNotebookImage').files[0],data.id,'notebook','notebook_image_url')}catch(e){return $('addMessage').textContent='Recept uložený, ale fotka zlyhala: '+e.message}$('addMessage').textContent='Recept bol uložený.';await load();setTimeout(()=>$('addDialog').close(),700)};
if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js');