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
const loadingModal=document.getElementById('loadingModal');
const loadingMessage=document.getElementById('loadingMessage');

const projectNameText=document.getElementById('projectNameText');
const projectAccessBadge=document.getElementById('projectAccessBadge');
const projectSettingsBtn=document.getElementById('projectSettingsBtn');
const resetZoomBtn=document.getElementById('resetZoomBtn');
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
const newProjectFromListBtn=document.getElementById('newProjectFromListBtn');
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
let minScale=1;
const HOTSPOT_ZOOM_THRESHOLD=0.15; // Below this scale, hotspots appear as small gray dots
let isDragging=false, moved=false, startX,startY;
let loadingRequests=0;
let shouldRecenterOnResize=false;
let activePointerId=null;
let panVelocityX=0, panVelocityY=0;
let lastPanSampleAt=0;
let inertiaFrameId=0;
let longPressTimer=0;
let longPressTriggered=false;
let longPressPointerId=null;
let longPressStartX=0;
let longPressStartY=0;
let lastTapAt=0;
let lastTapX=0;
let lastTapY=0;
const activeTouchPoints=new Map();

// Pinch state (cooperative gesture mode with vector-based calculation)
let pinchMode=false;
let pinchPointAStart={x:0,y:0};
let pinchPointBStart={x:0,y:0};
let pinchVectorAB={x:0,y:0};
let pinchDistanceAB=0;
let pinchStartScale=1;
let pinchStartOriginX=0;
let pinchStartOriginY=0;
let directionPickerSession=null;
let pendingDirectionDeg=undefined;
let directionPickerClickGuardUntil=0;

function stopInertiaPan(){
 if(!inertiaFrameId) return;
 cancelAnimationFrame(inertiaFrameId);
 inertiaFrameId=0;
 panVelocityX=0;
 panVelocityY=0;
}

function clearLongPressTimer(){
 if(!longPressTimer) return;
 clearTimeout(longPressTimer);
 longPressTimer=0;
}

function cancelLongPress(){
 clearLongPressTimer();
 longPressPointerId=null;
}

function updateHotspotsAppearance(){
 const isZoomedOut=scale<HOTSPOT_ZOOM_THRESHOLD;
 const inverseScale=scale>0?1/scale:1;
 wrapper.querySelectorAll('.hotspot').forEach(el=>{
  if(isZoomedOut){
   el.classList.add('zoomed-out');
  } else {
   el.classList.remove('zoomed-out');
  }
  // Apply inverse scale to keep hotspot size independent of zoom
  el.style.transform=`translate(-50%,-50%) scale(${inverseScale})`;
 });
 wrapper.querySelectorAll('.direction-picker').forEach(el=>{
  el.style.transform=`translate(-50%,-50%) scale(${inverseScale})`;
 });
}

function normalizeAngleDeg(value){
 let angle=value%360;
 if(angle<0) angle+=360;
 return angle;
}

function angleFromCenterToClient(centerClientX,centerClientY,clientX,clientY){
 const dx=clientX-centerClientX;
 const dy=clientY-centerClientY;
 const angle=Math.atan2(dx,-dy)*(180/Math.PI);
 return normalizeAngleDeg(angle);
}

function getHotspotCenterClient(coords){
 const rect=plan.getBoundingClientRect();
 return {
  x:rect.left+coords.x*rect.width,
  y:rect.top+coords.y*rect.height
 };
}

function updateDirectionPickerVisuals(session){
 const angle=normalizeAngleDeg(session.angleDeg);
 const radians=angle*(Math.PI/180);
 const arrowRadius=28;
 const handleRadius=48;
 const arrowX=Math.sin(radians)*arrowRadius;
 const arrowY=-Math.cos(radians)*arrowRadius;
 const handleX=Math.sin(radians)*handleRadius;
 const handleY=-Math.cos(radians)*handleRadius;
 session.arrowEl.style.transform=`translate(-50%,-50%) translate(${arrowX}px,${arrowY}px) rotate(${angle-90}deg)`;
 session.handleEl.style.transform=`translate(-50%,-50%) translate(${handleX}px,${handleY}px)`;
}

function getDirectionPickerCoords(){
 if(editingId){
  const existing=hotspots.find(h=>h.id===editingId);
  if(existing && Number.isFinite(existing.x) && Number.isFinite(existing.y)){
   return {x:existing.x,y:existing.y};
  }
 }
 if(tempCoords && Number.isFinite(tempCoords.x) && Number.isFinite(tempCoords.y)){
  return {x:tempCoords.x,y:tempCoords.y};
 }
 return null;
}

function getCurrentFormPointStyle(){
 const type=pointType.value;
 const value=type==='emoji'?(emoji.value||'📍'):color.value;
 return {type,value};
}

function snapshotFormState(){
 return {
  title:title.value,
  pointType:pointType.value,
  color:color.value,
  emoji:emoji.value,
  desc:desc.value
 };
}

function restoreFormState(state){
 if(!state) return;
 title.value=state.title;
 pointType.value=state.pointType;
 togglePointTypeInput();
 color.value=state.color;
 setSelectedEmoji(state.emoji);
 desc.value=state.desc;
}

function cleanupDirectionPickerSession(){
 if(!directionPickerSession) return;
 const s=directionPickerSession;
 window.removeEventListener('pointermove',s.onMove);
 window.removeEventListener('pointerup',s.onUp);
 window.removeEventListener('pointercancel',s.onUp);
 if(s.root?.parentNode){
  s.root.parentNode.removeChild(s.root);
 }
 directionPickerSession=null;
}

function promptDirectionSelection(hotspotDraft){
 cleanupDirectionPickerSession();
 return new Promise(resolve=>{
  const root=document.createElement('div');
  root.className='direction-picker';
  root.style.left=(hotspotDraft.x*100)+'%';
  root.style.top=(hotspotDraft.y*100)+'%';

  const pointEl=document.createElement('div');
  pointEl.className='direction-picker-point';
  if((hotspotDraft.type||'color')==='emoji'){
   pointEl.classList.add('direction-picker-point-emoji');
   pointEl.textContent=hotspotDraft.value||'📍';
  }else{
   pointEl.classList.add('direction-picker-point-color');
   pointEl.style.background=hotspotDraft.value||'#FF0000';
  }

  const arrowEl=document.createElement('div');
  arrowEl.className='direction-picker-arrow';
  arrowEl.textContent='❯❯';

  const handleEl=document.createElement('div');
  handleEl.className='direction-picker-handle';

  const actionsEl=document.createElement('div');
  actionsEl.className='direction-picker-actions';
  const skipBtn=document.createElement('button');
  skipBtn.type='button';
  skipBtn.className='direction-picker-btn direction-picker-btn-skip';
  skipBtn.textContent='X';
  const confirmBtn=document.createElement('button');
  confirmBtn.type='button';
  confirmBtn.className='direction-picker-btn direction-picker-btn-confirm';
  confirmBtn.textContent='✓';
  actionsEl.appendChild(skipBtn);
  actionsEl.appendChild(confirmBtn);

  root.appendChild(pointEl);
  root.appendChild(arrowEl);
  root.appendChild(handleEl);
  root.appendChild(actionsEl);
  wrapper.appendChild(root);

  const session={
   root,
   arrowEl,
   handleEl,
   angleDeg:Number.isFinite(hotspotDraft.directionDeg)?normalizeAngleDeg(hotspotDraft.directionDeg):0,
   dragging:false,
    movedDuringDrag:false,
   onMove:null,
   onUp:null
  };

  const complete=directionDeg=>{
   cleanupDirectionPickerSession();
   resolve(directionDeg);
  };

  session.onMove=e=>{
   if(!session.dragging) return;
   e.preventDefault();
    session.movedDuringDrag=true;
   const center=getHotspotCenterClient(hotspotDraft);
   session.angleDeg=angleFromCenterToClient(center.x,center.y,e.clientX,e.clientY);
   updateDirectionPickerVisuals(session);
  };

  session.onUp=e=>{
   if(!session.dragging) return;
    e.preventDefault();
    e.stopPropagation();
   session.dragging=false;
    if(session.movedDuringDrag){
     directionPickerClickGuardUntil=performance.now()+240;
    }
   if(handleEl.hasPointerCapture(e.pointerId)){
    handleEl.releasePointerCapture(e.pointerId);
   }
  };

  handleEl.addEventListener('pointerdown',e=>{
   e.preventDefault();
   e.stopPropagation();
   session.dragging=true;
    session.movedDuringDrag=false;
   handleEl.setPointerCapture(e.pointerId);
   const center=getHotspotCenterClient(hotspotDraft);
   session.angleDeg=angleFromCenterToClient(center.x,center.y,e.clientX,e.clientY);
   updateDirectionPickerVisuals(session);
  });

  skipBtn.addEventListener('click',e=>{
   e.preventDefault();
   e.stopPropagation();
    if(performance.now()<directionPickerClickGuardUntil) return;
   complete(null);
  });

  confirmBtn.addEventListener('click',e=>{
   e.preventDefault();
   e.stopPropagation();
    if(performance.now()<directionPickerClickGuardUntil) return;
   complete(normalizeAngleDeg(session.angleDeg));
  });

  window.addEventListener('pointermove',session.onMove);
  window.addEventListener('pointerup',session.onUp);
  window.addEventListener('pointercancel',session.onUp);

  directionPickerSession=session;
  updateDirectionPickerVisuals(session);
  updateHotspotsAppearance();
 });
}

function containerPointFromClient(clientX,clientY){
 const rect=container.getBoundingClientRect();
 return { x:clientX-rect.left, y:clientY-rect.top };
}

function applyZoomAt(containerX,containerY,zoomFactor){
 if(!Number.isFinite(zoomFactor) || zoomFactor<=0) return;
 const nextScale=Math.min(8,Math.max(minScale,scale*zoomFactor));
 const ratio=nextScale/scale;
 originX=containerX-(containerX-originX)*ratio;
 originY=containerY-(containerY-originY)*ratio;
 scale=nextScale;
 applyViewportTransform();
}

function tryOpenCreatePointAt(clientX,clientY){
 if(!canEditCurrentProject()) return;
 const rect=plan.getBoundingClientRect();
 if(!rect.width || !rect.height) return;
 tempCoords={ x:(clientX-rect.left)/rect.width, y:(clientY-rect.top)/rect.height };
 openForm();
}

function getFirstTwoTouchPoints(){
 const values=[...activeTouchPoints.values()];
 if(values.length<2) return null;
 return [values[0],values[1]];
}

function distanceBetweenPoints(a,b){
 const dx=a.x-b.x;
 const dy=a.y-b.y;
 return Math.hypot(dx,dy);
}

function centerBetweenPoints(a,b){
 return { x:(a.x+b.x)/2, y:(a.y+b.y)/2 };
}

function dotProduct(v1,v2){
 return v1.x*v2.x+v1.y*v2.y;
}

function vectorNorm(v){
 return Math.hypot(v.x,v.y);
}

function vectorSubtract(p1,p2){
 return {x:p1.x-p2.x,y:p1.y-p2.y};
}

function beginPinchIfPossible(){
 const pair=getFirstTwoTouchPoints();
 if(!pair) return;
 const [a,b]=pair;
 
 pinchPointAStart={x:a.x,y:a.y};
 pinchPointBStart={x:b.x,y:b.y};
 pinchVectorAB=vectorSubtract(b,a);
 pinchDistanceAB=vectorNorm(pinchVectorAB);
 
 if(pinchDistanceAB<4) return;
 
 pinchMode=true;
 pinchStartScale=scale;
 pinchStartOriginX=originX;
 pinchStartOriginY=originY;
}

function startInertiaPan(){
 const minStartSpeed=0.03;
 if(Math.hypot(panVelocityX,panVelocityY)<minStartSpeed) return;

 if(inertiaFrameId){
  cancelAnimationFrame(inertiaFrameId);
 }

 let lastTs=performance.now();
 const step=ts=>{
  const dt=Math.min(Math.max(ts-lastTs,1),34);
  lastTs=ts;

  originX+=panVelocityX*dt;
  originY+=panVelocityY*dt;
  applyViewportTransform();

  const decay=Math.pow(0.9,dt/16.67);
  panVelocityX*=decay;
  panVelocityY*=decay;

  if(Math.hypot(panVelocityX,panVelocityY)<0.01){
   stopInertiaPan();
   return;
  }

  inertiaFrameId=requestAnimationFrame(step);
 };

 inertiaFrameId=requestAnimationFrame(step);
}

function showLoading(message='Chargement...'){
 loadingRequests+=1;
 loadingMessage.textContent=message;
 loadingModal.style.display='flex';
 document.body.style.overflow='hidden';
}

function hideLoading(){
 loadingRequests=Math.max(loadingRequests-1,0);
 if(loadingRequests===0){
  loadingModal.style.display='none';
  loadingMessage.textContent='Chargement...';
  document.body.style.overflow='';
 }
}

function applyViewportTransform(){
 wrapper.style.transform=`translate(${originX}px,${originY}px) scale(${scale})`;
 updateHotspotsAppearance();
}

function centerPlanInViewport(){
 const rect=container.getBoundingClientRect();
 const imageWidth=plan.naturalWidth||0;
 const imageHeight=plan.naturalHeight||0;
 if(!rect.width || !rect.height || !imageWidth || !imageHeight) return;

 const fitScale=Math.min(rect.width/imageWidth,rect.height/imageHeight);
 minScale=(Number.isFinite(fitScale) && fitScale>0)?fitScale:1;
 scale=minScale;
 originX=(rect.width-imageWidth*scale)/2;
 originY=(rect.height-imageHeight*scale)/2;
 applyViewportTransform();
}

function resetZoom(){
 stopInertiaPan();
 scheduleCenterPlan();
}

function scheduleCenterPlan(){
 shouldRecenterOnResize=true;
 if(!plan.src){
  minScale=1;
  scale=1;
  originX=0;
  originY=0;
  applyViewportTransform();
  return;
 }

 if(plan.complete && plan.naturalWidth>0){
  requestAnimationFrame(centerPlanInViewport);
  return;
 }

 plan.addEventListener('load',()=>{
  requestAnimationFrame(centerPlanInViewport);
 },{once:true});
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
 if(newProjectFromListBtn){
  newProjectFromListBtn.style.display=role!=='viewer'?'inline-block':'none';
 }
}

function updateProjectHeader(){
 const hasProject=Boolean(currentProjectId);
 projectNameText.textContent=currentProjectName||'Editeur de carte interactive';
 const accessLabel=currentProjectVisibility==='private'?'private':sanitizePublicAccess(currentProjectPublicAccess);
 projectAccessBadge.textContent=accessLabel;
 projectAccessBadge.style.display=hasProject?'inline-block':'none';
 projectSettingsBtn.style.display=hasProject?'inline-block':'none';
 if(resetZoomBtn){
  resetZoomBtn.disabled=!hasProject || !plan.src;
 }
}

function updateProjectBarVisibility(){
 projectBar.style.display='flex';
 closeToolbarMenu();
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
 const willOpen=!toolbar.classList.contains('open');
 toolbar.classList.toggle('open');
 if(willOpen) pushMobileBackState();
}

function closeToolbarMenu(){
 toolbar.classList.remove('open');
}

function isMobileViewport(){
 return window.matchMedia('(max-width: 768px)').matches;
}

function isTextEntryTarget(target){
 return !!target?.closest?.('input, textarea, [contenteditable="true"], [contenteditable=""]');
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
 if(toolbar.classList.contains('open')){ closeToolbarMenu(); return true; }
 return false;
}

toolbar.addEventListener('click',event=>{
 const clickedButton=event.target?.closest?.('button');
 if(!clickedButton) return;
 closeToolbarMenu();
});

document.addEventListener('contextmenu',event=>{
 if(!isMobileViewport()) return;
 if(isTextEntryTarget(event.target)) return;
 event.preventDefault();
});

document.addEventListener('selectstart',event=>{
 if(!isMobileViewport()) return;
 if(isTextEntryTarget(event.target)) return;
 event.preventDefault();
});

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
  await openProjectList();
  document.body.classList.remove('booting');
 }catch(_err){
  document.body.classList.remove('booting');
  window.location.href='/login';
 }
}

function applyLoadedProject(data,fallbackName){
 currentProjectId=String(data.projectId||'');
 plan.src=data.image||'';
 scheduleCenterPlan();
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
 shouldRecenterOnResize=false;
 const rect=container.getBoundingClientRect();
 const mouseX=e.clientX-rect.left;
 const mouseY=e.clientY-rect.top;
 const zoom=e.deltaY<0?1.05:0.95;
 applyZoomAt(mouseX,mouseY,zoom);
});

container.addEventListener('pointerdown',e=>{
 if(e.pointerType==='mouse'){
  if(!e.isPrimary) return;
  if(e.button!==0) return;
 }
 const hotspotTarget=e.target?.closest?.('.hotspot');

 if(e.pointerType==='touch'){
  longPressTriggered=false;
  activeTouchPoints.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(activeTouchPoints.size===1){
   moved=false;
  }
  if(hotspotTarget){
   return;
  }

  shouldRecenterOnResize=false;
  stopInertiaPan();
  if(!container.hasPointerCapture(e.pointerId)){
   container.setPointerCapture(e.pointerId);
  }

  if(activeTouchPoints.size>=2){
   cancelLongPress();
   beginPinchIfPossible();
   moved=true;
   return;
  }

  // Initialize pan for single finger
  e.preventDefault();
  activePointerId=e.pointerId;
  isDragging=true;
  moved=false;
  startX=e.clientX-originX;
  startY=e.clientY-originY;
  lastPanSampleAt=performance.now();
  panVelocityX=0;
  panVelocityY=0;
  container.style.cursor='grabbing';

  if(canEditCurrentProject()){
   longPressTriggered=false;
   longPressPointerId=e.pointerId;
   longPressStartX=e.clientX;
   longPressStartY=e.clientY;
   clearLongPressTimer();
   longPressTimer=setTimeout(()=>{
    if(longPressPointerId!==e.pointerId) return;
    longPressTriggered=true;
    cancelLongPress();
    tryOpenCreatePointAt(e.clientX,e.clientY);
   },520);
  }
  return;
 }

 if(hotspotTarget){
  return;
 }

 e.preventDefault();
 shouldRecenterOnResize=false;
 stopInertiaPan();
 activePointerId=e.pointerId;
 isDragging=true;
 moved=false;
 startX=e.clientX-originX;
 startY=e.clientY-originY;
 lastPanSampleAt=performance.now();
 panVelocityX=0;
 panVelocityY=0;
 container.style.cursor='grabbing';
 container.setPointerCapture(e.pointerId);
});

container.addEventListener('pointermove',e=>{
 if(e.pointerType==='touch' && activeTouchPoints.has(e.pointerId)){
  activeTouchPoints.set(e.pointerId,{x:e.clientX,y:e.clientY});
 }

 if(longPressPointerId===e.pointerId){
  const movedSinceDown=Math.hypot(e.clientX-longPressStartX,e.clientY-longPressStartY);
  if(movedSinceDown>10){
   cancelLongPress();
  }
 }

 if(e.pointerType==='touch' && activeTouchPoints.size>=2){
  e.preventDefault();
  const pair=getFirstTwoTouchPoints();
  if(!pair || !pinchMode || !Number.isFinite(pinchStartScale) || pinchStartScale<=0){
   return;
  }

  const [a,b]=pair;
  
  // Calculate current vector AB and its distance
  const currentVectorAB=vectorSubtract(b,a);
  const currentDistanceAB=vectorNorm(currentVectorAB);
  if(currentDistanceAB<4) return;
  
  // Calculate movements of fingers A and B
  const movementA=vectorSubtract(a,pinchPointAStart);
  const movementB=vectorSubtract(b,pinchPointBStart);
  
  // Calculate dot products (projections along AB direction)
  const dotA=dotProduct(movementA,pinchVectorAB);
  const dotB=dotProduct(movementB,pinchVectorAB);
  
  // Continuous symmetric pivot: avoids jumps when the "less moved" finger changes.
  const absDotA=Math.abs(dotA);
  const absDotB=Math.abs(dotB);
  const sumAbs=absDotA+absDotB;

  let zoomOriginX,zoomOriginY;
  if(sumAbs<0.1){
   const midpoint=centerBetweenPoints(a,b);
   zoomOriginX=midpoint.x;
   zoomOriginY=midpoint.y;
  } else {
   // t in [0,1] on segment AB: near A when A moves less, near B when B moves less.
   const t=absDotA/sumAbs;
   zoomOriginX=a.x+(b.x-a.x)*t;
   zoomOriginY=a.y+(b.y-a.y)*t;
  }
  
  // Calculate zoom factor from distance ratio
  const zoomFactor=currentDistanceAB/pinchDistanceAB;
  const nextScale=Math.min(8,Math.max(minScale,pinchStartScale*zoomFactor));
  const ratio=nextScale/pinchStartScale;
  
  originX=zoomOriginX-(zoomOriginX-pinchStartOriginX)*ratio;
  originY=zoomOriginY-(zoomOriginY-pinchStartOriginY)*ratio;
  scale=nextScale;
  moved=true;
  applyViewportTransform();
  return;
 }

 if(!isDragging || e.pointerId!==activePointerId) return;
 e.preventDefault();

 const nextOriginX=e.clientX-startX;
 const nextOriginY=e.clientY-startY;
 const deltaX=nextOriginX-originX;
 const deltaY=nextOriginY-originY;

 if(Math.abs(deltaX)>0.5 || Math.abs(deltaY)>0.5){
  moved=true;
 }

 const now=performance.now();
 const dt=Math.max(now-lastPanSampleAt,1);
 const instantVX=deltaX/dt;
 const instantVY=deltaY/dt;
 panVelocityX=panVelocityX*0.75+instantVX*0.25;
 panVelocityY=panVelocityY*0.75+instantVY*0.25;
 lastPanSampleAt=now;

 originX=nextOriginX;
 originY=nextOriginY;
 applyViewportTransform();
});

function endPointerPan(e){
 if(e.pointerType==='touch'){
  activeTouchPoints.delete(e.pointerId);
  if(activeTouchPoints.size<2){
   pinchMode=false;
  }
  if(activeTouchPoints.size===0){
   moved=false;
  }
   const touchMoveWasSmall=!moved && !longPressTriggered;
   const wasLongPress=longPressTriggered;
   cancelLongPress();

   if(e.pointerId===activePointerId){
    isDragging=false;
    activePointerId=null;
   }

   if(container.hasPointerCapture(e.pointerId)){
    container.releasePointerCapture(e.pointerId);
   }

   if(touchMoveWasSmall && !wasLongPress){
    const now=Date.now();
    const pt=containerPointFromClient(e.clientX,e.clientY);
    const isDoubleTap=(now-lastTapAt)<300 && Math.hypot(pt.x-lastTapX,pt.y-lastTapY)<28;
    if(isDoubleTap){
     shouldRecenterOnResize=false;
     applyZoomAt(pt.x,pt.y,1.5);
     lastTapAt=0;
    }else{
     lastTapAt=now;
     lastTapX=pt.x;
     lastTapY=pt.y;
    }
   }
   return;
 }

 cancelLongPress();

 if(e.pointerId!==activePointerId) return;
 const wasDragging=isDragging;
 const pointerType=e.pointerType;
 isDragging=false;
 activePointerId=null;
 container.style.cursor='default';

 if(container.hasPointerCapture(e.pointerId)){
  container.releasePointerCapture(e.pointerId);
 }

 if(wasDragging && moved && pointerType==='mouse'){
  startInertiaPan();
 }
}

container.addEventListener('pointerup',endPointerPan);
container.addEventListener('pointercancel',endPointerPan);
container.addEventListener('lostpointercapture',e=>{
 if(e.pointerType==='touch'){
  activeTouchPoints.delete(e.pointerId);
  if(activeTouchPoints.size<2){
   pinchMode=false;
  }
 }
 cancelLongPress();
 if(e.pointerId!==activePointerId) return;
 isDragging=false;
 activePointerId=null;
 container.style.cursor='default';
});

window.addEventListener('resize',()=>{
 if(!shouldRecenterOnResize) return;
 if(!currentProjectId || !plan.src) return;
 requestAnimationFrame(centerPlanInViewport);
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
 cleanupDirectionPickerSession();
 pendingDirectionDeg=undefined;
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
  imagesInput.value='';
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

imagesInput.addEventListener('change',async ()=>{
 if(!canEditCurrentProject()) return;
 if(!imagesInput.files || imagesInput.files.length===0){
  pendingDirectionDeg=undefined;
  return;
 }

 const coords=getDirectionPickerCoords();
 if(!coords) return;

 const {type,value}=getCurrentFormPointStyle();
 const existing=editingId?hotspots.find(h=>h.id===editingId):null;
 const initialDirection=Number.isFinite(pendingDirectionDeg)
  ?pendingDirectionDeg
  :(Number.isFinite(existing?.directionDeg)?existing.directionDeg:0);

 const formState=snapshotFormState();

 formModal.style.display='none';
 const chosenDirection=await promptDirectionSelection({
  ...coords,
  type,
  value,
  directionDeg:initialDirection
 });
 pendingDirectionDeg=Number.isFinite(chosenDirection)?normalizeAngleDeg(chosenDirection):null;
 restoreFormState(formState);
 formModal.style.display='flex';
});

async function saveHotspot(){
 if(!canEditCurrentProject()) return;
 const files=imagesInput.files;
 const type=pointType.value;
 const value=type==='emoji'?(emoji.value||'📍'):color.value;
 showLoading(files.length?'Upload des images du point...':'Sauvegarde du point...');
 try{
  const urls=await Promise.all([...files].map(f=>{
   const formData=new FormData();
   formData.append('file',f);
   return apiFetch('/upload',{method:'POST',body:formData}).then(r=>r.text());
  }));
  let hotspotDraft;
  if(editingId){
   const existing=hotspots.find(x=>x.id===editingId);
   if(!existing) throw new Error('hotspot not found');
   hotspotDraft={
    ...existing,
    title:title.value,
    type,
    value,
    desc:desc.value,
    images:urls.length?urls:(existing.images||[]),
    directionDeg:pendingDirectionDeg!==undefined
     ?(Number.isFinite(pendingDirectionDeg)?normalizeAngleDeg(pendingDirectionDeg):null)
     :(Number.isFinite(existing.directionDeg)?normalizeAngleDeg(existing.directionDeg):null)
   };
  }else{
   hotspotDraft={
    id:Date.now(),
    ...tempCoords,
    title:title.value,
    type,
    value,
    desc:desc.value,
    images:urls,
    directionDeg:pendingDirectionDeg!==undefined
     ?(Number.isFinite(pendingDirectionDeg)?normalizeAngleDeg(pendingDirectionDeg):null)
     :null
   };
  }

  if(editingId){
   hotspots=hotspots.map(h=>h.id===editingId?hotspotDraft:h);
  }else{
   hotspots.push(hotspotDraft);
  }

  showLoading('Sauvegarde du point...');
  refresh();
  closeForm();
  pendingDirectionDeg=undefined;
  await saveProject();
 }catch(_err){
  setSaveStatus('Erreur upload/sauvegarde du point',true);
 }finally{
  cleanupDirectionPickerSession();
  hideLoading();
 }
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
  // Handle emoji hover with inverse scale compensation
  el.addEventListener('mouseenter',()=>{
   const inverseScale=1/scale;
   el.style.transform=`translate(-50%,-50%) scale(${inverseScale*1.18})`;
  });
  el.addEventListener('mouseleave',()=>{
   const inverseScale=1/scale;
   el.style.transform=`translate(-50%,-50%) scale(${inverseScale})`;
  });
 }else{
  el.classList.add('hotspot-color');
  el.style.background=h.value||h.color||'#FF0000';
  // Handle color hover as a class toggle
  el.addEventListener('mouseenter',()=>{
   const inverseScale=1/scale;
   el.style.transform=`translate(-50%,-50%) scale(${inverseScale*1.18})`;
  });
  el.addEventListener('mouseleave',()=>{
   const inverseScale=1/scale;
   el.style.transform=`translate(-50%,-50%) scale(${inverseScale})`;
  });
 }

 if(Number.isFinite(h.directionDeg)){
  const directionEl=document.createElement('div');
  directionEl.className='hotspot-direction';
  directionEl.textContent='❯❯';
  directionEl.style.transform=`translate(-50%,-50%) rotate(${normalizeAngleDeg(h.directionDeg)-90}deg) translate(20px,0)`;
  el.appendChild(directionEl);
 }

 wrapper.appendChild(el);
}

function refresh(){
 wrapper.querySelectorAll('.hotspot').forEach(e=>e.remove());
 hotspots.forEach(createHotspotElement);
 updateHotspotsAppearance();
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

 showLoading('Téléchargement des images...');
 try{
  const resolvedSources=await Promise.all((h.images||[]).map(resolveImageUrl));
  resolvedSources.forEach(src=>{
   const img=document.createElement('img');
   img.src=src;
   img.onclick=()=>showFullImage(src);
   viewGallery.appendChild(img);
  });
 }finally{
  hideLoading();
 }
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
 if(!currentProjectId) return;
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
 showLoading('Création du projet...');
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
  closeProjectList();
  scheduleCenterPlan();
  setSaveStatus(`Projet créé: ${currentProjectName}`);
 }catch(_err){
  newProjectError.textContent='Erreur lors de la création du projet.';
 }finally{
  hideLoading();
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
 showLoading('Ouverture du projet...');
 try{
  const response=await apiFetch(`/project/${encodeURIComponent(projectId)}`);
  if(!response.ok) throw new Error('project not found');
  const data=await response.json();
  applyLoadedProject(data,data.projectName);
  closeProjectList();
  scheduleCenterPlan();
  setSaveStatus(`Loaded: ${currentProjectName}`);
 }finally{
  hideLoading();
 }
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
 if(closeTopOpenMenu()) return;
 if(!isMobileViewport()) return;
 if(forcingNativeBack) return;
 forcingNativeBack=true;
 history.back();
 setTimeout(()=>{ forcingNativeBack=false; },300);
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
