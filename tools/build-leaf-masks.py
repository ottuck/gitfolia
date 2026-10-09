"""Analyse pigment silhouettes; save geometry labels, never alter the source artwork."""
import sys,json,pathlib,gzip

import numpy as np
from PIL import Image,ImageDraw
from scipy import ndimage as ndi
from skimage.segmentation import watershed
from skimage.feature import peak_local_max
root=pathlib.Path(__file__).resolve().parents[1]/'artwork'
for name,separation,threshold in [('ginkgo-complete-v2',30,6),('fern-complete-v2',8,2.5)]:
 rgb=np.array(Image.open(root/(name+'.png')).convert('RGB')).astype(float)
 h,w=rgb.shape[:2];r,g,b=rgb[:,:,0],rgb[:,:,1],rgb[:,:,2]
 mask=((g-r>-7)&(g-b>20))|((r>140)&(r-g<55)&(r-b>50)&(g-b>25))|((g-r>0)&(g-b>10)&(g<150))
 mask[int(h*.84):]=False
 # Keep trunk, petioles and primary stems in the permanent drawing layer.
 exclude=Image.new('1',(w,h));draw=ImageDraw.Draw(exclude)
 if name.startswith('ginkgo'):
  draw.polygon([(492,1450),(450,1350),(425,1260),(460,1195),(526,1118),(530,1060),(484,1018),(462,945),(448,860),(423,778),(381,698),(372,613),(389,514),(386,406),(408,364),(418,410),(414,530),(410,610),(414,692),(444,769),(464,860),(484,950),(499,1000),(556,1047),(580,1101),(555,1160),(491,1226),(485,1288),(525,1360),(555,1450)],fill=1)
 else:
  for points in [[(496,1255),(473,1040),(459,895),(389,742),(327,635),(260,525),(186,376),(118,248)],[(502,1260),(520,1110),(560,940),(600,740),(625,607),(602,470),(561,362),(524,262),(489,174),(507,78)],[(519,1255),(621,1119),(720,948),(801,805),(867,710),(919,616)]]:
   draw.line(points,fill=1,width=8)
 mask&=~np.array(exclude,dtype=bool)
 # Close pinholes within pigment; keep paper gaps between distinct leaf shapes.
 mask=ndi.binary_closing(mask,structure=np.ones((3,3)))
 cc,n=ndi.label(mask);sizes=np.bincount(cc.ravel());mask&=sizes[cc]>=18
 distance=ndi.distance_transform_edt(mask)
 peaks=peak_local_max(distance,min_distance=separation,threshold_abs=threshold,exclude_border=False)
 markers=np.zeros((h,w),np.int32)
 for k,(y,x) in enumerate(peaks,1):markers[y,x]=k
 # Tiny separate buds without a large core still receive their own paint region.
 cc,n=ndi.label(mask);next_id=len(peaks)+1
 for k in range(1,n+1):
  coords=np.argwhere(cc==k)
  if coords.size and not np.any(markers[cc==k]):
   y,x=coords[np.argmax(distance[cc==k])];markers[y,x]=next_id;next_id+=1
 labels=watershed(-distance,markers,mask=mask,compactness=0)
 ids=np.unique(labels);ids=ids[ids>0];regions=[]
 # Remap compactly; geometry id is independent of the later growth order.
 compact=np.zeros_like(labels,dtype=np.uint16)
 for i,k in enumerate(ids,1):
  ys,xs=np.where(labels==k);compact[ys,xs]=i
  regions.append({'id':i,'cx':round(float(xs.mean()),2),'cy':round(float(ys.mean()),2),'pixels':len(xs),'bbox':[int(xs.min()),int(ys.min()),int(xs.max()),int(ys.max())]})
 compact.astype('<u2').tofile(root/(name+'.mask'))
 meta={'schema':2,'width':w,'height':h,'source':name+'.png','regions':regions,'coloredPixels':int(mask.sum()),'segmentation':'pigment silhouette + distance watershed; some touching leaves can share/split regions'}
 (root/(name+'.json')).write_text(json.dumps(meta,ensure_ascii=False),encoding='utf8')
 (root/(name+'.mask.gz')).write_bytes(gzip.compress((root/(name+'.mask')).read_bytes(),mtime=0))
 print(name,json.dumps({'regions':len(regions),'pixels':int(mask.sum()),'large':sum(a['pixels']>10000 for a in regions),'tiny':sum(a['pixels']<100 for a in regions)}))

