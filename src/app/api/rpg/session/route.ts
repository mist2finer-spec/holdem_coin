import {NextRequest,NextResponse} from 'next/server';
import {randomBytes} from 'node:crypto';
import path from 'node:path';
import {RpgService,parseHuntInput} from '../../../../lib/rpg-service';
import {RpgStore} from '../../../../lib/rpg-store';
import {loadHuntBalance} from '../../../../lib/rpg-balance';
export const runtime='nodejs';
const globalRpg=globalThis as unknown as {huntService?:RpgService};
function service(){if(!globalRpg.huntService){const balance=loadHuntBalance();globalRpg.huntService=new RpgService(new RpgStore(path.join(process.env.RPG_SAVE_DIR||path.join(process.cwd(),'.data/rpg'),'players.sqlite')),balance);}return globalRpg.huntService;}
export async function POST(req:NextRequest){
 const origin=req.headers.get('origin');try{if(origin&&new URL(origin).host!==req.headers.get('host'))throw Error('Origin');}catch{return NextResponse.json({error:'다른 출처 요청은 허용되지 않습니다.'},{status:403});}
 if(Number(req.headers.get('content-length')||0)>4096)return NextResponse.json({error:'Request too large'},{status:413});
 let account=req.cookies.get('rpg_guest')?.value;if(!account||!/^[a-f0-9]{64}$/.test(account))account=randomBytes(32).toString('hex');
 try{
  const reader=req.body?.getReader();if(!reader)throw Error('Missing body');const chunks:Uint8Array[]=[];let size=0;
  for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>4096){await reader.cancel();throw Error('Request too large');}chunks.push(part.value);}
  const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  let result;
  if(body.action==='start'&&typeof body.character==='string')result=service().start(account,body.character);
  else {if(!['tick','revive','weapon','armor','potion','buy-potion','quest','equip-sword','equip-axe','equip-dual','equip-spear'].includes(body.action)||typeof body.id!=='string')throw Error('Invalid command');
   result=service().command(account,body.id,body.sequence,parseHuntInput(body.input),body.action);}
  const response=NextResponse.json(result,{headers:{'Cache-Control':'no-store'}});
  response.cookies.set('rpg_guest',account,{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',maxAge:60*60*24*365,path:'/api/rpg'});
  return response;
 }catch(e){const message=e instanceof Error&&/[가-힣]/.test(e.message)?e.message:'사냥 요청을 처리할 수 없습니다. 다시 입장해 주세요.';return NextResponse.json({error:message},{status:400,headers:{'Cache-Control':'no-store'}});}
}
