import type {HandHistory} from './poker-hand-history';

export function mergeHandHistories(old:HandHistory[],next:HandHistory[]) {
  const map=new Map(old.map(h=>[h.id,h]));next.forEach(h=>{if(!map.has(h.id))map.set(h.id,h);});
  const hands=[...map.values()].sort((a,b)=>a.startedAt.localeCompare(b.startedAt)).slice(-1000);
  let bytes=0;
  for(let i=hands.length-1;i>=0;i--) {
    bytes+=new Blob([JSON.stringify(hands[i])]).size+1;
    if(bytes>16*1024*1024-2)return hands.slice(i+1);
  }
  return hands;
}

async function database() {
  return new Promise<IDBDatabase>((resolve,reject)=>{
    const request=indexedDB.open('holdem-hand-history-v1',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('records');
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  });
}
export async function browserHistory(user:string,save?:HandHistory[]):Promise<HandHistory[]> {
  const db=await database();
  try{return await new Promise((resolve,reject)=>{
    const tx=db.transaction('records',save?'readwrite':'readonly');
    const request=save ? tx.objectStore('records').put(save,user) : tx.objectStore('records').get(user);
    tx.oncomplete=()=>resolve(save || request.result || []);
    tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });}finally {db.close();}
}

export function downloadHistoryFile(text:string,extension:'json'|'csv') {
  const blob=new Blob([text],{type:extension==='json'?'application/json':'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=`holdem-hands-${new Date().toISOString().replaceAll(':','-')}.${extension}`;
  document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
