"""Confidence-gated RTMPose extraction from explicitly cropped sprite rows.
No inferred joint is accepted without confidence; raw predictions remain for review.
"""
import argparse,json,math,os
from pathlib import Path
os.environ.setdefault('OMP_NUM_THREADS','2')
import cv2,numpy as np
from rtmlib import RTMPose
p=argparse.ArgumentParser();p.add_argument('--sheets',type=Path,required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--model',default='https://download.openmmlab.com/mmpose/v1/projects/rtmposev1/onnx_sdk/rtmpose-t_simcc-body7_pt-body7_420e-256x192-026a1439_20230504.zip');p.add_argument('--min-score',type=float,default=.45);p.add_argument('--limit',type=int,default=24);a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
pose=RTMPose(onnx_model=a.model,model_input_size=(192,256),backend='onnxruntime',device='cpu')
names=['nose','left_eye','right_eye','left_ear','right_ear','left_shoulder','right_shoulder','left_elbow','right_elbow','left_wrist','right_wrist','left_hip','right_hip','left_knee','right_knee','left_ankle','right_ankle'];links=[(5,7),(7,9),(6,8),(8,10),(11,13),(13,15),(12,14),(14,16),(5,6),(5,11),(6,12),(11,12)]
frames=[];tiles=[]
for sheet in json.loads(a.sheets.read_text()):
 image=cv2.imread(sheet['path']);h,w=image.shape[:2]
 for row in sheet['rows']:
  top,bottom,cols=row
  for column in range(cols):
   if len(frames)>=a.limit:break
   x0=round(column*w/cols);x1=round((column+1)*w/cols);crop=image[top:bottom,x0:x1];ch,cw=crop.shape[:2];scale=min(180/cw,228/ch);rw,rh=round(cw*scale),round(ch*scale);canvas=np.full((256,192,3),255,np.uint8);ox=(192-rw)//2;oy=(256-rh)//2;canvas[oy:oy+rh,ox:ox+rw]=cv2.resize(crop,(rw,rh),interpolation=cv2.INTER_NEAREST)
   kpts,scores=pose(canvas);kp=kpts[0];score=scores[0];angles={}
   for side in ['left','right']:
    for part,ja,jb in [('upper_arm','shoulder','elbow'),('forearm','elbow','wrist'),('thigh','hip','knee'),('shin','knee','ankle')]:
     i,j=names.index(side+'_'+ja),names.index(side+'_'+jb);valid=min(float(score[i]),float(score[j]))>=a.min_score
     angles[side+'_'+part]={'accepted':valid,'degrees':float(math.degrees(math.atan2(-(kp[j,1]-kp[i,1]),kp[j,0]-kp[i,0]))) if valid else None,'confidence':float(min(score[i],score[j]))}
   item={'sheet':sheet['name'],'row':[top,bottom,cols],'column':column,'crop':[x0,top,x1,bottom],'keypoints':{name:{'x':float(kp[i,0]),'y':float(kp[i,1]),'score':float(score[i])}for i,name in enumerate(names)},'angles':angles,'meanCoreConfidence':float(np.mean(score[[5,6,7,8,9,10,11,12]]))};frames.append(item)
   for i,j in links:
    if min(score[i],score[j])>=a.min_score:cv2.line(canvas,tuple(kp[i].astype(int)),tuple(kp[j].astype(int)),(40,180,30),2)
   cv2.putText(canvas,str(len(frames)-1)+' '+str(round(item['meanCoreConfidence'],2)),(4,18),cv2.FONT_HERSHEY_SIMPLEX,.45,(30,30,220),1);tiles.append(canvas);print('POSE_FRAME',len(frames),round(item['meanCoreConfidence'],3),flush=True)
  if len(frames)>=a.limit:break
 if len(frames)>=a.limit:break
out={'status':'MODEL_INFERENCE_COMPLETED_REVIEW_REQUIRED','model':a.model,'modelFamily':'RTMPose body7; explicit pre-cropped bbox, detector not needed','threshold':a.min_score,'unreliableCoordinatesNeverAutoApplied':True,'frames':frames}
(a.out/'reference-poses.json').write_text(json.dumps(out,indent=2));cols=8;grid=np.full((256*((len(tiles)+cols-1)//cols),192*cols,3),230,np.uint8)
for i,tile in enumerate(tiles):grid[i//cols*256:(i//cols+1)*256,i%cols*192:(i%cols+1)*192]=tile
cv2.imwrite(str(a.out/'pose-confidence-review.jpg'),grid);print('POSE_REVIEW_WRITTEN',a.out)
