let role='viewer';

const plan=document.getElementById('plan');
const wrapper=document.getElementById('plan-wrapper');
const container=document.getElementById('plan-container');

const formModal=document.getElementById('formModal');
const viewModal=document.getElementById('viewModal');
const title=document.getElementById('title');
const color=document.getElementById('color');
const desc=document.getElementById('desc');
const imagesInput=document.getElementById('imagesInput');
const viewTitle=document.getElementById('viewTitle');
const viewDesc=document.getElementById('viewDesc');
const viewGallery=document.getElementById('viewGallery');
const imageModal=document.getElementById('imageModal');
const fullImage=document.getElementById('fullImage');

const projectNameText=document.getElementById('projectNameText');
const saveStatus=document.getElementById('saveStatus');
const projectSettingsModal=document.getElementById('projectSettingsModal');
const projectListModal=document.getElementById('projectListModal');
const projectList=document.getElementById('projectList');
const settingsProjectName=document.getElementById('settingsProjectName');
const settingsCreatedAt=document.getElementById('settingsCreatedAt');
const settingsUpdatedAt=document.getElementById('settingsUpdatedAt');
const settingsPointCount=document.getElementById('settingsPointCount');
const projectActions=document.getElementById('projectActions');
const renameProjectModal=document.getElementById('renameProjectModal');
const renameProjectInput=document.getElementById('renameProjectInput');
const renameError=document.getElementById('renameError');
const deleteProjectModal=document.getElementById('deleteProjectModal');

const imageUpload=document.getElementById('imageUpload');
const modeLabel=document.getElementById('modeLabel');

plan.draggable=false;
plan.addEventListener('dragstart',e=>e.preventDefault());

let hotspots=[], tempCoords=null, editingId=null, currentView=null;
let currentProjectName='project';
let currentProjectCreatedAt=null;
let currentProjectUpdatedAt=null;
let projectNameCustomized=false;

let scale=1, originX=0, originY=0;
let isDragging=false, moved=false, startX,startY;

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

function setSaveStatus(message,isError=false){
 saveStatus.textContent=message;
 saveStatus.style.color=isError?'#ff9b9b':'#9dff9d';
}

function updateModeUi(){
 modeLabel.textContent=role;
 projectActions.style.display=role==='admin'?'flex':'none';
}

function updateProjectHeader(){
 projectNameText.textContent=currentProjectName;
}

function applyLoadedProject(data,fallbackName){
 plan.src=data.image||'';
 hotspots=Array.isArray(data.hotspots)?data.hotspots:[];
 currentProjectName=sanitizeProjectName(data.projectName||fallbackName||currentProjectName);
 currentProjectCreatedAt=data.createdAt||null;
 currentProjectUpdatedAt=data.updatedAt||null;
 projectNameCustomized=true;
 updateProjectHeader();
 refresh();
}

function login(r){ role=r; alert('Connecté en '+r); updateModeUi(); }
function logout(){ role='viewer'; updateModeUi(); }
function toggleMode(){ if(role!=='admin') return alert('admin only'); }

container.addEventListener('wheel',e=>{
 e.preventDefault();
 const rect=container.getBoundingClientRect();
 const mouseX=e.clientX-rect.left;
 const mouseY=e.clientY-rect.top;
 const zoom=e.deltaY<0?1.05:0.95;

 originX=mouseX-(mouseX-originX)*zoom;
 originY=mouseY-(mouseY-originY)*zoom;
 scale*=zoom;

 wrapper.style.transform=`translate(${originX}px,${originY}px) scale(${scale})`;
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
 wrapper.style.transform=`translate(${originX}px,${originY}px) scale(${scale})`;
});

window.addEventListener('mouseup',()=>{
 isDragging=false;
 container.style.cursor='default';
});

container.addEventListener('click',e=>{
 if(moved) return;
 if(role!=='admin') return;
 const rect=plan.getBoundingClientRect();
 tempCoords={ x:(e.clientX-rect.left)/rect.width, y:(e.clientY-rect.top)/rect.height };
 openForm();
});

function openForm(h=null){
 formModal.style.display='flex';
 if(h){
  editingId=h.id;
  title.value=h.title;
  color.value=h.color;
  desc.value=h.desc;
 }else{
  editingId=null;
  title.value='';
  desc.value='';
  imagesInput.value='';
 }
}

function closeForm(){ formModal.style.display='none'; }

function saveHotspot(){
 const files=imagesInput.files;
 Promise.all([...files].map(f=>{
  const formData=new FormData();
  formData.append('file',f);
  return fetch('/upload',{method:'POST',body:formData}).then(r=>r.text());
 })).then(urls=>{
  if(editingId){
   const h=hotspots.find(x=>x.id===editingId);
   h.title=title.value;
   h.color=color.value;
   h.desc=desc.value;
   if(urls.length) h.images=urls;
  }else{
   hotspots.push({id:Date.now(),...tempCoords,title:title.value,color:color.value,desc:desc.value,images:urls});
  }
  refresh();
  closeForm();
 });
}

function createHotspotElement(h){
 const el=document.createElement('div');
 el.className='hotspot';
 el.style.left=(h.x*100)+'%';
 el.style.top=(h.y*100)+'%';
 el.style.background=h.color;
 el.onclick=e=>{ e.stopPropagation(); openView(h); };
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
  const response=await fetch(`/image-url?src=${encodeURIComponent(src)}`);
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

 const resolvedSources=await Promise.all((h.images||[]).map(resolveImageUrl));
 resolvedSources.forEach(src=>{
  const img=document.createElement('img');
  img.src=src;
  img.onclick=()=>showFullImage(src);
  viewGallery.appendChild(img);
 });
 viewModal.style.display='flex';
}

function closeView(){ viewModal.style.display='none'; }
function showFullImage(src){ fullImage.src=src; imageModal.style.display='flex'; }
function closeFullImage(){ imageModal.style.display='none'; fullImage.src=''; }
function editHotspot(){ if(role!=='admin') return; closeView(); openForm(currentView); }
function deleteHotspot(){ if(role!=='admin') return; hotspots=hotspots.filter(h=>h.id!==currentView.id); closeView(); refresh(); }

function openProjectSettings(){
 settingsProjectName.textContent=currentProjectName;
 settingsCreatedAt.textContent=formatDate(currentProjectCreatedAt);
 settingsUpdatedAt.textContent=formatDate(currentProjectUpdatedAt);
 settingsPointCount.textContent=String(hotspots.length);
 updateModeUi();
 projectSettingsModal.style.display='flex';
}

function closeProjectSettings(){ projectSettingsModal.style.display='none'; }
function openRenameProject(){
 if(role!=='admin') return;
 renameProjectInput.value=currentProjectName;
 renameError.textContent='';
 renameProjectModal.style.display='flex';
}
function closeRenameProject(){ renameProjectModal.style.display='none'; }
function openDeleteProjectConfirm(){ if(role==='admin') deleteProjectModal.style.display='flex'; }
function closeDeleteProjectConfirm(){ deleteProjectModal.style.display='none'; }
function closeProjectList(){ projectListModal.style.display='none'; }

async function confirmRenameProject(){
 if(role!=='admin') return;
 const newName=sanitizeProjectName(renameProjectInput.value);
 if(newName===currentProjectName){ closeRenameProject(); return; }
 renameError.textContent='';
 try{
  const response=await fetch('/project/rename',{
   method:'POST',
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify({fromName:currentProjectName,toName:newName})
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
 if(role!=='admin') return;
 try{
  const response=await fetch(`/project/${encodeURIComponent(currentProjectName)}`,{method:'DELETE'});
  if(!response.ok) throw new Error('delete failed');
  hotspots=[];
  plan.src='';
  currentProjectName='project';
  currentProjectCreatedAt=null;
  currentProjectUpdatedAt=null;
  projectNameCustomized=false;
  refresh();
  updateProjectHeader();
  closeDeleteProjectConfirm();
  closeProjectSettings();
  setSaveStatus('Projet supprimé');
 }catch(_err){
  setSaveStatus('Erreur suppression projet',true);
 }
}

async function duplicateProject(){
 if(role!=='admin') return;
 const saved=await saveProject();
 if(!saved) return;
 try{
  const response=await fetch('/project/duplicate',{
   method:'POST',
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify({name:currentProjectName})
  });
  if(response.status===409){ setSaveStatus('Erreur: copie déjà existante',true); return; }
  if(!response.ok) throw new Error('duplicate failed');
  const result=await response.json();
  await loadProjectByName(result.projectName);
  closeProjectSettings();
  setSaveStatus(`Dupliqué: ${result.projectName}`);
 }catch(_err){
  setSaveStatus('Erreur duplication projet',true);
 }
}

async function loadProjectByName(name){
 const response=await fetch(`/project/${encodeURIComponent(name)}`);
 if(!response.ok) throw new Error('project not found');
 const data=await response.json();
 applyLoadedProject(data,name);
 closeProjectList();
 setSaveStatus(`Loaded: ${currentProjectName}`);
}

async function openProjectList(){
 projectList.innerHTML='Chargement...';
 projectListModal.style.display='flex';
 try{
  const response=await fetch('/projects');
  const data=await response.json();
  const projects=Array.isArray(data.projects)?data.projects:[];
  if(!projects.length){ projectList.textContent='Aucun projet sauvegardé.'; return; }
  projectList.innerHTML='';
  projects.forEach(name=>{
   const btn=document.createElement('button');
   btn.textContent=name;
   btn.onclick=()=>loadProjectByName(name).catch(()=>setSaveStatus('Erreur chargement projet',true));
   projectList.appendChild(btn);
  });
 }catch(_err){
  projectList.textContent='Erreur lors du chargement des projets.';
 }
}

window.addEventListener('keydown',e=>{
 if(e.key!=='Escape') return;
 if(imageModal.style.display==='flex'){ closeFullImage(); return; }
 if(renameProjectModal.style.display==='flex'){ closeRenameProject(); return; }
 if(deleteProjectModal.style.display==='flex'){ closeDeleteProjectConfirm(); return; }
 if(projectSettingsModal.style.display==='flex'){ closeProjectSettings(); return; }
 if(formModal.style.display==='flex'){ closeForm(); return; }
 if(viewModal.style.display==='flex'){ closeView(); return; }
 if(projectListModal.style.display==='flex'){ closeProjectList(); }
});

imageUpload.onchange=e=>{
 const selectedFile=e.target.files[0];
 if(selectedFile && !projectNameCustomized){
  currentProjectName=sanitizeProjectName(selectedFile.name.replace(/\.[^.]+$/,''));
  updateProjectHeader();
 }
 const reader=new FileReader();
 reader.onload=()=>plan.src=reader.result;
 reader.readAsDataURL(e.target.files[0]);
};

async function saveProject(){
 const projectName=sanitizeProjectName(currentProjectName);
 currentProjectName=projectName;
 updateProjectHeader();
 try{
  const response=await fetch('/save',{
   method:'POST',
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify({projectName,image:plan.src,hotspots,createdAt:currentProjectCreatedAt})
  });
  if(!response.ok) throw new Error('save failed');
  const result=await response.json();
  currentProjectName=sanitizeProjectName(result.projectName||projectName);
  currentProjectCreatedAt=result.createdAt||currentProjectCreatedAt||new Date().toISOString();
  currentProjectUpdatedAt=result.updatedAt||new Date().toISOString();
  updateProjectHeader();
  setSaveStatus(`Saved: ${currentProjectName}`);
  return true;
 }catch(_err){
  setSaveStatus('Erreur: projet non sauvegardé',true);
  return false;
 }
}

updateProjectHeader();
updateModeUi();
