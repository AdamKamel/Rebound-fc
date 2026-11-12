#!/usr/bin/env python3
"""Builds public/index.html (website) and dist/rebound-fc-preview.html (Claude preview) from src/."""
import os,re
here=os.path.dirname(os.path.abspath(__file__))
src=lambda n:open(os.path.join(here,'src',n),encoding='utf-8').read()
html=src('shell.html').replace('{{SIM}}',src('sim.js')).replace('{{POSE}}',src('pose.js')).replace('{{APP}}',src('app.js'))
os.makedirs(os.path.join(here,'public'),exist_ok=True)
open(os.path.join(here,'public','index.html'),'w',encoding='utf-8').write(html)
# preview: no document wrapper or links to files that only exist on the website
p=html.replace('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n','')
p=re.sub(r'<meta name="viewport"[^>]*>\n','',p)
p=re.sub(r'<link rel="(icon|apple-touch-icon|manifest)"[^>]*>\n','',p)
p=p.replace('</style>\n</head>\n<body>\n','</style>\n').replace('</script>\n</body>\n</html>\n','</script>\n')
os.makedirs(os.path.join(here,'dist'),exist_ok=True)
open(os.path.join(here,'dist','rebound-fc-preview.html'),'w',encoding='utf-8').write(p)
print('built',len(html),'bytes')
