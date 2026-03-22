let role='viewer';

const plan=document.getElementById('plan');
const wrapper=document.getElementById('plan-wrapper');
const container=document.getElementById('plan-container');

const formModal=document.getElementById('formModal');
const viewModal=document.getElementById('viewModal');
const title=document.getElementById('title');
const pointType=document.getElementById('pointType');
const color=document.getElementById('color');
const emoji=document.getElementById('emoji');
const emojiPickerBtn=document.getElementById('emojiPickerBtn');
const emojiPicker=document.getElementById('emojiPicker');
const colorInputWrapper=document.getElementById('colorInputWrapper');
const emojiInputWrapper=document.getElementById('emojiInputWrapper');
const desc=document.getElementById('desc');
const imagesInput=document.getElementById('imagesInput');
const viewTitle=document.getElementById('viewTitle');
const viewDesc=document.getElementById('viewDesc');
const viewGallery=document.getElementById('viewGallery');
const editHotspotBtn=document.getElementById('editHotspotBtn');
const deleteHotspotBtn=document.getElementById('deleteHotspotBtn');
const imageModal=document.getElementById('imageModal');
const fullImage=document.getElementById('fullImage');

const projectNameText=document.getElementById('projectNameText');
const projectAccessBadge=document.getElementById('projectAccessBadge');
const saveStatus=document.getElementById('saveStatus');
const projectBar=document.getElementById('project-bar');
const projectSettingsModal=document.getElementById('projectSettingsModal');
const projectListModal=document.getElementById('projectListModal');
const myProjectList=document.getElementById('myProjectList');
const communityProjectList=document.getElementById('communityProjectList');
const settingsProjectName=document.getElementById('settingsProjectName');
const settingsOwner=document.getElementById('settingsOwner');
const settingsVisibility=document.getElementById('settingsVisibility');
const settingsPublicAccess=document.getElementById('settingsPublicAccess');
const projectAccessEditor=document.getElementById('projectAccessEditor');
const settingsVisibilityInput=document.getElementById('settingsVisibilityInput');
const settingsPublicAccessInput=document.getElementById('settingsPublicAccessInput');
const settingsAccessError=document.getElementById('settingsAccessError');
const settingsCreatedAt=document.getElementById('settingsCreatedAt');
const settingsUpdatedAt=document.getElementById('settingsUpdatedAt');
const settingsPointCount=document.getElementById('settingsPointCount');
const projectActions=document.getElementById('projectActions');
const renameProjectBtn=document.getElementById('renameProjectBtn');
const duplicateProjectBtn=document.getElementById('duplicateProjectBtn');
const deleteProjectBtn=document.getElementById('deleteProjectBtn');
const renameProjectModal=document.getElementById('renameProjectModal');
const renameProjectInput=document.getElementById('renameProjectInput');
const renameError=document.getElementById('renameError');
const deleteProjectModal=document.getElementById('deleteProjectModal');
const newProjectModal=document.getElementById('newProjectModal');
const newProjectNameInput=document.getElementById('newProjectName');
const newProjectVisibilityInput=document.getElementById('newProjectVisibility');
const newProjectPublicAccessInput=document.getElementById('newProjectPublicAccess');
const newProjectImageInput=document.getElementById('newProjectImage');
const newProjectError=document.getElementById('newProjectError');
const deleteHotspotModal=document.getElementById('deleteHotspotModal');
const usersAdminBtn=document.getElementById('usersAdminBtn');
const newProjectBtn=document.getElementById('newProjectBtn');
const usersModal=document.getElementById('usersModal');
const usersList=document.getElementById('usersList');
const usersNameInput=document.getElementById('usersNameInput');
const usersPasswordInput=document.getElementById('usersPasswordInput');
const usersPasswordToggleBtn=document.getElementById('usersPasswordToggleBtn');
const usersRoleInput=document.getElementById('usersRoleInput');
const usersError=document.getElementById('usersError');

const modeLabel=document.getElementById('modeLabel');
const toolbar=document.getElementById('toolbar');

plan.draggable=false;
plan.addEventListener('dragstart',e=>e.preventDefault());

let hotspots=[], tempCoords=null, editingId=null, currentView=null;
let currentProjectId='';
let currentProjectName='';
let currentProjectCreatedAt=null;
let currentProjectUpdatedAt=null;
let currentProjectOwner='';
let currentProjectVisibility='public';
let currentProjectPublicAccess='editable';
let projectNameCustomized=false;
let currentUsername='';

let scale=1, originX=0, originY=0;
let isDragging=false, moved=false, startX,startY;
let touchMode='none';
let touchStartDistance=0;
let touchStartScale=1;
let longPressTimer=null;
let longPressTriggered=false;
let touchPanStartClientX=0;
let touchPanStartClientY=0;
let touchLastClientX=0;
let touchLastClientY=0;
let lastTapTime=0;
let lastTapX=0;
let lastTapY=0;

const MOBILE_DOUBLE_TAP_MS=320;
const MOBILE_DOUBLE_TAP_DISTANCE=24;
const MOBILE_LONG_PRESS_MS=420;
const MOBILE_MOVE_CANCEL_PX=10;

function clamp(value,min,max){
 return Math.min(max,Math.max(min,value));
}

function applyWrapperTransform(){
 wrapper.style.transform=`translate(${originX}px,${originY}px) scale(${scale})`;
}

function touchDistance(first,second){
 const dx=second.clientX-first.clientX;
 const dy=second.clientY-first.clientY;
 return Math.hypot(dx,dy);
}

function touchCenter(first,second){
 return {
  x:(first.clientX+second.clientX)/2,
  y:(first.clientY+second.clientY)/2
 };
}

function clearLongPressTimer(){
 if(longPressTimer){
  clearTimeout(longPressTimer);
  longPressTimer=null;
 }
}

function zoomAtClient(clientX,clientY,factor){
 const rect=container.getBoundingClientRect();
 const cx=clientX-rect.left;
 const cy=clientY-rect.top;
 const nextScale=clamp(scale*factor,0.2,5);
 const zoom=nextScale/scale;
 originX=cx-(cx-originX)*zoom;
 originY=cy-(cy-originY)*zoom;
 scale=nextScale;
 applyWrapperTransform();
}

function placePointAtClient(clientX,clientY){
 if(!canEditCurrentProject()) return;
 const rect=plan.getBoundingClientRect();
 tempCoords={ x:(clientX-rect.left)/rect.width, y:(clientY-rect.top)/rect.height };
 openForm();
}

function sanitizeProjectName(name){
 const cleaned=(name||'').trim().replace(/\.json$/i,'').replace(/[<>:"/\\|?*\x00-\x1F]/g,'_').slice(0,120).trim();
 return cleaned||'project';
}

function formatDate(value){
 if(!value) return '-';
 const date=new Date(value);
 if(Number.isNaN(date.getTime())) return '-';
 return date.toLocaleString('fr-FR');
}

function sanitizeVisibility(value){
 return value==='private'?'private':'public';
}

function sanitizePublicAccess(value){
 return value==='view_only'?'view_only':'editable';
}

function canEditProjectMeta(project={}){
 if(role==='admin') return true;
 if(role==='viewer') return false;
 const owner=(project.ownerUsername||'').toLowerCase();
 const visibility=sanitizeVisibility(project.visibility);
 if(visibility==='private') return owner===currentUsername;
 const publicAccess=sanitizePublicAccess(project.publicAccess);
 if(publicAccess==='editable') return true;
 return owner===currentUsername;
}

function canEditCurrentProject(){
 return canEditProjectMeta({
  ownerUsername:currentProjectOwner,
  visibility:currentProjectVisibility,
  publicAccess:currentProjectPublicAccess
 });
}

function canManageProjectIdentityMeta(project={}){
 if(role==='admin') return true;
 if(role==='viewer') return false;
 return (project.ownerUsername||'').toLowerCase()===currentUsername;
}

function canManageCurrentProjectIdentity(){
 return canManageProjectIdentityMeta({ownerUsername:currentProjectOwner});
}

function getMyProjectAccessibility(project={}){
 const visibility=sanitizeVisibility(project.visibility);
 if(visibility==='private') return 'private';
 return sanitizePublicAccess(project.publicAccess);
}

function updateSettingsAccessInputs(){
 const isPublic=sanitizeVisibility(settingsVisibilityInput.value)==='public';
 settingsPublicAccessInput.disabled=!isPublic;
 if(!isPublic){
  settingsPublicAccessInput.value='view_only';
 }
}

function updateNewProjectAccessUi(){
 if(!newProjectVisibilityInput || !newProjectPublicAccessInput) return;
 const isPublic=sanitizeVisibility(newProjectVisibilityInput.value)==='public';
 newProjectPublicAccessInput.disabled=!isPublic;
 if(!isPublic){
  newProjectPublicAccessInput.value='view_only';
 }
}

function setSaveStatus(message,isError=false){
 saveStatus.textContent=message;
 saveStatus.style.color=isError?'#ff9b9b':'#9dff9d';
}

function updateModeUi(){
 modeLabel.textContent=currentUsername?`${currentUsername} (${role})`:`- (${role})`;
 projectActions.style.display=canEditCurrentProject()?'flex':'none';
 usersAdminBtn.style.display=role==='admin'?'inline-block':'none';
 newProjectBtn.style.display=role!=='viewer'?'inline-block':'none';
}

function updateProjectHeader(){
 projectNameText.textContent=currentProjectName;
 const accessLabel=currentProjectVisibility==='private'?'private':sanitizePublicAccess(currentProjectPublicAccess);
 projectAccessBadge.textContent=accessLabel;
}

function updateProjectBarVisibility(){
 projectBar.style.display=currentProjectId?'flex':'none';
 toolbar.classList.toggle('no-project',!currentProjectId);
 if(currentProjectId){
  toolbar.classList.remove('mobile-open');
 }
}

function togglePasswordVisibility(input,button){
 const hidden=input.type==='password';
 input.type=hidden?'text':'password';
 button.textContent=hidden?'Masquer':'Voir';
}

if(usersPasswordToggleBtn && usersPasswordInput){
 usersPasswordToggleBtn.addEventListener('click',()=>togglePasswordVisibility(usersPasswordInput,usersPasswordToggleBtn));
}

function toggleToolbar(){
 if(!currentProjectId) return;
 const willOpen=!toolbar.classList.contains('mobile-open');
 toolbar.classList.toggle('mobile-open');
 if(willOpen) pushMobileBackState();
}

function closeToolbarMenu(){
 toolbar.classList.remove('mobile-open');
}

function isMobileViewport(){
 return window.matchMedia('(max-width: 768px)').matches;
}

function pushMobileBackState(){
 if(!isMobileViewport()) return;
 history.pushState({menuOpen:true},'');
}

function closeTopOpenMenu(){
 if(imageModal.style.display==='flex'){ closeFullImage(); return true; }
 if(newProjectModal.style.display==='flex'){ closeNewProjectModal(); return true; }
 if(renameProjectModal.style.display==='flex'){ closeRenameProject(); return true; }
 if(deleteProjectModal.style.display==='flex'){ closeDeleteProjectConfirm(); return true; }
 if(projectSettingsModal.style.display==='flex'){ closeProjectSettings(); return true; }
 if(usersModal.style.display==='flex'){ closeUsersModal(); return true; }
 if(formModal.style.display==='flex'){ closeForm(); return true; }
 if(viewModal.style.display==='flex'){ closeView(); return true; }
 if(projectListModal.style.display==='flex'){ closeProjectList(); return true; }
 if(toolbar.classList.contains('mobile-open')){ closeToolbarMenu(); return true; }
 return false;
}

async function apiFetch(url,options={}){
 const response=await fetch(url,options);
 if(response.status===401){
  window.location.href='/login';
  throw new Error('unauthenticated');
 }
 return response;
}

async function bootstrapAuth(){
 try{
  const response=await apiFetch('/auth/me');
  if(!response.ok) throw new Error('auth failed');
  const payload=await response.json();
  const receivedRole=payload.user?.role;
  role=(receivedRole==='admin'||receivedRole==='editor')?receivedRole:'viewer';
  currentUsername=payload.user?.username||'';
  updateModeUi();
 }catch(_err){
  window.location.href='/login';
 }
}

function applyLoadedProject(data,fallbackName){
 currentProjectId=String(data.projectId||'');
 plan.src=data.image||'';
 hotspots=Array.isArray(data.hotspots)?data.hotspots:[];
 currentProjectName=sanitizeProjectName(data.projectName||fallbackName||currentProjectName);
 currentProjectCreatedAt=data.createdAt||null;
 currentProjectUpdatedAt=data.updatedAt||null;
 currentProjectOwner=(data.ownerUsername||currentUsername||'').toLowerCase();
 currentProjectVisibility=sanitizeVisibility(data.visibility);
 currentProjectPublicAccess=sanitizePublicAccess(data.publicAccess);
 projectNameCustomized=true;
 updateProjectHeader();
 updateProjectBarVisibility();
 updateModeUi();
 refresh();
}

async function logout(){
 try{
  await apiFetch('/auth/logout',{method:'POST'});
 }catch(_err){
 }
 window.location.href='/login';
}

container.addEventListener('wheel',e=>{
 e.preventDefault();
 const rect=container.getBoundingClientRect();
 const mouseX=e.clientX-rect.left;
 const mouseY=e.clientY-rect.top;
 const zoom=e.deltaY<0?1.05:0.95;

 originX=mouseX-(mouseX-originX)*zoom;
 originY=mouseY-(mouseY-originY)*zoom;
 scale*=zoom;

 applyWrapperTransform();
});

container.addEventListener('mousedown',e=>{
 if(e.button!==0) return;
 e.preventDefault();
 isDragging=true; moved=false;
 startX=e.clientX-originX; startY=e.clientY-originY;
 container.style.cursor='grabbing';
});

window.addEventListener('mousemove',e=>{
 if(!isDragging) return;
 if (originX!==e.clientX-startX || originY!==e.clientY-startY) moved=true;
 originX=e.clientX-startX; originY=e.clientY-startY;
 applyWrapperTransform();
});

window.addEventListener('mouseup',()=>{
 isDragging=false;
 container.style.cursor='default';
});

container.addEventListener('touchstart',e=>{
 longPressTriggered=false;
 if(e.touches.length===1){
  const touch=e.touches[0];
  isDragging=true;
  touchMode='pan';
  moved=false;
  longPressTriggered=false;
  startX=touch.clientX-originX;
  startY=touch.clientY-originY;
  touchPanStartClientX=touch.clientX;
  touchPanStartClientY=touch.clientY;
  touchLastClientX=touch.clientX;
  touchLastClientY=touch.clientY;

  clearLongPressTimer();
  if(canEditCurrentProject()){
   longPressTimer=setTimeout(()=>{
    if(touchMode==='pan' && !moved){
      longPressTriggered=true;
      isDragging=false;
      placePointAtClient(touchLastClientX,touchLastClientY);
    }
   },MOBILE_LONG_PRESS_MS);
  }
 }

 if(e.touches.length===2){
  clearLongPressTimer();
  const first=e.touches[0];
  const second=e.touches[1];
  isDragging=false;
  touchMode='pinch';
  moved=true;
  touchStartDistance=touchDistance(first,second);
  touchStartScale=scale;
 }
},{passive:false});

container.addEventListener('touchmove',e=>{
 if(touchMode==='pan' && e.touches.length===1){
  e.preventDefault();
  const touch=e.touches[0];
  touchLastClientX=touch.clientX;
  touchLastClientY=touch.clientY;
  const movedDistance=Math.hypot(touch.clientX-touchPanStartClientX,touch.clientY-touchPanStartClientY);
  if(movedDistance>MOBILE_MOVE_CANCEL_PX){
   clearLongPressTimer();
  }
  if(originX!==touch.clientX-startX || originY!==touch.clientY-startY) moved=true;
  originX=touch.clientX-startX;
  originY=touch.clientY-startY;
  applyWrapperTransform();
  return;
 }

 if(touchMode==='pinch' && e.touches.length===2){
  e.preventDefault();
  const first=e.touches[0];
  const second=e.touches[1];
  const center=touchCenter(first,second);
  const rect=container.getBoundingClientRect();
  const cx=center.x-rect.left;
  const cy=center.y-rect.top;
  const currentDistance=touchDistance(first,second);
  const nextScale=clamp(touchStartScale*(currentDistance/touchStartDistance),0.2,5);
  const zoom=nextScale/scale;
  originX=cx-(cx-originX)*zoom;
  originY=cy-(cy-originY)*zoom;
  scale=nextScale;
  applyWrapperTransform();
 }
},{passive:false});

container.addEventListener('touchend',e=>{
 clearLongPressTimer();

 if(e.touches.length===0){
  isDragging=false;
  const changed=e.changedTouches && e.changedTouches[0] ? e.changedTouches[0] : null;
  if(changed){
   touchLastClientX=changed.clientX;
   touchLastClientY=changed.clientY;
  }

  if(touchMode==='pan' && !moved && !longPressTriggered){
   const now=Date.now();
   const delta=now-lastTapTime;
   const distance=Math.hypot(touchLastClientX-lastTapX,touchLastClientY-lastTapY);
   if(delta<=MOBILE_DOUBLE_TAP_MS && distance<=MOBILE_DOUBLE_TAP_DISTANCE){
    zoomAtClient(touchLastClientX,touchLastClientY,1.35);
    lastTapTime=0;
   }else{
    lastTapTime=now;
    lastTapX=touchLastClientX;
    lastTapY=touchLastClientY;
   }
  }

  longPressTriggered=false;
  touchMode='none';
  return;
 }

 if(e.touches.length===1){
  const touch=e.touches[0];
  touchMode='pan';
  startX=touch.clientX-originX;
  startY=touch.clientY-originY;
 }
});

container.addEventListener('touchcancel',()=>{
 clearLongPressTimer();
 isDragging=false;
 longPressTriggered=false;
 touchMode='none';
});

container.addEventListener('click',e=>{
 if(isMobileViewport()) return;
 if(moved) return;
 if(!canEditCurrentProject()) return;
 const rect=plan.getBoundingClientRect();
 tempCoords={ x:(e.clientX-rect.left)/rect.width, y:(e.clientY-rect.top)/rect.height };
 openForm();
});

function togglePointTypeInput(){
 if(pointType.value==='color'){
  colorInputWrapper.style.display='block';
  emojiInputWrapper.style.display='none';
  closeEmojiPicker();
 }else{
  colorInputWrapper.style.display='none';
  emojiInputWrapper.style.display='block';
 }
}

function setSelectedEmoji(value){
 const selected=value||'📍';
 emoji.value=selected;
 if(emojiPickerBtn) emojiPickerBtn.textContent=selected;
}

function toggleEmojiPicker(){
 if(!emojiPicker) return;
 const isOpen=emojiPicker.style.display!=='none';
 emojiPicker.style.display=isOpen?'none':'block';
}

function closeEmojiPicker(){
 if(!emojiPicker) return;
 emojiPicker.style.display='none';
}

if(emojiPicker){
 emojiPicker.addEventListener('emoji-click',event=>{
  setSelectedEmoji(event.detail?.unicode||'📍');
  closeEmojiPicker();
 });
}

document.addEventListener('click',event=>{
 if(!emojiPicker || pointType.value!=='emoji') return;
 const inPicker=emojiPicker.contains(event.target);
 const isButton=event.target?.closest?.('#emojiPickerBtn');
 if(!inPicker && !isButton) closeEmojiPicker();
});

function openForm(h=null){
 if(!canEditCurrentProject()) return;
 formModal.style.display='flex';
 pushMobileBackState();
 if(h){
  editingId=h.id;
  title.value=h.title;
  const pointKind=h.type||'color';
  pointType.value=pointKind;
  togglePointTypeInput();
  if(pointKind==='emoji'){
    setSelectedEmoji(h.value||'📍');
  }else{
   color.value=h.value||h.color||'#FF0000';
  }
  desc.value=h.desc;
 }else{
  editingId=null;
  title.value='';
  pointType.value='color';
  togglePointTypeInput();
  color.value='#FF0000';
  setSelectedEmoji('📍');
  desc.value='';
  imagesInput.value='';
 }
}

function closeForm(){ formModal.style.display='none'; }

function saveHotspot(){
 if(!canEditCurrentProject()) return;
 const files=imagesInput.files;
 const type=pointType.value;
 const value=type==='emoji'?(emoji.value||'📍'):color.value;
 Promise.all([...files].map(f=>{
  const formData=new FormData();
  formData.append('file',f);
  return apiFetch('/upload',{method:'POST',body:formData}).then(r=>r.text());
 })).then(urls=>{
  if(editingId){
   const h=hotspots.find(x=>x.id===editingId);
   h.title=title.value;
   h.type=type;
   h.value=value;
   h.desc=desc.value;
   if(urls.length) h.images=urls;
  }else{
   hotspots.push({id:Date.now(),...tempCoords,title:title.value,type,value,desc:desc.value,images:urls});
  }
  refresh();
  closeForm();
    saveProject();
 });
}

function createHotspotElement(h){
 const el=document.createElement('div');
 el.className='hotspot';
 el.style.left=(h.x*100)+'%';
 el.style.top=(h.y*100)+'%';
 el.onclick=e=>{ e.stopPropagation(); openView(h); };

 const pointKind=h.type||'color';
 if(pointKind==='emoji'){
  el.classList.add('hotspot-emoji');
  el.textContent=h.value||'📍';
 }else{
  el.classList.add('hotspot-color');
  el.style.background=h.value||h.color||'#FF0000';
 }
 wrapper.appendChild(el);
}

function refresh(){
 wrapper.querySelectorAll('.hotspot').forEach(e=>e.remove());
 hotspots.forEach(createHotspotElement);
}

async function resolveImageUrl(src){
 if(!src || src.startsWith('data:') || /^https?:\/\//i.test(src)) return src;
 if(src.startsWith('/image/')) return src;
 try{
  const response=await apiFetch(`/image-url?src=${encodeURIComponent(src)}`);
  if(!response.ok) return src;
  return await response.text();
 }catch(_err){
  return src;
 }
}

async function openView(h){
 currentView=h;
 viewTitle.innerText=h.title;
 viewDesc.innerText=h.desc;
 viewGallery.innerHTML='';
 const canEdit=canEditCurrentProject();
 editHotspotBtn.style.display=canEdit?'inline-block':'none';
 deleteHotspotBtn.style.display=canEdit?'inline-block':'none';

 const resolvedSources=await Promise.all((h.images||[]).map(resolveImageUrl));
 resolvedSources.forEach(src=>{
  const img=document.createElement('img');
  img.src=src;
  img.onclick=()=>showFullImage(src);
  viewGallery.appendChild(img);
 });
 viewModal.style.display='flex';
 pushMobileBackState();
}

function closeView(){ viewModal.style.display='none'; }
function showFullImage(src){ fullImage.src=src; imageModal.style.display='flex'; }
function closeFullImage(){ imageModal.style.display='none'; fullImage.src=''; }
function editHotspot(){ if(!canEditCurrentProject()) return; closeView(); openForm(currentView); }
function deleteHotspotConfirm(){ if(!canEditCurrentProject()) return; deleteHotspotModal.style.display='flex'; pushMobileBackState(); }
function confirmDeleteHotspot(){ if(!canEditCurrentProject()) return; hotspots=hotspots.filter(h=>h.id!==currentView.id); closeDeleteHotspotConfirm(); closeView(); refresh(); saveProject(); }
function closeDeleteHotspotConfirm(){ deleteHotspotModal.style.display='none'; }

function openProjectSettings(){
 closeToolbarMenu();
 settingsProjectName.textContent=currentProjectName;
 settingsOwner.textContent=currentProjectOwner||'-';
 settingsVisibility.textContent=currentProjectVisibility;
 settingsPublicAccess.textContent=currentProjectVisibility==='private'?'-':currentProjectPublicAccess;
 settingsVisibilityInput.value=currentProjectVisibility;
 settingsPublicAccessInput.value=currentProjectPublicAccess;
 updateSettingsAccessInputs();
 settingsAccessError.textContent='';
 const canManageIdentity=canManageCurrentProjectIdentity();
 projectAccessEditor.style.display=canManageIdentity?'block':'none';
 renameProjectBtn.style.display=canManageIdentity?'inline-block':'none';
 deleteProjectBtn.style.display=canManageIdentity?'inline-block':'none';
 duplicateProjectBtn.style.display=canEditCurrentProject()?'inline-block':'none';
 settingsCreatedAt.textContent=formatDate(currentProjectCreatedAt);
 settingsUpdatedAt.textContent=formatDate(currentProjectUpdatedAt);
 settingsPointCount.textContent=String(hotspots.length);
 updateModeUi();
 projectSettingsModal.style.display='flex';
 pushMobileBackState();
}

function closeProjectSettings(){ projectSettingsModal.style.display='none'; }
async function saveProjectAccessSettings(){
 if(!canManageCurrentProjectIdentity()) return;
 settingsAccessError.textContent='';
 try{
  const visibility=sanitizeVisibility(settingsVisibilityInput.value);
  const publicAccess=sanitizePublicAccess(settingsPublicAccessInput.value);
  const response=await apiFetch('/project/access',{
   method:'POST',
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify({projectId:currentProjectId,visibility,publicAccess})
  });
  if(response.status===409){ settingsAccessError.textContent='Nom déjà utilisé par un projet public.'; return; }
  if(!response.ok) throw new Error('access update failed');
  const result=await response.json();
  currentProjectVisibility=sanitizeVisibility(result.project?.visibility||visibility);
  currentProjectPublicAccess=sanitizePublicAccess(result.project?.publicAccess||publicAccess);
  currentProjectUpdatedAt=result.project?.updatedAt||new Date().toISOString();
  settingsVisibility.textContent=currentProjectVisibility;
  settingsPublicAccess.textContent=currentProjectVisibility==='private'?'-':currentProjectPublicAccess;
  updateModeUi();
  setSaveStatus('Accès du projet mis à jour');
 }catch(_err){
  settingsAccessError.textContent='Erreur de mise à jour de l’accès.';
 }
}
function openRenameProject(){
 if(!canManageCurrentProjectIdentity()) return;
 renameProjectInput.value=currentProjectName;
 renameError.textContent='';
 renameProjectModal.style.display='flex';
 pushMobileBackState();
}
function closeRenameProject(){ renameProjectModal.style.display='none'; }
function openDeleteProjectConfirm(){ if(canManageCurrentProjectIdentity()){ deleteProjectModal.style.display='flex'; pushMobileBackState(); } }
function closeDeleteProjectConfirm(){ deleteProjectModal.style.display='none'; }
function closeProjectList(){ projectListModal.style.display='none'; }

function openNewProjectModal(){
 closeToolbarMenu();
 newProjectNameInput.value='';
 newProjectVisibilityInput.value='private';
 newProjectPublicAccessInput.value='view_only';
 newProjectImageInput.value='';
 newProjectError.textContent='';
 updateNewProjectAccessUi();
 newProjectModal.style.display='flex';
 pushMobileBackState();
}

function closeNewProjectModal(){ newProjectModal.style.display='none'; }

function readFileAsDataUrl(file){
 return new Promise((resolve,reject)=>{
  const reader=new FileReader();
  reader.onload=()=>resolve(reader.result);
  reader.onerror=()=>reject(new Error('file read error'));
  reader.readAsDataURL(file);
 });
}

newProjectImageInput.addEventListener('change',e=>{
 const selected=e.target.files[0];
 if(!selected || newProjectNameInput.value.trim()) return;
 newProjectNameInput.value=sanitizeProjectName(selected.name.replace(/\.[^.]+$/,''));
});

if(newProjectVisibilityInput){
 newProjectVisibilityInput.addEventListener('change',updateNewProjectAccessUi);
}

if(settingsVisibilityInput){
 settingsVisibilityInput.addEventListener('change',updateSettingsAccessInputs);
}

async function confirmCreateProject(){
 if(role==='viewer') return;
 const selectedFile=newProjectImageInput.files[0];
 if(!selectedFile){ newProjectError.textContent='Choisissez une image de fond.'; return; }
 const projectName=sanitizeProjectName(newProjectNameInput.value);
 const visibility=sanitizeVisibility(newProjectVisibilityInput.value);
 const publicAccess=sanitizePublicAccess(newProjectPublicAccessInput.value);
 newProjectNameInput.value=projectName;
 newProjectError.textContent='';
 try{
  const image=await readFileAsDataUrl(selectedFile);
  const response=await apiFetch('/project/create',{
   method:'POST',
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify({projectName,image,visibility,publicAccess})
  });
  if(response.status===409){ newProjectError.textContent='Un projet avec ce nom existe déjà.'; return; }
  if(!response.ok) throw new Error('create failed');
  const result=await response.json();
  applyLoadedProject(result.project,result.projectName);
  currentProjectId=String(result.project?.projectId||'');
  currentProjectCreatedAt=result.project.createdAt||null;
  currentProjectUpdatedAt=result.project.updatedAt||null;
  projectNameCustomized=true;
  closeNewProjectModal();
  setSaveStatus(`Projet créé: ${currentProjectName}`);
 }catch(_err){
  newProjectError.textContent='Erreur lors de la création du projet.';
 }
}

async function confirmRenameProject(){
 if(!canManageCurrentProjectIdentity()) return;
 const newName=sanitizeProjectName(renameProjectInput.value);
 if(newName===currentProjectName){ closeRenameProject(); return; }
 renameError.textContent='';
 try{
  const response=await apiFetch('/project/rename',{
   method:'POST',
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify({projectId:currentProjectId,toName:newName})
  });
  if(response.status===409){ renameError.textContent='Ce nom existe déjà.'; return; }
  if(!response.ok) throw new Error('rename failed');
  const result=await response.json();
  currentProjectName=sanitizeProjectName(result.projectName||newName);
  currentProjectUpdatedAt=result.updatedAt||new Date().toISOString();
  currentProjectCreatedAt=result.createdAt||currentProjectCreatedAt;
  projectNameCustomized=true;
  updateProjectHeader();
  closeRenameProject();
  closeProjectSettings();
  setSaveStatus(`Renommé: ${currentProjectName}`);
 }catch(_err){
  renameError.textContent='Erreur de renommage.';
 }
}

async function confirmDeleteProject(){
 if(!canManageCurrentProjectIdentity()) return;
 try{
  const response=await apiFetch(`/project/${encodeURIComponent(currentProjectId)}`,{method:'DELETE'});
  if(!response.ok) throw new Error('delete failed');
  currentProjectId='';
  hotspots=[];
  plan.src='';
  currentProjectName='project';
  currentProjectCreatedAt=null;
  currentProjectUpdatedAt=null;
  currentProjectOwner=currentUsername;
  currentProjectVisibility='public';
  currentProjectPublicAccess='editable';
  projectNameCustomized=false;
  refresh();
  updateProjectHeader();
  updateProjectBarVisibility();
  updateModeUi();
  closeDeleteProjectConfirm();
  closeProjectSettings();
  setSaveStatus('Projet supprimé');
 }catch(_err){
  setSaveStatus('Erreur suppression projet',true);
 }
}

async function duplicateProject(){
 if(!canEditCurrentProject()) return;
 const saved=await saveProject();
 if(!saved) return;
 try{
  const response=await apiFetch('/project/duplicate',{
   method:'POST',
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify({projectId:currentProjectId})
  });
  if(response.status===409){ setSaveStatus('Erreur: copie déjà existante',true); return; }
  if(!response.ok) throw new Error('duplicate failed');
  const result=await response.json();
  await loadProjectById(result.projectId);
  closeProjectSettings();
  setSaveStatus(`Dupliqué: ${result.projectName}`);
 }catch(_err){
  setSaveStatus('Erreur duplication projet',true);
 }
}

async function loadProjectById(projectId){
 const response=await apiFetch(`/project/${encodeURIComponent(projectId)}`);
 if(!response.ok) throw new Error('project not found');
 const data=await response.json();
 applyLoadedProject(data,data.projectName);
 closeProjectList();
}

async function renameProjectFromList(project){
 const nameValue=sanitizeProjectName(project?.projectName||'project');
 if(!canManageProjectIdentityMeta(project)) return;
 const proposed=prompt('Nouveau nom du projet :',nameValue);
 if(proposed===null) return;
 const newName=sanitizeProjectName(proposed);
 if(newName===nameValue) return;
 try{
  const response=await apiFetch('/project/rename',{
   method:'POST',
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify({projectId:project.projectId,toName:newName})
  });
  if(response.status===409){ setSaveStatus('Ce nom existe déjà.',true); return; }
  if(!response.ok) throw new Error('rename failed');
  if(String(currentProjectId)===String(project.projectId)){
   currentProjectName=newName;
   updateProjectHeader();
  }
  setSaveStatus(`Renommé: ${nameValue} → ${newName}`);
  openProjectList();
 }catch(_err){
  setSaveStatus('Erreur de renommage',true);
 }
}

async function duplicateProjectFromList(project){
 const canEdit=canEditProjectMeta(project);
 if(!canEdit) return;
 try{
  const response=await apiFetch('/project/duplicate',{
   method:'POST',
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify({projectId:project.projectId})
  });
  if(response.status===409){ setSaveStatus('La copie existe déjà.',true); return; }
  if(!response.ok) throw new Error('duplicate failed');
  const result=await response.json();
  await loadProjectById(result.projectId);
  setSaveStatus(`Dupliqué: ${result.projectName}`);
 }catch(_err){
  setSaveStatus('Erreur duplication projet',true);
 }
}

async function deleteProjectFromList(project){
 const nameValue=sanitizeProjectName(project?.projectName||'project');
 if(!canManageProjectIdentityMeta(project)) return;
 if(!confirm(`Supprimer le projet "${nameValue}" ?`)) return;
 try{
  const response=await apiFetch(`/project/${encodeURIComponent(project.projectId)}`,{method:'DELETE'});
  if(!response.ok) throw new Error('delete failed');
  if(String(currentProjectId)===String(project.projectId)){
   currentProjectId='';
   hotspots=[];
   plan.src='';
   currentProjectName='project';
   currentProjectCreatedAt=null;
   currentProjectUpdatedAt=null;
   currentProjectOwner=currentUsername;
   currentProjectVisibility='public';
   currentProjectPublicAccess='editable';
   projectNameCustomized=false;
   refresh();
   updateProjectHeader();
  updateProjectBarVisibility();
  updateModeUi();
  }
  setSaveStatus(`Projet supprimé: ${nameValue}`);
  openProjectList();
 }catch(_err){
  setSaveStatus('Erreur suppression projet',true);
 }
}

async function openProjectList(){
 closeToolbarMenu();
 myProjectList.textContent='Chargement...';
 communityProjectList.textContent='Chargement...';
 projectListModal.style.display='flex';
 pushMobileBackState();
 try{
  const response=await apiFetch('/projects');
  const data=await response.json();
  const myProjects=Array.isArray(data.myProjects)?data.myProjects:[];
  const communityProjects=Array.isArray(data.communityProjects)?data.communityProjects:[];

  myProjectList.innerHTML='';
  communityProjectList.innerHTML='';

  if(!myProjects.length){
   myProjectList.textContent='Aucun projet personnel.';
  }

  if(!communityProjects.length){
   communityProjectList.textContent='Aucun projet communautaire.';
  }

  const renderProjectRow=(project,targetList,isCommunity)=>{
    const name=sanitizeProjectName(project.projectName||'project');
    const row=document.createElement('div');
    row.className='project-row';

    const loadBtn=document.createElement('button');
    loadBtn.className='project-load-btn';
    const projectAccessibility=sanitizeVisibility(project.visibility)==='private'?'private':sanitizePublicAccess(project.publicAccess);
    const accessLabel=isCommunity
      ? `${project.ownerUsername||'unknown'} • ${projectAccessibility}`
      : getMyProjectAccessibility(project);
    loadBtn.textContent=`${name} (${accessLabel})`;
    loadBtn.onclick=()=>loadProjectById(project.projectId).catch(()=>setSaveStatus('Erreur chargement projet',true));
    row.appendChild(loadBtn);

    if(canEditProjectMeta(project)){
     const renameBtn=document.createElement('button');
     renameBtn.className='project-action-btn';
     renameBtn.textContent='🖉';
     renameBtn.title='Renommer';
     renameBtn.onclick=()=>renameProjectFromList(project);
     if(canManageProjectIdentityMeta(project)) row.appendChild(renameBtn);

     const duplicateBtn=document.createElement('button');
     duplicateBtn.className='project-action-btn';
     duplicateBtn.textContent='🗍';
     duplicateBtn.title='Dupliquer';
     duplicateBtn.onclick=()=>duplicateProjectFromList(project);
     row.appendChild(duplicateBtn);

     const deleteBtn=document.createElement('button');
     deleteBtn.className='project-action-btn';
     deleteBtn.textContent='🗑️';
     deleteBtn.title='Supprimer';
     deleteBtn.onclick=()=>deleteProjectFromList(project);
     if(canManageProjectIdentityMeta(project)) row.appendChild(deleteBtn);
    }

    targetList.appendChild(row);
  };

  myProjects.forEach(project=>renderProjectRow(project,myProjectList,false));
  communityProjects.forEach(project=>renderProjectRow(project,communityProjectList,true));
 }catch(_err){
  myProjectList.textContent='Erreur lors du chargement des projets.';
  communityProjectList.textContent='Erreur lors du chargement des projets.';
 }
}

  function closeUsersModal(){
   usersModal.style.display='none';
  }

  function renderUsersList(items){
   usersList.innerHTML='';
   if(!items.length){
    usersList.textContent='Aucun utilisateur';
    return;
   }

   items.forEach(user=>{
    const row=document.createElement('div');
    row.className='user-row';

    const name=document.createElement('span');
    name.className='user-name';
    name.textContent=user.username;
    row.appendChild(name);

    const roleSelect=document.createElement('select');
      roleSelect.innerHTML='<option value="viewer">viewer</option><option value="editor">editor</option><option value="admin">admin</option>';
    roleSelect.value=user.role;
    row.appendChild(roleSelect);

    const passwordWrap=document.createElement('div');
    passwordWrap.className='password-with-toggle';

    const passwordInput=document.createElement('input');
    passwordInput.type='password';
    passwordInput.placeholder='nouveau mot de passe';
    passwordWrap.appendChild(passwordInput);

    const passwordToggleBtn=document.createElement('button');
    passwordToggleBtn.type='button';
    passwordToggleBtn.className='password-toggle-btn';
    passwordToggleBtn.textContent='Voir';
    passwordToggleBtn.onclick=()=>togglePasswordVisibility(passwordInput,passwordToggleBtn);
    passwordWrap.appendChild(passwordToggleBtn);

    row.appendChild(passwordWrap);

    const saveBtn=document.createElement('button');
    saveBtn.textContent='Save';
    saveBtn.onclick=()=>updateUserFromRow(user.username,roleSelect.value,passwordInput.value);
    row.appendChild(saveBtn);

    const deleteBtn=document.createElement('button');
    deleteBtn.textContent='Delete';
    deleteBtn.onclick=()=>deleteUserFromRow(user.username);
    if(user.username===currentUsername) deleteBtn.disabled=true;
    row.appendChild(deleteBtn);

    usersList.appendChild(row);
   });
  }

  async function refreshUsersList(){
   if(role!=='admin') return;
   usersList.textContent='Chargement...';
   try{
    const response=await apiFetch('/auth/users');
    if(!response.ok) throw new Error('load users failed');
    const data=await response.json();
    renderUsersList(Array.isArray(data.users)?data.users:[]);
   }catch(_err){
    usersList.textContent='Erreur chargement utilisateurs';
   }
  }

  async function openUsersModal(){
   if(role!=='admin') return;
    closeToolbarMenu();
   usersError.textContent='';
   usersNameInput.value='';
   usersPasswordInput.value='';
   usersRoleInput.value='viewer';
   usersModal.style.display='flex';
  pushMobileBackState();
   await refreshUsersList();
  }

  async function createUserFromModal(){
   if(role!=='admin') return;
   usersError.textContent='';
   const username=(usersNameInput.value||'').trim().toLowerCase();
   const password=usersPasswordInput.value||'';
    const roleValue=usersRoleInput.value==='admin'?'admin':usersRoleInput.value==='editor'?'editor':'viewer';
   try{
    const response=await apiFetch('/auth/users',{
     method:'POST',
     headers:{'Content-Type':'application/json'},
     body:JSON.stringify({username,password,role:roleValue})
    });
    if(response.status===409){ usersError.textContent='Utilisateur déjà existant'; return; }
    if(response.status===400){ usersError.textContent='Données invalides'; return; }
    if(!response.ok) throw new Error('create user failed');
    usersNameInput.value='';
    usersPasswordInput.value='';
    usersRoleInput.value='viewer';
    await refreshUsersList();
   }catch(_err){
    usersError.textContent='Erreur création utilisateur';
   }
  }

  async function updateUserFromRow(username,roleValue,password){
   if(role!=='admin') return;
   usersError.textContent='';
   try{
    const response=await apiFetch(`/auth/users/${encodeURIComponent(username)}`,{
     method:'PATCH',
     headers:{'Content-Type':'application/json'},
     body:JSON.stringify({role:roleValue,password})
    });
    if(response.status===400){ usersError.textContent='Modification refusée'; return; }
    if(response.status===404){ usersError.textContent='Utilisateur introuvable'; return; }
    if(!response.ok) throw new Error('update failed');
    await refreshUsersList();
   }catch(_err){
    usersError.textContent='Erreur modification utilisateur';
   }
  }

  async function deleteUserFromRow(username){
   if(role!=='admin') return;
   if(!confirm(`Supprimer l'utilisateur "${username}" ?`)) return;
   usersError.textContent='';
   try{
    const response=await apiFetch(`/auth/users/${encodeURIComponent(username)}`,{method:'DELETE'});
    if(response.status===400){ usersError.textContent='Suppression refusée'; return; }
    if(response.status===404){ usersError.textContent='Utilisateur introuvable'; return; }
    if(!response.ok) throw new Error('delete failed');
    await refreshUsersList();
   }catch(_err){
    usersError.textContent='Erreur suppression utilisateur';
   }
  }

window.addEventListener('keydown',e=>{
 if(e.key!=='Escape') return;
 closeTopOpenMenu();
});

window.addEventListener('popstate',()=>{
 closeTopOpenMenu();
});

async function saveProject(){
 if(!canEditCurrentProject()){
  setSaveStatus('Lecture seule: vous ne pouvez pas modifier ce projet.',true);
  return false;
 }
 if(!currentProjectId){
  setSaveStatus('Aucun projet chargé.',true);
  return false;
 }
 const projectName=sanitizeProjectName(currentProjectName);
 currentProjectName=projectName;
 updateProjectHeader();
 try{
  const response=await apiFetch('/save',{
   method:'POST',
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify({
    projectId:currentProjectId,
    projectName,
    image:plan.src,
    hotspots,
    createdAt:currentProjectCreatedAt
   })
  });
  if(!response.ok) throw new Error('save failed');
  const result=await response.json();
  currentProjectId=String(result.projectId||currentProjectId);
  currentProjectName=sanitizeProjectName(result.projectName||projectName);
  currentProjectCreatedAt=result.createdAt||currentProjectCreatedAt||new Date().toISOString();
  currentProjectUpdatedAt=result.updatedAt||new Date().toISOString();
  currentProjectOwner=(result.ownerUsername||currentProjectOwner||currentUsername).toLowerCase();
  currentProjectVisibility=sanitizeVisibility(result.visibility||currentProjectVisibility);
  currentProjectPublicAccess=sanitizePublicAccess(result.publicAccess||currentProjectPublicAccess);
  updateProjectHeader();
  updateModeUi();
  setSaveStatus(`Saved: ${currentProjectName}`);
  return true;
 }catch(_err){
  setSaveStatus('Erreur: projet non sauvegardé',true);
  return false;
 }
}

updateProjectHeader();
updateProjectBarVisibility();
updateModeUi();
bootstrapAuth();
