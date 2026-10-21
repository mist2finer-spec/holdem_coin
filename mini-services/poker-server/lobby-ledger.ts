import {randomUUID} from 'node:crypto';
type Account={id:string;token:string;name:string;balance:number;tableAmount:number;seatSocket?:string;connections:Set<string>;lastSeen:number;played?:boolean};
// Demo chips only. Runtime memory is deliberately reset on server restart.
export class LobbyLedger {
 private accounts=new Map<string,Account>();
 private sockets=new Map<string,Account>();
 connect(socket:string,token:unknown) {
  const key=typeof token==='string'&&/^[\da-f-]{36}$/i.test(token)?token:randomUUID();
  let a=this.accounts.get(key);
  if(!a){
   if(this.accounts.size>=5000){const old=[...this.accounts.values()].filter(x=>!x.connections.size&&!x.seatSocket).sort((x,y)=>x.lastSeen-y.lastSeen)[0];if(old)this.accounts.delete(old.token);else throw new Error('Lobby full');}
   a={id:randomUUID(),token:key,name:'',balance:5000,tableAmount:0,connections:new Set(),lastSeen:Date.now()};this.accounts.set(key,a);
  }
  const used=new Set([...this.accounts.values()].filter(x=>x!==a&&(x.connections.size||x.seatSocket)).map(x=>x.name));
  if(!a.name||used.has(a.name)){a.name='';for(let n=1;n<=99;n++)if(!used.has(`테스터${n}`)){a.name=`테스터${n}`;break;}if(!a.name)a.name=`테스터-${a.id.slice(0,8)}`;}
  a.connections.add(socket);a.lastSeen=Date.now();this.sockets.set(socket,a);return this.view(socket);
 }
 view(socket:string){const a=this.sockets.get(socket);return a?{id:a.id,token:a.token,name:a.name,multi:a.balance+a.tableAmount}:null;}
 reserve(socket:string){const a=this.sockets.get(socket);if(!a||a.seatSocket&&a.seatSocket!==socket)return false;a.seatSocket=socket;return true;}
 start(socket:string){const a=this.sockets.get(socket);if(!a)return 5000;a.played=true;const amount=a.balance;a.balance=0;a.tableAmount=amount;return amount;}
 sync(socket:string,stack:number){const a=this.sockets.get(socket);if(a)a.tableAmount=stack;}
 takeCredit(socket:string){const a=this.sockets.get(socket);if(!a)return 0;const n=a.balance;a.balance=0;a.tableAmount+=n;return n;}
 recharge(socket:string){const a=this.sockets.get(socket);if(!a)return null;a.balance=Math.min(Number.MAX_SAFE_INTEGER-a.tableAmount,a.balance+5000);return this.view(socket);}
 release(socket:string,stack?:number){const a=this.sockets.get(socket);if(!a)return;if(a.seatSocket===socket){a.balance+=stack??a.tableAmount;a.tableAmount=0;a.seatSocket=undefined;}if(!a.connections.has(socket))this.sockets.delete(socket);}
 disconnect(socket:string){const a=this.sockets.get(socket);if(!a)return;a.connections.delete(socket);a.lastSeen=Date.now();if(a.seatSocket!==socket)this.sockets.delete(socket);}
 leaderboard(){return [...this.accounts.values()].filter(a=>a.played).map(a=>({id:a.id,name:a.name,amount:a.balance+a.tableAmount})).sort((a,b)=>b.amount-a.amount||a.id.localeCompare(b.id)).slice(0,7);}
}
export const lobbyLedger=new LobbyLedger();
