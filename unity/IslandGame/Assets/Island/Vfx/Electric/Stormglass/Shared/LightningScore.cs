using System;
using static StormglassVfx.MathFx;
namespace StormglassVfx
{
    public enum LightningPart { SwordCharge, Slash, Hit, StormSkill, Ground }
    public enum SlashForm { ThreeCuts, Horizontal, Overhead, Cross }
    public enum HitTone { Violet, Indigo, Cyan }
    [Flags] public enum FxLayers { Filaments=1, Sheets=2, Sparks=4, Atmosphere=8, Surface=16, All=31 }

    public sealed class LightningScore
    {
        public readonly ArcGeometry g=new ArcGeometry();
        public FxLayers layers=FxLayers.All;
        public V3 tint=new V3(1,1,1);
        public float gain=1;
        // Island additions. violetOnly: every authored color is remapped into the Violet..Pearl family by its whiteness.
        // sustain: Sword Charge holds its charged envelope (sparks re-emit) instead of fading out at 1.07-1.50 s.
        public bool violetOnly, sustain;
        const float SustainHold=.62f, SparkPeriod=.78f;
        static V3 ToViolet(V3 c){float m=Math.Max(c.x,Math.Max(c.y,c.z));if(m<=0)return c;float w=Math.Min(c.x,Math.Min(c.y,c.z))/m;return V3.Lerp(Violet,Pearl,Sat((w-.10f)/(.68f-.10f)))*m;}
        float Env(float t){return sustain?Math.Min(t,SustainHold):t;}
        float Age(float age){return sustain&&age>SparkPeriod?age%SparkPeriod:age;}
        public static readonly V3 Violet=new V3(.46f,.10f,1), Indigo=new V3(.16f,.14f,1), Cyan=new V3(.035f,.79f,1), Ice=new V3(.46f,.94f,1), Pearl=new V3(.80f,.68f,1);
        static readonly V3 Navy=new V3(.022f,.024f,.045f), Ash=new V3(.11f,.15f,.18f);
        bool Has(FxLayers l){return (layers&l)!=0;}
        HitTone chargeTone;
        V3 C(V3 color){if(violetOnly)color=ToViolet(color);else if(chargeTone==HitTone.Cyan)color=new V3(color.x*.13f,color.z*.79f,color.z);else if(chargeTone==HitTone.Indigo)color=new V3(color.x*.47f,color.y*1.24f,color.z);return new V3(color.x*tint.x,color.y*tint.y,color.z*tint.z);}
        public static float Duration(LightningPart p,SlashForm slash=SlashForm.ThreeCuts)
        {
            switch(p){case LightningPart.SwordCharge:return 1.50f;case LightningPart.Slash:return slash==SlashForm.ThreeCuts?2.10f:.76f;case LightningPart.Hit:return .96f;case LightningPart.StormSkill:return 3.50f;default:return 2.00f;}
        }
        public void Sample(LightningPart part,float t,int seed,SlashForm form=SlashForm.ThreeCuts,HitTone tone=HitTone.Violet)
        {
            g.Clear();g.seed=seed;chargeTone=part==LightningPart.SwordCharge?tone:HitTone.Violet;bool hold=sustain&&part==LightningPart.SwordCharge;if(t<0||(!hold&&t>=Duration(part,form))||gain<=0)return;
            switch(part)
            {
                case LightningPart.SwordCharge:Blade(t);break;
                case LightningPart.Slash:Slashes(t,form);break;
                case LightningPart.Hit:Impact(t,tone==HitTone.Violet?Violet:tone==HitTone.Indigo?Indigo:Cyan);break;
                case LightningPart.StormSkill:Skill(t);break;
                case LightningPart.Ground:Floor(t);break;
            }
        }
        void Bolt(V3 a,V3 b,float w,float jag,V3 color,float alpha,int key,float t,int forks=0,V3 bow=default(V3),int n=0)
        {if(Has(FxLayers.Filaments))g.Bolt(a,b,w,jag,C(color),alpha*gain,key,t,forks,bow,n);}
        void Lamp(V3 p,float w,float h,V3 color,float a,int k=ArcGeometry.Mist,int key=1,float angle=0)
        {if(Has(k==ArcGeometry.Flare?FxLayers.Sparks:FxLayers.Atmosphere))g.Sprite(p,w,h,angle,C(color),a*gain,k,key);}
        void Stars(V3 center,float age,float duration,int count,float size,V3 color,int id,bool flat=false)
        {
            if(!Has(FxLayers.Sparks)||age<0||age>=duration)return;
            for(int j=0;j<count;j++)
            {
                int k=j*181+id+g.seed;float delay=H(k+9)*.18f*duration,life=duration*(.35f+H(k+3)*.61f);
                float u=(age-delay)/life;if(u<=0||u>=1)continue;
                float ang=H(k+2)*TAU,vertical=flat?.15f+H(k+7)*.92f:J(k+7)*.98f;
                V3 dir=new V3(Cos(ang),vertical,Sin(ang)).Unit;
                float dist=size*(.35f+1.30f*H(k+19))*(1-Exp(-u*3.5f));
                V3 p=center+dir*dist+Up*(-u*u*size*(flat?.53f:.31f));if(flat&&p.y<.035f)p.y=.035f;
                float alpha=Pow(1-u,.54f)*Ramp(u,0,.07f);
                if(j%5==0)g.Sprite(p,(.019f+.038f*H(k+71))*size,(.018f+.035f*H(k+71))*size,ang,C(color),gain*alpha,ArcGeometry.Flare,k);
                else{
                    var v=dir+Up*(-u*(flat?1:.52f));float l=(.028f+.18f*Pow(H(k+41),2))*size*(1-u*.55f);
                    g.scratch[0]=p-v*l;g.scratch[1]=p;g.scratch[2]=p+v*l*.22f;
                    g.Line(g.scratch,3,(.006f+.023f*H(k+11))*size,C(j%4==0?Ice:color),gain*alpha,k,.72f,ArcGeometry.Spark);
                }
            }
        }
        void Blade(float t)
        {
            float e=Env(t);float on=Window(e,0,.23f,1.07f,1.50f);if(on<=0)return;
            float hot=Window(e,.15f,.32f,.82f,1.20f);float pulse=.78f+.15f*Sin(26*t)+.065f*Sin(69*t+1);
            float head=.16f+1.20f*Ramp(e,0,.42f);V3 baseP=Up*.075f,tip=Up*head;
            for(int j=0;j<3;j++)
            {
                float az=j*2.2f+t*1.4f;V3 rail=Polar(az,.035f,0);
                Bolt(baseP+rail,tip+rail*.23f,.023f-j*.003f,.033f+.009f*j,j==0?Pearl:Violet,on*pulse*(j==0?1:.80f),41+j*71,t,1,rail*.55f,29);
            }
            for(int j=0;j<10;j++)
            {
                int key=420+j*31+g.seed;float phase=t*(2.2f+H(key))+.78f*H(key+2);float f=phase-(float)Math.Floor(phase);
                float start=(.06f+H(key+33)*.63f)*head,az=TAU*H(key+19)+t*(j%2==0?2.1f:-1.8f);
                float end=Math.Min(head,start+(.19f+.38f*H(key+23))*head);
                V3 a=Polar(az,.033f,start),b=Polar(az+1.1f,.025f,end);float erupt=(.08f+.20f*H(key+11))*(.55f+hot*.55f);
                Bolt(a,b,.011f+.007f*H(key+7),.042f,V3.Lerp(Violet,Indigo,H(key+59)),on*Pow(Sin(PI*f),.71f),key,t,1,Polar(az,erupt,0),14);
            }
            if(Has(FxLayers.Sheets))
            {
                for(int j=0;j<2;j++){
                    for(int i=0;i<23;i++){float u=i/22f;g.path[i]=Up*(.07f+(head-.07f)*u)+Polar(j*PI+t*1.8f,.020f*Sin(PI*u),0);g.side[i]=Polar(j*PI*.5f+.2f,.033f*Pow(Sin(PI*u),.44f),0);}
                    g.Ribbon(g.path,g.side,23,1,C(Pearl),on*gain*.85f,21+j,ArcGeometry.Veil);
                }
            }
            Lamp(Up*.24f,.26f,.26f,Violet,on*.44f);Lamp(Up*(head*.75f),.23f,.38f,Indigo,on*.27f);
            Lamp(tip,.083f,.15f,Pearl,on*(.65f+.3f*Sin(35*t)),ArcGeometry.Flare,83,.22f);
            for(int j=0;j<6;j++)Stars(Up*(.12f+j*.20f),Age(t-.085f-j*.11f),.52f,6,.26f,Violet,900+j*71);
        }
        static void SweepPath(int form,float u,out V3 radial,out V3 point)
        {
            float angle;V3 h,v,center;
            if(form==0){
                angle=At(-2.93f,2.0f,u);h=new V3(1,.21f,.05f);v=new V3(.04f,.29f,1);center=new V3(0,1.15f,0);
            }else if(form==1){
                angle=At(-.25f,3.22f,u);h=new V3(.91f,-.40f,.24f);v=new V3(.29f,1,.12f);center=new V3(.14f,1.55f,0);
            }else{
                angle=At(-2.52f,2.88f,u);h=new V3(.95f,-.17f,-.31f);v=new V3(.08f,.63f,.95f);center=new V3(.04f,1.21f,0);
            }
            radial=h*Cos(angle)+v*Sin(angle);float radius=(form==1?1.58f:1.49f)*(.87f+.19f*u);point=center+radial*radius;
        }
        void Slashes(float t,SlashForm form)
        {
            if(form!=SlashForm.ThreeCuts){Sweep(t,(int)form-1);return;}
            Sweep(t,0);Sweep(t-.68f,1);Sweep(t-1.38f,2);
        }
        void Sweep(float t,int f)
        {
            if(t<=0||t>=.76f)return;V3 col=f==0?Violet:f==1?Indigo:Cyan;
            float head=Ramp(t,.005f,.22f),tail=Ramp(t,.145f,.72f)*.998f;
            if(head-tail<.007f)return;float alpha=Window(t,0,.055f,.43f,.75f);
            const int n=61;
            for(int band=0;band<5;band++)
            {
                for(int i=0;i<n;i++)
                {
                    float s=(float)i/(n-1),u=At(tail,head,s);V3 rad,p;SweepPath(f,u,out rad,out p);
                    float wave=Sin(13*u+band*.8f+t*8)*.025f+Noise(u*15,band*81+g.seed)*.019f;
                    float taper=Pow(Sin(PI*s),.47f);float offset=band==0?0:-.055f*band+wave;
                    g.path[i]=p+rad*offset+Up*(band==0?0:wave);g.side[i]=rad*((band==0?.247f:.069f)*taper*(.31f+.95f*s)*(.90f+.10f*Sin(s*8+band)));
                }
                if(Has(FxLayers.Sheets))g.Ribbon(g.path,g.side,n,1,C(col),alpha*gain*(band==0?.97f:.49f),f*29+band*7,ArcGeometry.Veil,true);
                if(band==0&&Has(FxLayers.Filaments)){
                    for(int i=0;i<n;i++)g.scratch[i]=g.path[i]+g.side[i]*.94f;
                    g.Line(g.scratch,n,.023f,C(V3.Lerp(col,Ice,.20f)),gain*alpha*.70f,901+f,.6f,ArcGeometry.Wire,false,.88f);
                }
            }
            // Bridge the open crescent with kinked chords and a travelling bead. They occupy
            // negative space below the ribbon, clearly separated from the parallel edge strands.
            if(f==1 && head-tail>.12f){
                float life=Window(t,.065f,.145f,.39f,.60f);
                for(int j=0;j<3;j++){
                    float u=At(tail,head,.14f+j*.075f),v=At(tail,head,.82f+j*.04f);
                    V3 ra,pa,rb,pb;SweepPath(f,u,out ra,out pa);SweepPath(f,v,out rb,out pb);
                    pa-=ra*(.17f+j*.073f);pb-=rb*(.12f+j*.048f);
                    V3 knee=V3.Lerp(pa,pb,.24f+.17f*j)+Up*(.07f+.09f*j);
                    V3 mid=V3.Lerp(pa,pb,.64f+.05f*j)-Up*.045f;
                    Bolt(pa,knee,.014f,.063f,Indigo,life*.79f,2413+j*73,t,1,Up*.043f,12);
                    Bolt(knee,mid,.017f,.075f,j==1?Pearl:Indigo,life*.87f,2453+j*51,t,1,Up*(j*.06f-.045f),16);
                    Bolt(mid,pb,.013f,.055f,Indigo,life*.72f,2491+j*83,t,1,Up*.04f,11);
                    if(j==1){Lamp(knee,.19f,.19f,Indigo,life*.84f);Lamp(knee,.10f,.12f,Pearl,life*.88f,ArcGeometry.Flare,362);}
                }
            }
            for(int j=0;j<9;j++){
                float u=At(tail,head,(float)j/10);float v=Math.Min(head,u+.075f+.08f*H(j+91));
                V3 a,b,ra,rb;SweepPath(f,u,out ra,out a);SweepPath(f,v,out rb,out b);
                float d=.12f+H(j*87+g.seed)*.29f;V3 bend=ra*(J(j+31)*.12f)+Up*(J(j*9)*.13f);
                Bolt(a-ra*d,b-rb*(d+.10f*J(j+55)),.012f,.054f,col,alpha*(.54f+.35f*H(j+17)),177+f*101+j*67,t,1,bend,15);
            }
            V3 front,pnt;SweepPath(f,head,out front,out pnt);
            Lamp(pnt,.67f,.61f,col,alpha*.75f);
            // Irregular flashes cling to the current leading edge, independent of the persistent membrane.
            for(int j=0;j<5;j++){
                int k=819+j*79;float u=At(tail,head,.63f+.35f*H(k));V3 r,p;SweepPath(f,u,out r,out p);
                V3 q=p+r*(.13f+.29f*H(k+9))+Up*J(k+8)*.30f;
                Bolt(p,q,.015f,.062f,col,alpha*(.49f+.27f*Sin(19*t+j)),k,t,1);
            }Lamp(pnt,.21f,.14f,Ice,alpha*.92f,ArcGeometry.Flare,14,.4f);
            for(int j=0;j<4;j++){V3 r,p;SweepPath(f,.19f+j*.23f,out r,out p);Stars(p,t-.035f-j*.044f,.42f,6,.43f,col,1013+51*j+f*85);}
        }
        void Impact(float t,V3 col)
        {
            float duration=Duration(LightningPart.Hit);float flash=Exp(-t*20)*Ramp(t,0,.028f);
            Lamp(Zero,.77f,.79f,col,flash);Lamp(Zero,.68f,.51f,Ice,flash*1.18f,ArcGeometry.Flare,1,.28f);
            for(int j=0;j<12;j++){
                int k=g.seed+179*j;float start=.008f+.11f*H(k+4),life=.21f+.34f*H(k+5);float u=(t-start)/life;if(u<=0||u>=1)continue;
                float a=TAU*H(k+11),h=J(k+15)*.65f;
                var b=Polar(a,.46f+.42f*H(k+17),h);float reveal=Ramp(u,0,.22f);
                Bolt(b*.045f,b*reveal,.022f+.011f*H(k+1),.09f,col,Pow(1-u,.70f),k+121,t,2,Up*.09f);
            }
            // Current crawls around the hit volume. Branches connect over its surface instead of radiating from a single point.
            for(int j=0;j<14;j++){
                int k=g.seed+279*j;float delay=.050f+H(k+12)*.18f,end=.48f+.44f*H(k+13);
                float life=Window(t,delay,delay+.067f,end-.15f,end);if(life<=0)continue;
                float h1=J(k+5)*.76f,h2=Math.Min(.86f,Math.Max(-.87f,h1+J(k+19)*.81f));float a=TAU*H(k+9);
                V3 p=Polar(a,.40f*(1-.39f*Math.Abs(h1)),h1),q=Polar(a+J(k+22)*2.3f,.42f*(1-.39f*Math.Abs(h2)),h2);
                Bolt(p,q,.011f+.008f*H(k+8),.060f,col,life*.94f,k+331,t,1,Polar(a+.3f,.091f,0));
                if(Has(FxLayers.Sparks)&&j%2==0)g.Sprite(p,.035f,.045f,0,C(col),life*gain,ArcGeometry.Flare,k);
            }
            if(Has(FxLayers.Sparks)){
                for(int j=0;j<31;j++){
                    int k=g.seed+j*311+573;float h=J(k+5)*.81f;
                    V3 pos=Polar(H(k+17)*TAU,.39f*(1-.35f*Math.Abs(h)),h);
                    float en=Window(t,.03f+H(k+33)*.18f,.25f,.45f+.13f*H(k+9),.87f)*(.27f+.70f*Pow(.5f+.5f*Sin(22*t+k),2));
                    float sz=.013f+.028f*H(k+8);g.Sprite(pos,sz,sz*1.45f,J(k),C(col),gain*en,ArcGeometry.Flare,k);
                }
            }
            Stars(Zero,t,.63f,28,.78f,col,701);Stars(Up*.24f,t-.16f,.50f,12,.51f,Ice,809);
            float late=Window(t,.18f,.30f,.45f,duration);
            Lamp(Up*.04f,.47f,.82f,col,late*.20f);
        }
        void Skill(float t)
        {
            // Cue over the ground target, then a quiet hold and a delayed, three-pulse downward discharge.
            float hold=Window(t,0,.12f,1.41f,1.62f);V3 overhead=new V3(0,2.44f,0);
            Lamp(overhead,.43f,.29f,Cyan,hold*(.43f+.09f*Sin(14*t)));
            Lamp(overhead,.74f,.115f,Ice,hold*(.87f+.1f*Sin(21*t)),ArcGeometry.Flare,190);
            Lamp(overhead,.145f,.32f,Cyan,hold*.72f,ArcGeometry.Flare,192);
            for(int j=0;j<5;j++){
                float ang=t*(1.3f+j*.12f)+j*1.74f;float r=(.68f+.18f*j)*(1-Ramp(t,.21f,1.46f)*.69f);
                V3 a=overhead+Polar(ang,r,J(j+9)*.32f),b=overhead+Polar(ang+1.7f,r*.33f,.04f);
                Bolt(a,b,.010f,.071f,Cyan,hold*(.31f+.24f*Sin(17*t+j)),391+j*51,t,1,Up*.09f);
            }
            if(Has(FxLayers.Sheets)&&t<.70f){
                for(int j=0;j<2;j++){
                    int n=39;float h=Ramp(t,0,.13f),tail=Ramp(t,.1f,.68f);
                    for(int i=0;i<n;i++){float s=(float)i/(n-1),u=At(tail,h,s),a=At(-2.57f,1.99f,u)+j*1.52f;g.path[i]=overhead+new V3(Cos(a)*1.30f,Sin(a)*.52f-.30f,Sin(a)*.84f);g.side[i]=new V3(Cos(a),Sin(a),Sin(a)*.25f)*(.078f*Pow(Sin(PI*s),.6f));}
                    g.Ribbon(g.path,g.side,n,1,C(Cyan),gain*(1-Ramp(t,.28f,.68f))*.72f,j+34);
                }
            }
            for(int j=0;j<3;j++){
                float start=j==0?1.42f:j==1?1.56f:1.81f;float age=t-start,life=j==0?.54f:j==1?.49f:.39f;
                if(age<0||age>=life)continue;float q=age/life,en=Ramp(age,0,.025f)*Pow(1-q,.86f),growth=Ramp(age,0,.085f);
                var crown=overhead+new V3(.06f*J(j+3),.85f+.28f*j,.12f*J(3*j));var foot=new V3(J(j+53)*.23f,.06f,J(j+39)*.23f);
                var end=V3.Lerp(crown,foot,growth);
                Bolt(crown,end,.055f*(1-.13f*j),.20f,Cyan,en,j*299+109,t,4,Right*(.18f*J(j+47)),43);
                Bolt(crown+Right*.10f,end+Forward*.06f,.025f,.16f,Ice,en*.93f,j*183+433,t,2,Right*-.26f,39);
                for(int arc=0;arc<3;arc++){
                    float phase=arc*2.14f+j*.71f+.46f*Sin(t*27+arc);
                    V3 startP=foot+Polar(phase,.08f,.12f);
                    V3 apex=foot+Polar(phase,.51f+.23f*H(arc*79+5),.97f+.62f*H(arc*71+11));
                    Bolt(startP,apex,.021f,.137f,Cyan,en*.82f,1225+arc*59+j*81,t,2,Polar(phase,.21f,0),21);
                }
                for(int k=0;k<3;k++){
                    var a=V3.Lerp(foot,crown,.52f+.15f*k);var b=foot+Polar(k*2.2f+j*.8f,.48f+.19f*k,.10f+.15f*k);
                    Bolt(a,b,.017f,.14f,Cyan,en*.86f,810+k*59+j*149,t,2,Polar(k*2.2f,.17f,0));
                }
                Lamp(overhead,.90f,1.22f,Cyan,en*.87f);Lamp(foot+Up*.13f,.90f,.91f,Cyan,en*.77f);
                Lamp(foot+Up*.16f,.70f,1.07f,Ice,en*.70f,ArcGeometry.Flare,j+24);
                Lamp(V3.Lerp(crown,foot,.52f),.43f,1.6f,Cyan,en*.39f);
            }
            float plume=Window(t,1.47f,1.56f,1.94f,2.23f);
            if(Has(FxLayers.Sheets)&&plume>.01f){
                for(int j=0;j<7;j++){
                    int k=g.seed+j*263;float phase=H(k)*TAU;int n=24;
                    for(int h=0;h<n;h++){
                        float u=(float)h/(n-1);float a=phase+.66f*u+.16f*Sin(9*u+19*t+j);
                        float height=u*(.67f+.83f*H(k+4));float radius=.12f+u*(.42f+.30f*H(k+9));
                        g.path[h]=Polar(a,radius,height+.07f);g.side[h]=Polar(a+.5f*PI,(.047f+.052f*H(k+7))*Pow(Sin(PI*u),.57f),0);
                    }
                    g.Ribbon(g.path,g.side,n,1,C(Cyan),plume*gain*.52f,k);
                }
            }
            float aft=Window(t,1.49f,1.61f,2.12f,3.36f);
            if(aft>0){
                for(int j=0;j<11;j++){
                    int k=103+j*79+g.seed;float a=H(k)*TAU;float h=.13f+1.56f*H(k+4);V3 p=Polar(a,.33f+.27f*H(k+11),h),end=Polar(a+J(k+6)*1.85f,.39f,h*.55f);
                    Bolt(p,end,.016f,.085f,Cyan,aft*(.48f+.34f*Sin(t*19+j)),k+240,t,1);
                }
                for(int j=0;j<61;j++){
                    int k=j*137+g.seed;float u=Sat((t-1.50f)/1.62f);V3 p=Polar(H(k+4)*TAU,(.11f+.62f*H(k+7))*(.73f+u*.66f),.15f+H(k+9)*1.56f+u*.75f);
                    float r=.068f+.137f*H(k+6);if(Has(FxLayers.Atmosphere)){
                        g.Sprite(p,r*(.86f+u),r*(1.04f+u),J(k+2),Navy,aft*gain*.89f,ArcGeometry.Soot,k);
                        if(j%3==0)g.Sprite(p+Forward*.068f,r*.88f,r*1.13f,J(k+8),C(Cyan),aft*gain*.21f,ArcGeometry.Wisp,k+37);
                    }
                    for(int l=0;l<5;l++){var p2=p+Polar(H(k+l*17)*TAU,r*.63f,.09f*J(k+23*l));float sz=.013f+.024f*H(k+l*37);if(Has(FxLayers.Sparks))g.Sprite(p2,sz,sz*1.3f,0,C(Cyan),gain*aft*(.85f+.29f*Sin(t*29+j+l)),ArcGeometry.Flare,k);}
                }
            }
            Stars(Up*.13f,t-1.52f,.87f,40,1.26f,Cyan,668,true);Stars(Up*1.32f,t-1.65f,.92f,29,1.02f,Ice,318);
        }
        void Floor(float t)
        {
            float surge=Window(t,0,.055f,.19f,.68f),residue=Window(t,.025f,.11f,.61f,1.97f);
            if(Has(FxLayers.Surface)){
                g.GroundPatch(Up*.011f,.44f+1.63f*Ramp(t,0,.35f),C(Cyan),gain*surge*.52f,608);
                g.GroundPatch(Up*.014f,.37f+.52f*Ramp(t,0,.35f),C(Ice),gain*surge*.65f,801);
            }
            for(int wave=0;wave<2;wave++)
            {
                float age=t-wave*.115f;float u=age/(wave==0?.63f:.57f);
                if(u<=0||u>=1)continue;float r=(wave==0?1.92f:1.50f)*Pow(Sat(u/.75f),.61f);float en=Window(u,0,.08f,.39f,1);
                for(int arc=0;arc<5;arc++)
                {
                    float skip=Math.Max(.006f,(u-.34f)*.63f)*H(arc*13+21);float a0=(arc+skip)*TAU/5f,a1=(arc+1-skip*.56f)*TAU/5f;
                    const int n=27;
                    for(int i=0;i<n;i++)
                    {
                        float s=(float)i/(n-1),a=At(a0,a1,s);
                        float jag=.067f*Sin(7*a+.71f*wave)+.041f*Sin(13*a-.44f)+.021f*Sin(29*a+1.4f)+.013f*Sin(47*a+t*17);
                        float rr=r*(1+jag);g.path[i]=Polar(a,rr,.034f+.021f*Sin(6*a+u*4));g.side[i]=Polar(a,.046f+.029f*Sin(5*a+u*3),0);
                    }
                    if(Has(FxLayers.Surface)){
                        g.Line(g.path,n,.028f+wave*.005f,C(wave==0?Ice:Cyan),en*gain*(wave==0?1:.74f),arc+435,.14f);
                        if(Has(FxLayers.Sheets))g.Ribbon(g.path,g.side,n,1,C(Cyan),en*gain*.55f,arc+31);
                    }
                }
            }
            // Separate stable crack network, with radial roots, elbows and secondary fissures.
            for(int j=0;j<10;j++)
            {
                int k=g.seed+j*139+371;float a=(j+.69f*J(k+3))*TAU/10,r=(.82f+1.17f*H(k+5));
                float reach=Ramp(t,j*.006f,.12f+.21f*H(k+8));float age=Sat(t/1.97f);
                for(int branch=0;branch<2;branch++){
                    float n0=branch==0?.04f:.43f, len=branch==0?1f:.49f+H(k+34)*.18f;
                    const int n=24;for(int i=0;i<n;i++){
                        float u=(float)i/(n-1),s=At(n0,n0+len,reach*u);float theta=a+.14f*Sin(s*6+k)+.25f*Edges(s*6.2f,k+14)+.070f*Edges(s*15f,k+37);
                        if(branch==1)theta+=.93f*(s-n0)*(j%2==0?1:-1);
                        g.path[i]=Polar(theta,r*s,.024f+.005f*Sin(k+s*12));
                    }
                    if(Has(FxLayers.Surface)){
                        g.Line(g.path,n,.035f*(branch==0?1:.62f),new V3(.025f,.035f,.046f),gain*residue*.86f,k+2,.4f,ArcGeometry.Shard,true);
                        float flick=.44f+.56f*Pow(.5f+.5f*Sin(25*t+j*2.54f),2);
                        g.Line(g.path,n,(branch==0?.017f:.010f)*(1-.5f*age),C(Cyan),gain*residue*(surge+.75f*flick),k,.65f);
                    }
                    if(branch==0&&Has(FxLayers.Surface))Lamp(g.path[18],.086f,.092f,Cyan,residue*.44f,ArcGeometry.Mist,k);
                }
            }
            if(Has(FxLayers.Atmosphere)){
                for(int j=0;j<26;j++){
                    int k=g.seed+191*j;float delay=.026f+.105f*H(k+2),u=(t-delay)/(.47f+.65f*H(k+3));if(u<=0||u>=1)continue;
                    float a=TAU*H(k+6);var p=Polar(a,(.24f+1.37f*H(k+7))*(1-Exp(-u*3.7f)),.025f+(.21f+.81f*H(k+12))*4*u*(1-u));
                    float size=.034f+.118f*Pow(H(k+11),2);g.Chunk(p,size,a+u*3.4f,u*(2.8f+H(k+18)),Ash,gain*Window(u,0,.09f,.70f,1),k);
                }
            }
            if(Has(FxLayers.Surface)){
                float decay=Window(t,.05f,.17f,1.12f,1.97f);
                for(int j=0;j<24;j++){
                    int k=1567+j*139+g.seed;float ang=TAU*H(k+36),radius=.23f+Pow(H(k+19),.75f)*1.09f;
                    float size=(.070f+.16f*Pow(H(k+23),1.7f))*(1-.35f*radius);
                    V3 pos=Polar(ang,radius,.014f+.37f*size);g.Chunk(pos,size,ang+.43f,1.1f*H(k+13),new V3(.12f,.16f,.19f),decay*.96f,k);
                    if(j%3==0){V3 tip=pos+Polar(ang+.33f,size,.54f*size);Bolt(pos+Up*(size*.33f),tip,.014f,.016f,Ice,decay*(.54f+.21f*Sin(20*t+j)),k,t,0);}
                }
            }
            Lamp(Up*.08f,.91f,.24f,Ice,surge*.8f,ArcGeometry.Flare,371);
            Stars(Up*.06f,t-.035f,.68f,28,.99f,Cyan,487,true);
        }
    }
}
