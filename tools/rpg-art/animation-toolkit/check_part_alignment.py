"""Optional SIFT/RANSAC verification of an already cut-out part against its source."""
import argparse,json
from pathlib import Path
import cv2,numpy as np
p=argparse.ArgumentParser();p.add_argument('--part',type=Path,required=True);p.add_argument('--reference',type=Path,required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args();part=cv2.imread(str(a.part),cv2.IMREAD_UNCHANGED);ref=cv2.imread(str(a.reference),cv2.IMREAD_COLOR);sift=cv2.SIFT_create(nfeatures=2000,contrastThreshold=.01)
k1,d1=sift.detectAndCompute(cv2.cvtColor(part[:,:,:3],cv2.COLOR_BGR2GRAY),part[:,:,3]if part.shape[2]==4 else None);k2,d2=sift.detectAndCompute(cv2.cvtColor(ref,cv2.COLOR_BGR2GRAY),None);good=[]
if d1 is not None and d2 is not None:
 for candidates in cv2.BFMatcher().knnMatch(d1,d2,k=2):
  if len(candidates)==2 and candidates[0].distance<.7*candidates[1].distance:good.append(candidates[0])
mat=None;inliers=0
if len(good)>=6:
 src=np.float32([k1[m.queryIdx].pt for m in good]);dst=np.float32([k2[m.trainIdx].pt for m in good]);mat,mask=cv2.estimateAffinePartial2D(src,dst,method=cv2.RANSAC,ransacReprojThreshold=2);inliers=int(mask.sum())if mask is not None else 0
r={'status':'VERIFIED'if mat is not None and inliers>=5 else 'INSUFFICIENT_MATCHES_KEEP_MANUAL_GEOMETRY','matches':len(good),'inliers':inliers,'affine':mat.tolist()if mat is not None else None,'autoApplied':False};a.out.write_text(json.dumps(r,indent=2));print(r)
