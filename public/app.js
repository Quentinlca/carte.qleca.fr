let role='viewer';
function login(r){ role=r; alert('Connecté en '+r); }
function logout(){ role='viewer'; }
function toggleMode(){ if(role!=='admin') return alert('admin only'); }

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
const imageUpload=document.getElementById('imageUpload');
const loadProject=document.getElementById('loadProject');

plan.draggable=false;
plan.addEventListener('dragstart',e=>e.preventDefault());

let hotspots=[], tempCoords=null, editingId=null, currentView=null;

let scale=1, originX=0, originY=0;
let isDragging=false, moved=false, startX,startY;

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

function openView(h){
 currentView=h;
 viewTitle.innerText=h.title;
 viewDesc.innerText=h.desc;
 viewGallery.innerHTML='';
 h.images.forEach(src=>{
  const img=document.createElement('img');
  img.src=src;
  viewGallery.appendChild(img);
 });
 viewModal.style.display='flex';
}

function closeView(){ viewModal.style.display='none'; }
function editHotspot(){ if(role!=='admin') return; closeView(); openForm(currentView); }
function deleteHotspot(){ if(role!=='admin') return; hotspots=hotspots.filter(h=>h.id!==currentView.id); closeView(); refresh(); }

imageUpload.onchange=e=>{
 const reader=new FileReader();
 reader.onload=()=>plan.src=reader.result;
 reader.readAsDataURL(e.target.files[0]);
};

loadProject.onchange=e=>{
 const reader=new FileReader();
 reader.onload=()=>{
  const data=JSON.parse(reader.result);
  plan.src=data.image;
  hotspots=data.hotspots;
  refresh();
 };
 reader.readAsText(e.target.files[0]);
};

function saveProject(){
 fetch('/save',{
  method:'POST',
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify({image:plan.src,hotspots})
 });
}
