from html.parser import HTMLParser
from pathlib import Path
import json, re, difflib
OUT=Path('/tmp/paper-digest-20261023/sources')
class Node:
 def __init__(self,tag='root',attrs=[]): self.tag=tag; self.attrs=dict(attrs); self.parts=[]
 def text(self): return ' '.join(''.join(p if isinstance(p,str) else p.text() for p in self.parts).split())
 def walk(self):
  yield self
  for p in self.parts:
   if isinstance(p,Node): yield from p.walk()
class Parse(HTMLParser):
 def __init__(self): super().__init__(); self.root=Node(); self.stack=[self.root]
 def handle_starttag(self,t,a):
  n=Node(t,a); self.stack[-1].parts.append(n)
  if t not in ['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']: self.stack.append(n)
 def handle_endtag(self,t):
  for i in range(len(self.stack)-1,0,-1):
   if self.stack[i].tag==t: self.stack=self.stack[:i]; break
 def handle_data(self,d): self.stack[-1].parts.append(d)
def extract(path):
 p=Parse(); p.feed(path.read_text()); ns=list(p.root.walk()); article=next((n for n in ns if n.tag=='article'),p.root); ns=list(article.walk())
 groups={}
 for kind,pred in {
  'paragraphs':lambda n:n.tag=='p' and 'ltx_p' in n.attrs.get('class',''),
  'tables':lambda n:n.tag=='table' and 'ltx_tabular' in n.attrs.get('class',''),
  'equations':lambda n:n.attrs.get('id') and re.search(r'\.E\d+$',n.attrs.get('id','')),
  'figures':lambda n:n.tag=='figure',
  'sections':lambda n:n.tag=='section' and n.attrs.get('id'),
 }.items(): groups[kind]=[{'id':n.attrs.get('id'),'text':n.text()} for n in ns if pred(n)]
 return groups
summaries={}
for name,a,b in [('dawam','v2','v3'),('comfortably','v1','v2')]:
 x=extract(OUT/f'{name}-{a}.html'); y=extract(OUT/f'{name}-{b}.html')
 (OUT/f'{name}-{a}-parsed.json').write_text(json.dumps(x,indent=2,ensure_ascii=False));(OUT/f'{name}-{b}-parsed.json').write_text(json.dumps(y,indent=2,ensure_ascii=False))
 summary={}
 for k in x:
  old=[v['text'] for v in x[k]]; new=[v['text'] for v in y[k]]
  summary[k]={'oldCount':len(old),'newCount':len(new),'textIdentical':old==new}
  if k in ('tables','equations','figures','sections'):
   d1={v['id']:v['text'] for v in x[k]}; d2={v['id']:v['text'] for v in y[k]}
   summary[k]['changedIds']=[i for i in sorted(set(d1)|set(d2),key=lambda z:z or '') if d1.get(i)!=d2.get(i)]
  diff='\n'.join(difflib.unified_diff(old,new,fromfile=f'{name}-{a}-{k}',tofile=f'{name}-{b}-{k}',lineterm=''))
  (OUT/f'{name}-{k}-diff.txt').write_text(diff)
 summaries[name]=summary
(OUT/'version-comparison.json').write_text(json.dumps(summaries,indent=2,ensure_ascii=False))
print(json.dumps(summaries,indent=2))
