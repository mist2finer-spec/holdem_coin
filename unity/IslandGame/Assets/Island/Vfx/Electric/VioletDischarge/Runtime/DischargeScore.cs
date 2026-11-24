using System;
using static VioletDischarge.MathFx;

namespace VioletDischarge
{
    [Flags]
    public enum DischargeLayers { Core=1, Shell=2, Bolts=4, Rays=8, Shockwave=16, Embers=32, All=63 }
    public sealed class DischargeScore
    {
        public const float BurstTime=1.43f, Duration=2.28f;
        public readonly BurstGeometry g=new BurstGeometry();
        public DischargeLayers layers=DischargeLayers.All;
        static readonly V3 Deep=new V3(.39f,.081f,.89f),Violet=new V3(.61f,.16f,1),
            Orchid=new V3(.81f,.34f,1),Lilac=new V3(.82f,.62f,1),Ice=new V3(.97f,.89f,1);
        readonly V3[] path=new V3[68],across=new V3[68],twig=new V3[17];
        int seed;
        float t,age,charge,body;
        static float Decay(float x,float rate){return Exp(-Math.Max(0,x)*rate);}
        static float Gauss(float x,float spread){float z=x/spread;return Exp(-z*z);}
        static V3 Ray(float a,float z){float s=(float)Math.Sqrt(Math.Max(0,1-z*z));return new V3(Cos(a)*s,Sin(a)*s,z);}
        bool On(DischargeLayers part){return (layers&part)!=0;}
        public static float LightAt(float time)
        {
            if(time<0||time>=Duration)return 0;
            return .23f*Window(time,0,.34f,BurstTime-.12f,BurstTime+.05f)+
                (time>=BurstTime?1.88f*Decay(time-BurstTime,7.9f):0);
        }
        public void Sample(float seconds,int randomSeed)
        {
            g.Clear();if(seconds<0||seconds>=Duration)return;
            t=seconds;age=t-BurstTime;seed=randomSeed;g.seed=randomSeed;
            charge=Ramp(t,-.012f,.28f)*(1-Ramp(age,-.004f,.09f));
            float brace=Ramp(age,-.192f,-.030f);
            body=(.22f+.78f*Ramp(t,.045f,.54f))*(1-.135f*brace)*(1+.013f*Sin(t*13.8f));
            if(On(DischargeLayers.Shell)) Envelope();
            if(On(DischargeLayers.Core)) Heart();
            if(On(DischargeLayers.Bolts)) Feeders();
            if(On(DischargeLayers.Rays)) Rays();
            if(On(DischargeLayers.Shockwave)) Rupture();
            if(On(DischargeLayers.Embers)) Embers();
        }
        void Envelope()
        {
            if(charge<.003f)return;
            g.Sprite(Zero,body,body,0,Violet,charge*.75f,BurstGeometry.Shell,0);
            g.Sprite(Zero,body*1.15f,body*1.15f,0,Deep,charge*.045f,BurstGeometry.Halo,0);
            float wave=(t*.94f+.02f)%1;float r=body*(.56f+.42f*wave);
            g.Sprite(Zero,r,r,.12f,Orchid,charge*Sin(wave*PI)*.041f,BurstGeometry.Shock,.02f+.05f*wave);
        }
        // Both broken ends come from the same faceted prism. The irregular cut is shared
        // between halves so the two edges fit together as the charge closes the gap.
        static readonly V3 PrismUp=new V3(.48f,.85f,.21f).Unit;
        static readonly V3 PrismSide=V3.Cross(PrismUp,Forward).Unit;
        static readonly V3 PrismDepth=V3.Cross(PrismSide,PrismUp).Unit;
        readonly V3[] cutRim=new V3[6],shoulderRim=new V3[6];

        float PrismGap()
        {
            float lockIn=Ramp(age,-.23f,-.015f);
            return (.118f+.067f*Ramp(t,.2f,.86f)+.018f*Sin(7*t))*(1-.53f*lockIn);
        }
        V3 PieceCenter(int sign)
        {
            float split=PrismGap()+.69f*Ramp(age,0,.31f);
            float shear=.060f+.036f*Sin(t*4.8f)+.33f*Ramp(age,0,.33f);
            return body*sign*(PrismUp*split+PrismSide*shear);
        }
        V3 GemOffset(int sign,float x,float y,float z)
        {
            float a=.29f+1.10f*Math.Min(t,BurstTime)+sign*(.12f*Sin(5*t)+2.10f*Ramp(age,0,.42f));
            float c=Cos(a),s=Sin(a);
            return body*(PrismSide*(x*c+z*s)+PrismUp*y+PrismDepth*(z*c-x*s));
        }
        V3 Contact(int sign,float acrossCut)
        {
            return PieceCenter(sign)+GemOffset(sign,acrossCut,-sign*.041f,-.10f);
        }
        void Heart()
        {
            float crystalLight=Ramp(t,-.012f,.22f)*(1-Ramp(age,.08f,.36f));
            if(crystalLight>.004f){
                CrystalHalf(1,crystalLight);
                CrystalHalf(-1,crystalLight*.94f);
            }
            OrbitSplinters();
            float focus=Ramp(age,-.19f,-.015f);
            float arc=charge*(.66f+.21f*Noise(t*18,seed+77)+.28f*focus);
            if(arc>.012f){
                // Tiny, offset arc roots show the actual gap between the faces.
                for(int i=0;i<3;i++){
                    float lateral=(i-1)*.096f;
                    V3 a=Contact(-1,lateral),b=Contact(1,lateral*.83f+.023f*Sin(t*16+i));
                    float strength=arc*(i==1?1.68f:.69f+.24f*Noise(t*17,seed+31*i));
                    V3 knee=PrismSide*(.044f*J(seed+i*191));
                    g.Bolt(a,b,body*(i==1?.027f:.013f),body*.073f,i==1?Ice:Lilac,strength,seed+1191+i,t,1,knee,15);
                    if(i==1){
                        g.Sprite(a,.084f*body,.067f*body,.42f,Lilac,arc,BurstGeometry.Glint,t);
                        g.Sprite(b,.088f*body,.065f*body,-.21f,Ice,arc,BurstGeometry.Glint,t);
                    }
                }
            }
            float snap=Gauss(age-.025f,.045f);
            float flare=charge*.16f+1.46f*snap;
            g.Sprite(Zero,.23f*body+.62f*snap,.022f+.053f*snap,-.63f,Lilac,flare,BurstGeometry.Lens,t);
            g.Sprite(Zero,.38f*body,.31f*body,0,Deep,charge*.19f,BurstGeometry.Halo,0);
        }
        void CrystalHalf(int sign,float alpha)
        {
            V3 center=PieceCenter(sign),inside=center+GemOffset(sign,0,sign*.16f,0);
            int key=seed+101*(sign+1);
            for(int i=0;i<6;i++){
                float angle=TAU*i/6f+.16f;
                float x=Cos(angle),z=Sin(angle);
                // Opposite sides share the same sawtooth profile, with two pronounced notches.
                float cutY=.09f*x+.044f*J(321+i*79);
                float shoulderY=sign*(.21f+.056f*J(key+i*43));
                cutRim[i]=center+GemOffset(sign,.267f*x,cutY,.204f*z);
                shoulderRim[i]=center+GemOffset(sign,.228f*x+.018f*sign,shoulderY,.186f*z);
            }
            V3 apex=center+GemOffset(sign,sign*.046f,sign*(sign>0?.594f:.465f),-.021f);
            V3 cutCenter=center+GemOffset(sign,.021f,-sign*.048f,-.025f);
            for(int i=0;i<6;i++){
                int next=(i+1)%6;int id=key+i*307;
                V3 cutA=cutRim[i],cutB=cutRim[next],topA=shoulderRim[i],topB=shoulderRim[next];
                float phase=(id&63)+t*.68f;
                V3 wall=V3.Lerp(new V3(.35f,.12f,.84f),new V3(.77f,.53f,1),H(id));
                bool etched=(i&1)==0;
                g.CrystalFace(cutA,cutB,topB,inside,wall,alpha,phase,0,0,1,0,1,1,etched);
                g.CrystalFace(cutA,topB,topA,inside,wall,alpha,phase,0,0,1,1,0,1,etched);
                g.CrystalFace(topA,topB,apex,inside,V3.Lerp(wall,Lilac,.21f),alpha,phase+.26f,0,0,1,0,.47f,1);
                g.CrystalFace(cutB,cutA,cutCenter,inside,V3.Lerp(Orchid,Ice,.43f),alpha,phase+.50f,0,0,1,0,.33f,1);
                if(i%2==0){
                    twig[0]=cutA;
                    twig[1]=V3.Lerp(cutA,cutB,.27f);
                    twig[2]=V3.Lerp(cutA,cutB,.55f+.18f*Sin(t*5+i));
                    g.Line(twig,3,.011f*body,Lilac,alpha*(.52f+.28f*Sin(t*6+i)),id,.34f);
                }
            }
        }
        V3 OrbitPoint(float angle,float radius)
        {
            float c=Cos(angle),s=Sin(angle);
            return new V3(.97f*c+.12f*s,.21f*c+.49f*s,.63f*s-.13f*c)*radius;
        }
        void OrbitSplinters()
        {
            float active=Ramp(t,.09f,.41f)*(1-Ramp(age,.14f,.49f));
            if(active<.006f)return;
            float converge=Ramp(age,-.23f,-.01f),release=Ramp(age,0,.43f);
            for(int j=0;j<5;j++){
                int id=seed+j*601;
                float angle=TAU*(j+.19f*J(id+9))/5f+.55f+t*2.37f+converge*.69f+release*.32f;
                float r=body*((.64f+.12f*H(id+3))*(1-.48f*converge)+release*(.77f+.48f*H(id+7)));
                V3 c=OrbitPoint(angle,r);
                V3 tangent=(OrbitPoint(angle+.02f,r)-c).Unit,radial=c.Unit;
                V3 lateral=V3.Cross(tangent,radial).Unit,side=V3.Cross(lateral,tangent).Unit;
                float size=body*(.083f+.048f*H(id+27));
                V3 tip=c+tangent*size*1.12f,tail=c-tangent*size*.89f;
                V3 a=c+side*size*.48f,b=c+(-.32f*side+.39f*lateral)*size,d=c+(-.30f*side-.44f*lateral)*size;
                g.CrystalFace(a,b,tip,c,Lilac,active,id%43+t*.6f);
                g.CrystalFace(b,d,tip,c,Violet,active,id%43+t*.6f+.3f);
                g.CrystalFace(d,a,tip,c,Orchid,active,id%43+t*.6f+.4f);
                g.CrystalFace(a,b,tail,c,Violet,active,id%43+.4f);
                g.CrystalFace(b,d,tail,c,Lilac,active,id%43+.1f);
                g.CrystalFace(d,a,tail,c,Deep,active,id%43+.5f);
                for(int i=0;i<14;i++)path[i]=OrbitPoint(angle-(1-i/13f)*(.24f+.11f*H(id)),r);
                g.Line(path,14,.009f*body,Orchid,active*.46f,id,.68f,BurstGeometry.Ejecta,.9f);
            }
        }
        void Feeders()
        {
            if(charge<.005f)return;
            float late=Ramp(t,.1f,.75f);
            for(int j=0;j<6;j++){
                int id=seed+811*j;
                float angle=j==0?.01f:j==1?3.18f:j==2?1.44f:j==3?4.91f:j==4?.71f:2.61f;
                angle+=.15f*Noise(t*3.5f,id)+.13f*J(id+61);
                float z=j<2?J(id+47)*.20f:J(id+47)*.54f;
                V3 dir=Ray(angle,z),side=new V3(-Sin(angle),Cos(angle),0);
                float flick=Sat(.48f+.77f*Noise(9.6f*t,id+7)+.15f*Sin(13*t+j));
                float show=j<2?.65f+.35f*flick:j<4?.25f+.75f*flick:Ramp(flick,.39f,.88f)*.67f;
                float reach=j<2?1.49f+.39f*flick:1.12f+.63f*flick;
                float grow=Ramp(t,j*.023f,.30f+j*.038f);
                Channel(dir,side,body*reach*(.27f+.73f*grow),(.022f+.019f*show)*(j<2?1.23f:.81f),
                    charge*show*(.72f+.63f*late),id,j<2?Orchid:Violet);
            }
        }
        void Channel(V3 dir,V3 side,float length,float width,float alpha,int id,V3 color)
        {
            if(alpha<.015f||length<.05f)return;
            int pole=dir.y+.46f*dir.x>=0?1:-1;
            V3 anchor=PieceCenter(pole)+GemOffset(pole,.072f*J(id+23),pole*.25f,-.15f);
            const int n=41;float tick=t*12.3f;int k=(int)tick;float blend=Smooth((tick-k)*2.7f);
            for(int i=0;i<n;i++){
                float u=i/(float)(n-1),arc=Sin(PI*u);
                float main=At(Edges(u*5.3f,id+k*139),Edges(u*5.3f,id+(k+1)*139),blend);
                float kink=At(Edges(u*13,id+37+k*139),Edges(u*13,id+37+(k+1)*139),blend);
                float wave=(.138f*main+.104f*kink+.040f*Edges(u*27.3f,id+67+k*101)+.050f*Sin(u*6.6f+id*.044f+t*5.1f))*length;
                path[i]=V3.Lerp(anchor,dir*length,u)+side*wave*(.29f*u+.90f*arc)+Forward*(arc*.10f*Noise(u*5+t*3,id+62));
            }
            g.Line(path,n,width*2.54f,color,alpha*.22f,id,.65f,BurstGeometry.DistantWire);
            g.Line(path,n,width,color,alpha*1.34f,id,.50f);
            for(int b=0;b<3;b++){
                int key=id+137*b;int start=7+(int)(H(key+33)*26);V3 root=path[start];
                V3 tip=root+dir*length*(.08f+.22f*H(key+9))+side*(J(key+16)*.39f*length)+Forward*(J(key+21)*.17f*length);
                for(int n2=0;n2<12;n2++){float f=n2/11f;twig[n2]=V3.Lerp(root,tip,f)+side*(Sin(f*PI)*.047f*length*Edges(f*7+t*6,key));}
                g.Line(twig,12,width*(.29f+.19f*H(key)),color,alpha*(.4f+.25f*H(key+1)),key,.78f);
            }
        }
        void Rays()
        {
            if(t<.055f)return;
            for(int i=0;i<22;i++){
                int id=seed+i*269;float f=(t*(.65f+.72f*H(id+6))+H(id+2))%1;
                float pulse=Pow(Sin(PI*f),1.4f)*charge*.65f;
                if(pulse<.014f)continue;
                float angle=TAU*(i+.64f*J(id+8))/22f;V3 d=Ray(angle,.62f*J(id+42));
                float r=body*(1.02f+(1-f)*(.45f+.50f*H(id+3)));
                float len=body*(.08f+.29f*H(id+30))*Sin(PI*f);
                Streak(d*r,d*(r+len),.008f+.009f*H(id+88),i%3==0?Lilac:Violet,pulse,id);
            }
        }
        void Streak(V3 a,V3 b,float w,V3 rgb,float opacity,int id)
        {
            if(opacity<.006f)return;
            for(int i=0;i<7;i++)twig[i]=V3.Lerp(a,b,i/6f);
            g.Line(twig,7,w,rgb,opacity,id,.83f,BurstGeometry.Ejecta);
        }
        void Rupture()
        {
            if(age<0||age>.71f)return;
            float fast=1-Exp(-age*7.9f),wide=.71f+2.34f*fast;
            float shell=Window(age,-.014f,.039f,.125f,.50f)*(.98f-.37f*fast);
            g.Sprite(Zero,wide,wide,0,Violet,shell*1.43f,BurstGeometry.Shock,age);
            float inner=.38f+1.88f*(1-Exp(-age*6.25f));
            g.Sprite(Zero,inner,inner,.05f,Orchid,Window(age,-.019f,.055f,.13f,.39f)*1.13f,BurstGeometry.Fracture,age*4.9f+H(seed)*3);
            float impact=Window(age,-.014f,.023f,.087f,.235f);
            float center=.5f+1.31f*(1-Exp(-age*14.0f));
            g.Sprite(Zero,center*.92f,center*.70f,-.62f,Violet,1.56f*impact,BurstGeometry.Halo,0);
            // The impact follows the two receding fracture faces.
            for(int pole=-1;pole<=1;pole+=2){
                V3 point=PieceCenter(pole);
                g.Sprite(point,center*.49f,center*.24f,-.63f,Lilac,impact*1.58f,BurstGeometry.Halo,0);
                g.Sprite(point,center*.44f,center*.10f,-.63f,Ice,impact*1.45f,BurstGeometry.Lens,0);
            }
            g.Sprite(Zero,wide*1.18f,wide*1.18f,0,Deep,shell*.33f,BurstGeometry.Halo,0);
            Fans();
            Peel(wide);
            for(int i=0;i<14;i++){
                int id=seed+1207*i;float delay=.052f*H(id+2),x=age-delay;
                float strike=Window(x,-.01f,.026f,.085f+.035f*H(id+12),.24f+.10f*H(id+41));if(strike<=.006f)continue;
                float a=TAU*(i+J(id+5)*.44f)/14;V3 d=Ray(a,J(id+7)*.73f);
                float far=(1.16f+1.58f*H(id+21))*(.34f+.66f*Ramp(x,0,.16f));
                float innerR=.11f+1.18f*Ramp(x,.044f,.29f);
                g.Bolt(d*innerR,d*far,.016f+.025f*H(id+99),.11f+.16f*H(id+18),i%3==0?Ice:Orchid,strike*(.76f+.31f*H(id+43)),id,t,1,new V3(-d.y,d.x,0)*(.14f*J(id+3)),26);
            }
        }
        void Fans()
        {
            for(int i=0;i<30;i++){
                int key=seed+i*391;float time=age-.046f*H(key+9);
                float alpha=Window(time,-.015f,.035f,.083f+.060f*H(key+17),.256f+.11f*H(key+20));
                if(alpha<.008f)continue;
                float ang=TAU*(i+.64f*J(key))/30;V3 d=Ray(ang,J(key+24)*.86f),side=new V3(-Sin(ang),Cos(ang),0);
                float end=(1.36f+3.86f*H(key+43))*(.16f+.84f*(1-Exp(-Math.Max(0,time)*13)));
                float begin=end*(.09f+.65f*Ramp(time,.03f,.28f));
                if(i%3!=0)Streak(d*begin,d*end,(.020f+.062f*H(key+6))*(1-.58f*Ramp(time,.09f,.35f)),i%2==0?Orchid:Lilac,alpha*1.15f,key);
                else{
                    for(int k=0;k<23;k++){
                        float u=k/22f;
                        V3 mid=d*At(begin,end,u)+side*(Sin(PI*u)*(.082f*J(key+12)+.038f*Edges(u*6+time*3,key)));
                        float w=(.05f+.12f*H(key+58))*Sin(PI*u)*(.69f+.31f*u);
                        path[k]=mid-side*w;across[k]=mid+side*w;
                    }
                    g.SheetStrip(path,across,23,Violet,alpha*1.35f,key);
                }
            }
        }
        // Independent strips tear away from the outside of the first shock front.
        void Peel(float front)
        {
            for(int k=0;k<15;k++){
                int key=seed+1597*k;float lag=.028f+.078f*H(key),x=age-lag;
                float fade=Window(x,-.001f,.047f,.11f+.06f*H(key+1),.30f+.15f*H(key+3));
                if(fade<.008f)continue;
                float start=TAU*(k+J(key+19)*.45f)/15,arc=.12f+.43f*H(key+45);
                float radius=front*(.65f+.28f*H(key+63))+x*(.53f+H(key+51));
                for(int i=0;i<23;i++){
                    float u=i/22f,angle=start+arc*u+.13f*x;
                    float z=.74f*J(key+236)+.16f*Sin(u*PI+key*.19f);
                    V3 dir=Ray(angle,z);
                    float crumple=.06f*Edges(u*4.7f+x*2,key)+.025f*Edges(u*13.4f,key+83);
                    float w=(.032f+.083f*H(key+315))*Sin(PI*u)*(1+.50f*Sin(u*6+key));
                    path[i]=dir*(radius+crumple-w);across[i]=dir*(radius+crumple+w)+Forward*(x*.24f);
                }
                g.SheetStrip(path,across,23,k%4==0?Lilac:Orchid,fade*(.60f+.48f*H(key+79)),key);
                if(k%3==0)g.Line(across,23,.016f,Lilac,fade*.68f,key,.80f);
            }
        }
        void Embers()
        {
            if(age<.014f)return;
            for(int i=0;i<87;i++){
                int key=seed+i*1031;float lag=.13f*H(key+39),x=age-lag,life=.23f+.54f*H(key+15);
                if(x<0||x>=life)continue;
                float u=x/life,ang=TAU*H(key);V3 d=Ray(ang,J(key+2)*.92f);
                float speed=1.6f+5.3f*H(key+3),r=.21f+.53f*H(key+8)+speed*(1-Exp(-2.9f*x))/2.9f;
                V3 c=d*r-Up*(.27f*x*x);float fa=Pow(1-u,.96f)*Ramp(x,-.006f,.025f)*(.44f+.56f*H(key+23));
                fa*=1-Ramp(t,Duration-.16f,Duration-.025f);
                float sz=.012f+.031f*H(key+16);
                g.Sprite(c,sz,sz*(.6f+.54f*H(key+18)),TAU*H(key+19),i%4==0?Ice:Lilac,fa*1.45f,BurstGeometry.Cinder,key%51);
                if(i%3==0)Streak(c-d*(.05f+.21f*(1-u)),c,sz*.55f,Orchid,fa,key);
                if(i%11==0 && x>.12f){
                    V3 tip=c+d*(.07f+.17f*H(key+5))+Up*(.06f*J(key+24));
                    g.Bolt(c,tip,sz*.39f,.043f,Lilac,fa*.86f,key,t,1,default(V3),10);
                }
            }
        }
    }
}
