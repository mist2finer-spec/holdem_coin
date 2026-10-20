import {randomUUID,timingSafeEqual} from 'node:crypto';
import {existsSync,readFileSync,mkdirSync,statSync} from 'node:fs';
import {writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
import type {HandHistory} from '../../src/lib/poker-hand-history';

export class HandHistoryStore {
  readonly sessionId=randomUUID();
  private entries:{hand:HandHistory;bytes:number}[]=[];
  private bytes=0;
  private pending:string|null=null;
  private writer:Promise<void>|null=null;
  writeError:string|null=null;
  constructor(private file?:string,private maxHands=1000,private maxBytes=16*1024*1024) {
    if(file)try {
      mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
      if(existsSync(file)&&statSync(file).size<=maxBytes+1024) {
        const data=readFileSync(file,'utf8');
        if(Buffer.byteLength(data)<=maxBytes+1024)for(const hand of JSON.parse(data))this.retain(hand);
      }
    }catch {this.writeError='History restore failed';}
  }
  private retain(hand:HandHistory) {
    const copy=JSON.parse(JSON.stringify(hand)) as HandHistory;
    const bytes=Buffer.byteLength(JSON.stringify(copy))+1;
    if(bytes>this.maxBytes-2)return false;
    this.entries.push({hand:copy,bytes});this.bytes+=bytes;
    while(this.entries.length>this.maxHands||this.bytes>this.maxBytes-2)this.bytes-=this.entries.shift()!.bytes;
    return true;
  }
  add(hand:HandHistory) {
    if(!this.retain(hand))return;
    if(this.file) {this.pending=JSON.stringify(this.all());this.scheduleWrite();}
  }
  all() {return this.entries.map(e=>e.hand);}
  get count() {return this.entries.length;}
  private scheduleWrite() {
    if(this.writer)return;
    this.writer=(async()=>{
      while(this.pending!==null) {
        const data=this.pending;this.pending=null;
        try {
          await writeFile(this.file!+'.tmp',data,{mode:0o600});
          await rename(this.file!+'.tmp',this.file!);this.writeError=null;
        }catch {this.writeError='History file write failed';}
      }
    })().finally(()=>{this.writer=null;if(this.pending!==null)this.scheduleWrite();});
  }
  async flush() {while(this.writer)await this.writer;}
}

export function authorizedHistory(header:string|undefined,token=process.env.HAND_HISTORY_ADMIN_TOKEN) {
  if(!token||token.length<24||!header?.startsWith('Bearer '))return false;
  const given=Buffer.from(header.slice(7)),expected=Buffer.from(token);
  return given.length===expected.length&&timingSafeEqual(given,expected);
}
