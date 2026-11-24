// Pure C# local-space mesh builder. Reused by the Unity playback component and by the preview renderer.
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
namespace VioletCurrent
{
    [StructLayout(LayoutKind.Sequential, Pack=4)]
    public struct V3
    {
        public float x,y,z;
        public V3(float x,float y,float z){this.x=x; this.y=y; this.z=z;}
        public float Length { get { return (float)Math.Sqrt(x*x+y*y+z*z); } }
        public V3 Unit { get { float l=Length;return this*(1f/Math.Max(.00001f,l)); } }
        public static V3 operator +(V3 a,V3 b){return new V3(a.x+b.x,a.y+b.y,a.z+b.z);}
        public static V3 operator -(V3 a,V3 b){return new V3(a.x-b.x,a.y-b.y,a.z-b.z);}
        public static V3 operator *(V3 a,float s){return new V3(a.x*s,a.y*s,a.z*s);}
        public static V3 operator *(float s,V3 a){return a*s;}
        public static V3 Cross(V3 a,V3 b){return new V3(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x);}
        public static V3 Lerp(V3 a,V3 b,float t){return a+(b-a)*t;}
    }
    [StructLayout(LayoutKind.Sequential, Pack=4)]
    public struct BallVertex
    {
        public V3 position, direction, color;
        public float opacity,u,v,kind,seed,width,mode;
        public BallVertex(V3 p,V3 dir,V3 rgb,float a,float u,float v,float k,float seed,float width,float mode)
        {position=p;direction=dir;color=rgb;opacity=a;this.u=u;this.v=v;kind=k;this.seed=seed;this.width=width;this.mode=mode;}
    }
    public static class MathFx
    {
        public const float PI=(float)Math.PI, TAU=2*PI;
        public static float Sin(float a){return (float)Math.Sin(a);}
        public static float Cos(float a){return (float)Math.Cos(a);}
        public static float Exp(float a){return (float)Math.Exp(a);}
        public static float Pow(float a,float b){return (float)Math.Pow(Math.Max(0,a),b);}
        public static float Sat(float x){return Math.Min(1,Math.Max(0,x));}
        public static float Smooth(float x){x=Sat(x);return x*x*(3-2*x);}
        public static float Ramp(float t,float a,float b){return Smooth((t-a)/(b-a));}
        public static float Window(float t,float a,float b,float c,float d){return Ramp(t,a,b)*(1-Ramp(t,c,d));}
        public static float At(float x,float y,float t){return x+(y-x)*t;}
        // Integer hash gives reproducible strands without touching a game's global random state.
        public static float H(int n){unchecked{uint x=(uint)n+0x9e3779b9u;x^=x>>16;x*=0x7feb352du;x^=x>>15;x*=0x846ca68bu;x^=x>>16;return (x>>8)*(1f/16777216f);}}
        public static float J(int n){return H(n)*2-1;}
        public static float Edges(float x,int seed){int k=(int)Math.Floor(x);return At(J(seed+k*271),J(seed+(k+1)*271),x-k);}
        public static float Noise(float x,int seed){int k=(int)Math.Floor(x);return At(J(seed+k*271),J(seed+(k+1)*271),Smooth(x-k));}
        public static readonly V3 Up=new V3(0,1,0), Right=new V3(1,0,0), Forward=new V3(0,0,1), Zero=new V3(0,0,0);
        public static V3 Polar(float a,float r,float h){return new V3(Cos(a)*r,h,Sin(a)*r);}
    }
    public sealed class BallGeometry
    {
        public readonly List<BallVertex> vertices=new List<BallVertex>(20000);
        public readonly List<int> luminous=new List<int>(58000);
        public readonly V3[] path=new V3[129], scratch=new V3[129];
        public const int Wire=0, Ion=1, Cloud=2, Nucleus=3, Pin=4, Glow=5, Knot=6, Sheet=7;
        public int seed;
        public void Clear(){vertices.Clear();luminous.Clear();}
        void Faces(int start,int pairs,List<int> dest)
        {
            for(int i=0;i<pairs-1;i++){int a=start+2*i;dest.Add(a);dest.Add(a+1);dest.Add(a+2);dest.Add(a+2);dest.Add(a+1);dest.Add(a+3);}
        }
        public void Line(V3[] p,int n,float width,V3 color,float alpha,int id,float endFade=.55f,int kind=Wire,float headBias=0)
        {
            if(alpha<.006f||width<.0001f||n<2)return;
            int start=vertices.Count;
            for(int i=0;i<n;i++)
            {
                float u=(float)i/(n-1);
                float tip=.045f+.955f*MathFx.Pow(MathFx.Sin(MathFx.PI*u),endFade);
                float localAlpha=alpha*MathFx.At(1f,.12f+1.10f*MathFx.Pow(u,.9f),headBias);
                var tangent=(p[Math.Min(i+1,n-1)]-p[Math.Max(0,i-1)]).Unit;
                float w=width*tip*(.83f+.17f*MathFx.H(id+i/2*311));
                vertices.Add(new BallVertex(p[i],tangent,color,localAlpha,u,0,kind,id%157,-w,1));
                vertices.Add(new BallVertex(p[i],tangent,color,localAlpha,u,1,kind,id%157,w,1));
            }
            Faces(start,n,luminous);
        }
        public void SheetStrip(V3[] inner,V3[] outer,int count,V3 rgb,float opacity,int id)
        {
            if(opacity<.004f)return;
            int start=vertices.Count;
            for(int i=0;i<count;i++){
                float u=(float)i/(count-1);
                vertices.Add(new BallVertex(inner[i],MathFx.Zero,rgb,opacity,u,0,Sheet,id%73,0,0));
                vertices.Add(new BallVertex(outer[i],MathFx.Zero,rgb,opacity,u,1,Sheet,id%73,0,0));
            }
            Faces(start,count,luminous);
        }
        public void Sprite(V3 c,float w,float h,float angle,V3 rgb,float a,int k,float id)
        {
            if(a<.004f||w<.0001f||h<.0001f)return;
            int s=vertices.Count;var d=new V3(w,h,angle);
            for(int i=0;i<4;i++)vertices.Add(new BallVertex(c,d,rgb,a,i/2,i%2,k,id,0,k==Nucleus?3:2));
            Faces(s,2,luminous);
        }
        // Bolt endpoints stay pinned. Large kinks persist while the fine structure flickers independently.
        public void Bolt(V3 a,V3 b,float width,float err,V3 color,float alpha,int id,float t,int branches=0,V3 bend=default(V3),int steps=0)
        {
            if(alpha<.008f)return;var dir=b-a;float len=dir.Length;if(len<.002f)return;
            int n=steps>0?steps:Math.Max(5,Math.Min(42,(int)(len*16)+5));
            var ex=V3.Cross(dir,Math.Abs(dir.Unit.y)>.80f?MathFx.Forward:MathFx.Up).Unit;var ey=V3.Cross(dir.Unit,ex);
            int tick=(int)Math.Floor(t*14.7f),micro=(int)Math.Floor(t*27);float cross=MathFx.Smooth((t*14.7f-tick)*2.2f);
            for(int i=0;i<n;i++)
            {
                float u=(float)i/(n-1),w=MathFx.Pow(MathFx.Sin(u*MathFx.PI),.66f);
                int key=id+seed;float x=Mixed(u*4.7f,key+17,tick,cross)+.39f*Mixed(u*13.8f,key+105,tick,cross)+.17f*MathFx.J(key+micro*89+i*71);
                float y=Mixed(u*5.1f,key+214,tick,cross)+.36f*Mixed(u*12.7f,key-299,tick,cross)+.15f*MathFx.J(key+micro*97+i*131);
                path[i]=V3.Lerp(a,b,u)+(ex*x+ey*y)*(err*w)+bend*MathFx.Sin(MathFx.PI*u);
            }
            Line(path,n,width,color,alpha,id,.48f);
            if(branches<=0)return;
            for(int j=0;j<branches;j++)
            {
                int key=id+seed+569*j;int ix=1+(int)(MathFx.H(key+4)*(n-3));
                float u=(float)ix/(n-1);var root=path[ix];
                var tip=root+dir*(.07f+.24f*MathFx.H(key+47))+(ex*MathFx.J(key+13)+ey*MathFx.J(key+21))*len*(.15f+.18f*MathFx.H(key+99));
                int q=Math.Min(13,Math.Max(5,n/3));for(int k=0;k<q;k++)
                {
                    float v=(float)k/(q-1);scratch[k]=V3.Lerp(root,tip,v)+(ex*MathFx.J(key+k*17+micro*13)+ey*MathFx.J(key+k*37+micro*13))*MathFx.Sin(v*MathFx.PI)*err*.44f;
                }
                Line(scratch,q,width*(.32f+.17f*u),color,alpha*.69f,key,.83f);
            }
        }
        static float Mixed(float u,int k,int tick,float t){return MathFx.At(MathFx.Noise(u,k+tick*709),MathFx.Noise(u,k+(tick+1)*709),t);}
    }
}
