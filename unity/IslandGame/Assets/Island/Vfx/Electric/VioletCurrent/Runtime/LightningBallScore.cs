using System;
using static VioletCurrent.MathFx;

namespace VioletCurrent
{
    [Flags]
    public enum BallLayers { Core=1, Filaments=2, Vapour=4, Sparks=8, All=15 }

    // Local +Z is flight direction. Every trail sample has a birth time so old knots
    // stay behind the moving front and continue to dissolve when emission stops.
    public sealed class LightningBallScore
    {
        public const float Release=.78f;
        public readonly BallGeometry g=new BallGeometry();
        public float flight=1.36f, speed=8.9f, radius=.19f, wake=1;
        public BallLayers layers=BallLayers.All;
        int seed;
        float now;
        readonly V3[] curve=new V3[63];
        static readonly V3 ultraviolet=new V3(.30f,.105f,.87f), violet=new V3(.53f,.21f,1f),
            lilac=new V3(.70f,.49f,1f), frost=new V3(.91f,.84f,1f);
        static float Fraction(float x){return x-(float)Math.Floor(x);}
        float Pulse(int id,float rate){return .55f+.45f*Noise(now*rate,seed+id);}
        V3 Position(float emission)
        {
            float phase=emission*10;
            return new V3(.042f*Sin(phase+H(seed)*TAU)+.023f*Sin(phase*1.73f),.038f*Sin(phase*.78f)+.016f*Sin(phase*2.11f),speed*emission);
        }
        public void Sample(float t,int randomSeed)
        {
            g.Clear();now=t;seed=randomSeed;g.seed=seed;
            if(t<0 || t>=flight+Release || radius<=0)return;
            if((layers&BallLayers.Core)!=0) Head();
            if((layers&BallLayers.Vapour)!=0){Vapour();Sheets();}
            if((layers&BallLayers.Filaments)!=0) WakeFilaments();
            if((layers&BallLayers.Sparks)!=0){Sparks();Echo();}
        }
        void Head()
        {
            float end=1-Ramp(now,flight,flight+.16f),on=Ramp(now,-.012f,.070f)*end;
            if(on<.002f)return;
            V3 c=Position(Math.Min(now,flight));float r=radius*(.94f+.09f*Pulse(9,23));
            // A lopsided three-dimensional cage sits just outside the rolling plasma surface.
            g.Sprite(c,r*2.80f,r*2.80f,0,violet,.47f*on,BallGeometry.Glow,0);
            g.Sprite(c,r*1.06f,r*1.06f,.14f*Sin(now*8+.4f),frost,1.03f*on,BallGeometry.Nucleus,now*2.3f+H(seed)*12);
            g.Sprite(c-Forward*r*.37f,r*1.62f,r*1.30f,.7f,lilac,.29f*on,BallGeometry.Cloud,now*1.9f+22);
            for(int j=0;j<5;j++){
                int key=seed+227*j;float off=H(key)*TAU,tilt=J(key+77)*1.25f,cr=Cos(tilt),sr=Sin(tilt);
                float rotation=now*(2.6f+H(key+2)*5)*(j%2==0?1:-1),length=1.42f+H(key+19)*2.98f;
                for(int i=0;i<31;i++){
                    float f=i/30f,a=off+f*length+rotation;
                    float k=r*(1.02f+.17f*Noise(f*5+now*3,key)+.095f*Edges(f*18+now*3,key+17));
                    float x=Cos(a)*k,y=Sin(a)*k,z=.22f*r*Sin(a*2+off);
                    curve[i]=c+new V3(x*cr-z*sr,y,x*sr+z*cr);
                }
                g.Line(curve,31,r*(.081f+.048f*H(key+29)),j%3==0?frost:lilac,on*(.52f+.53f*Pulse(key,21)),key,.46f);
            }
            // Intermittent little bows and sparks extend ahead of the ball, off its surface.
            for(int j=0;j<4;j++){
                int key=seed+119*j;float a=H(key)*TAU+now*(2+j*.31f);
                float blink=Ramp(Pulse(key+61,19),.37f,.78f);
                V3 o=c+new V3(Cos(a)*r*.91f,Sin(a)*r*.91f,r*(.80f+.19f*j));
                V3 b=c+new V3(Cos(a+1.13f)*r*1.17f,Sin(a+1.13f)*r*1.17f,r*(1.58f+.18f*j));
                g.Bolt(o,b,r*.083f,r*.22f,frost,on*blink,key,now,1);
            }
        }
        float Knot(float born){return .50f+.50f*Sin(born*43+1.04f*Sin(born*13+H(seed)*5));}
        V3 WakePoint(float born,float age,int strand)
        {
            float k=radius/.19f, roll=born*11.6f+age*4.8f+strand*2.327f+H(seed)*2.4f;
            float tube=(.055f+.159f*Pow(age,.55f))*(.74f+.26f*Sin(born*18+strand));
            return Position(born)+new V3((Cos(roll)*tube+.059f*Sin(born*24+strand)) *k,
                (Sin(roll)*tube+.080f*Sin(born*15+.65f)+age*.15f)*k,0);
        }
        void Vapour()
        {
            float persistence=.64f*Math.Min(wake,1.04f),step=.022f;
            if(persistence<.01f)return;
            int first=Math.Max(0,(int)((now-persistence)/step)),last=(int)(Math.Min(flight,now)/step);
            for(int n=first;n<=last;n++){
                int key=seed+n*733;float born=n*step,age=now-born,u=age/persistence;
                if(u<0||u>=1)continue;
                float bell=Pow(1-u,1.37f)*Ramp(age,-.015f,.057f),knot=Knot(born);
                V3 p=WakePoint(born,age,0);
                float width=radius*(1.04f+.98f*Sqrt01(u))*(.77f+.46f*H(key+9))*(.84f+.33f*knot);
                g.Sprite(p,width*1.25f,width*(.8f+.34f*H(key)),H(key)*TAU+age*J(key+7)*2.2f,
                    n%4==0?lilac:violet,bell*(.058f+.197f*knot*knot),BallGeometry.Cloud,H(key)*59+age*1.63f);
                if((n&1)==0){
                    V3 off=new V3(.12f*J(key+1),.09f*J(key+2)+.084f*u,.05f*J(key+3))*(radius/.19f);
                    g.Sprite(p+off,width*1.62f,width*1.35f,-age*1.7f+H(key+55)*TAU,
                        ultraviolet,bell*(.050f+.123f*knot),BallGeometry.Cloud,H(key+65)*39-age*1.72f);
                }
                if(n%4==1){
                    float coil=H(key+45)*TAU+.65f*age,reach=width*(.81f+.2f*H(key+76));
                    for(int j=0;j<29;j++){
                        float x=j/28f,phi=coil+x*(3.0f+.79f*H(key+73));
                        float r=reach*(.93f+.12f*Noise(x*3+age,key+17));
                        curve[j]=p+new V3(Cos(phi)*r,Sin(phi)*r,(x-.5f)*width*1.35f+.29f*r*Sin(phi));
                    }
                    g.Line(curve,29,width*.165f,lilac,bell*(.16f+.34f*knot),key,.72f,BallGeometry.Ion);
                }
                if(knot>.38f)g.Sprite(p,width*1.65f,width*1.65f,0,violet,bell*.195f*knot,BallGeometry.Glow,0);
            }
        }
        static float Sqrt01(float f){return (float)Math.Sqrt(Math.Max(0,f));}
        void WakeFilaments()
        {
            float life=.55f*Math.Min(wake,1.15f);if(life<.015f)return;
            const float spacing=.053f;
            int first=Math.Max(0,(int)((now-life-spacing)/spacing)),last=(int)(Math.Min(now,flight)/spacing);
            for(int n=first;n<=last;n++){
                float born=n*spacing,age=now-born,fade=Pow(1-age/life,1.68f)*(1-Ramp(now,flight+.035f,flight+.265f));
                if(age<0||fade<.012f)continue;
                int key=seed+199*n;float knot=Knot(born);
                for(int s=0;s<3;s++){
                    float offset=s*.009f,start=born+offset,stop=Math.Min(Math.Min(now,flight),start+spacing*(.66f+.61f*H(key+s)));
                    if(stop<=start+.001f)continue;
                    V3 a=WakePoint(start,now-start,s),b=WakePoint(stop,now-stop,s);
                    float blink=.28f+.72f*Pulse(key+13*s,19);
                    float w=radius*(.094f+.146f*knot)*(s==0?1:.61f);
                    g.Bolt(a,b,w,radius*(.33f+.64f*knot),s==0?lilac:s==1?frost:violet,
                        fade*(.54f+.77f*blink)*(.39f+2.30f*knot*knot),key+101*s,now,s==0?2:1,default(V3),18);
                }
                if(knot>.66f){
                    V3 m=WakePoint(born,age,0);
                    float knotSize=radius*(.63f+.45f*H(key+33));
                    g.Sprite(m,knotSize*1.9f,knotSize*1.5f,0,lilac,fade*.46f,BallGeometry.Glow,0);
                    g.Sprite(m,knotSize*1.23f,knotSize*.85f,age*3+H(key)*5,frost,fade*1.62f,BallGeometry.Knot,H(key)*23+age*2.8f);
                    for(int h=0;h<2;h++){
                        float phase=H(key+73*h)*TAU;V3 spur=m+new V3(Cos(phase)*knotSize,Sin(phase)*knotSize,.21f*knotSize);
                        g.Bolt(m,spur,knotSize*(.107f+.04f*h),knotSize*.33f,frost,fade*(1.25f-h*.26f),key+83*h,now,2,default(V3),15);
                    }
                }
            }
        }
        void Sheets()
        {
            const float step=.094f;
            float life=.57f*wake;if(life<.015f)return;
            int first=Math.Max(0,(int)((now-life-step)/step)),last=(int)(Math.Min(now,flight)/step);
            for(int n=first;n<=last;n++){
                float born=n*step,age=now-born,span=Math.Min(Math.Min(flight-born,age),step*(1.2f+.32f*H(n+seed)));
                if(span<=.005f||age>life)continue;
                int key=seed+257*n;float phase=H(key)*TAU+age*(2.6f+1.4f*J(key+5));
                for(int i=0;i<30;i++){
                    float u=i/29f,b=born+u*span,spin=phase+u*3.62f+.23f*Sin(u*11+phase);
                    V3 radial=new V3(Cos(spin),Sin(spin),.24f*Sin(spin*2+.7f));
                    float extent=radius*(.67f+.81f*Sin(PI*u)+.23f*Noise(u*5+now,key))*(.92f+.32f*age);
                    V3 root=WakePoint(b,now-b,2);
                    curve[i]=root+radial*(extent*.10f);
                    g.scratch[i]=root+radial*extent;
                }
                g.SheetStrip(curve,g.scratch,30,n%3==0?lilac:violet,Pow(1-age/life,1.11f)*.75f,key);
            }
        }
        void Echo()
        {
            float age=now-flight;if(age<0||age>.49f)return;
            V3 center=Position(flight);
            for(int j=0;j<7;j++){
                int key=seed+843+j*701;float delay=H(key)*.20f,life=.085f+.18f*H(key+33),u=(age-delay)/life;
                if(u<0||u>1)continue;
                V3 v=new V3(J(key+31),H(key+55)*1.2f,J(key+63));
                V3 c=center+v*radius*(.9f+1.4f*u);float alpha=Sin(PI*u)*(1-u)*1.7f;
                g.Bolt(c-v*radius*.54f,c,radius*.072f,radius*.24f,lilac,alpha,key,now,1,default(V3),14);
                g.Sprite(c,radius*.30f,radius*.30f,now*2.3f,frost,alpha*2.2f,BallGeometry.Pin,0);
            }
        }
        void Sparks()
        {
            const float step=.0097f;int first=Math.Max(0,(int)((now-.67f)/step)),last=(int)(Math.Min(now,flight)/step);
            for(int n=first;n<=last;n++){
                int key=seed+n*397;float born=n*step,age=now-born,life=.16f+.49f*H(key+5);
                if(age<0||age>=life)continue;
                float u=age/life,theta=H(key+1)*TAU;
                V3 radial=new V3(Cos(theta),Sin(theta),.36f*J(key+7));
                float k=radius/.19f;V3 vel=(radial*(.33f+H(key+3)*1.18f)-Forward*(.11f+.63f*H(key+2)))*k;
                V3 p=WakePoint(born,age,1)+radial*radius*(.20f+.65f*H(key+61))+vel*age+Up*((.14f-age*.46f)*age*k);
                float blink=.31f+.69f*Pulse(key+23,23),a=Pow(1-u,1.35f)*blink;
                float s=(.012f+.027f*H(key+20))*k;
                g.Sprite(p,s*1.4f,s*1.4f,H(key+42)*6.2f,frost,a*2.2f,BallGeometry.Pin,H(key)*12);
                if(n%3==0){curve[0]=p-vel*(.015f+.045f*H(key+17));curve[1]=p;g.Line(curve,2,s*.52f,lilac,a,key,0);}
            }
        }
    }
}
