import {NextRequest,NextResponse} from 'next/server';
import {randomBytes} from 'node:crypto';
import {RogueService,parseRogueInput} from '../../../../lib/rpg-rogue-service';
export const runtime='nodejs';
const scope=globalThis as unknown as {rogueService?:RogueService};
export async function POST(req:NextRequest){
 try{
  const origin=req.headers.get('origin');if(origin&&new URL(origin).host!==req.headers.get('host'))return NextResponse.json({error:'다른 출처 요청은 허용되지 않습니다.'},{status:403});
  const reader=req.body?.getReader();if(!reader)throw Error('Missing body');let size=0;const chunks:Uint8Array[]=[];
  for(;;){const p=await reader.read();if(p.done)break;size+=p.value.byteLength;if(size>4096){await reader.cancel();return NextResponse.json({error:'Request too large'},{status:413});}chunks.push(p.value);}
  const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));let account=req.cookies.get('rpg_guest')?.value;if(!account||!/^[a-f0-9]{64}$/.test(account))account=randomBytes(32).toString('hex');
  const service=scope.rogueService??(scope.rogueService=new RogueService());let value;
  if(body.action==='start')value=service.start(account,body.character);
  else if(body.action==='tick'&&typeof body.id==='string')value=service.command(account,body.id,body.sequence,parseRogueInput(body.input));
  else throw Error('Invalid command');
  const response=NextResponse.json(value,{headers:{'Cache-Control':'no-store'}});response.cookies.set('rpg_guest',account,{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',path:'/api/rpg',maxAge:31536000});return response;
 }catch(e){const message=e instanceof Error&&/[가-힣]/.test(e.message)?e.message:'던전 요청을 처리하지 못했습니다.';return NextResponse.json({error:message},{status:400,headers:{'Cache-Control':'no-store'}});}
}
