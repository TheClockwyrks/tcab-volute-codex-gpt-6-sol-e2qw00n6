"""One-time generation of Volute's committed effects and PCM sound assets."""
import json, math, os, random, struct, wave

ROOT = 'public/assets'
random.seed(41)
def particle(name, count, speed, life, direction, cone, colors, gravity=0, drag=2):
    path=f'{ROOT}/particles/{name}'
    os.makedirs(path, exist_ok=True)
    data={'dimensions':2,'field':{'width':960,'height':540},'durationMs':650,'fps':60,'loop':False,
      'emitters':[{'name':name,'shape':'point','position':[480,270,0],
        'extent':{'radius':0,'size':[0,0,0]},'emission':{'mode':'burst','count':count,'atMs':0},
        'lifetimeMs':life,'lifetimeSpread':life*.3,'speed':speed,'speedSpread':speed*.55,
        'direction':direction,'coneAngle':cone,'forces':{'gravity':gravity,'drag':drag},
        'particle':{'sizeCurve':{'interp':'linear','from':1.8,'to':0.1},
          'opacityCurve':{'interp':'linear','from':1,'to':0},
          'colorGradient':[{'at':i/(len(colors)-1),'color':c} for i,c in enumerate(colors)]}}]}
    with open(f'{path}/system.json','w') as f:json.dump(data,f,indent=2)

particle('extraction',42,105,330,[0,1,0],180,['#ffffff','#9bece1','#e5b86d'])
particle('bore',90,145,540,[0,1,0],180,['#fff9dc','#e7a969','#b54b42'],gravity=-35,drag=1)
particle('swallow',44,70,430,[0,-1,0],65,['#ec9d65','#9b6c62','#39444b'],gravity=80,drag=3)
particle('pickup',28,60,450,[0,1,0],35,['#ffffff','#ffe69a','#9bd9c7'],gravity=20,drag=2)

RATE=22050
def write(name,samples):
    path=f'{ROOT}/audio/{name}.wav';os.makedirs(os.path.dirname(path),exist_ok=True)
    peak=max(1,max(abs(v) for v in samples));scale=.82/peak
    with wave.open(path,'wb') as w:
        w.setnchannels(1);w.setsampwidth(2);w.setframerate(RATE)
        w.writeframes(struct.pack('<'+'h'*len(samples),*(int(max(-1,min(1,v*scale))*32767) for v in samples)))
def cue(name,duration,fn):
    n=int(RATE*duration);samples=[]
    for i in range(n):
        t=i/RATE;u=i/n;edge=min(1,t/.006,(duration-t)/.03)
        samples.append(fn(t,u)*max(0,edge))
    write(name,samples)
def noise():return random.uniform(-1,1)
def osc(f,t):return math.sin(2*math.pi*f*t)
cue('fire',.19,lambda t,u: (.68*noise()+.2*osc(90-60*u,t))*math.exp(-24*u))
cue('seat',.19,lambda t,u: (.45*noise()+.35*osc(170-90*u,t))*math.exp(-14*u))
cue('swap',.12,lambda t,u: (.35*noise()+.5*osc(740+260*u,t))*math.exp(-13*u))
cue('denied',.23,lambda t,u: (.6*osc(92,t)+.2*osc(95,t))*math.exp(-6*u))
cue('machinery',.43,lambda t,u: (.45*osc(390+450*u,t)+.28*osc(780+900*u,t))*math.exp(-3*u))
for k in range(1,6):
    freq=190*2**((k-1)*2/12)
    cue(f'extract-{k}',.32,lambda t,u,f=freq: (.5*osc(f,t)+.24*osc(f*2.01,t)+.16*noise())*math.exp(-5*u))
cue('intake',.72,lambda t,u: (.6*osc(54-22*u,t)+.28*noise())*math.exp(-3*u))
cue('level-clear',1.05,lambda t,u: sum(.22*osc(f,t) for f in (220,277.18,329.63,440))*math.sin(math.pi*u)**.7)
cue('cell-lost',1.1,lambda t,u: (.58*osc(72-30*u,t)+.35*noise())*math.exp(-3*u))

def music(name,tense):
    # Four bars of pulse, mineral chimes, and a continuous pump sub tone.
    bpm=96 if tense else 72; beat=60/bpm; duration=beat*16; n=int(RATE*duration)
    roots=[55,55,65.41,49] if tense else [55,65.41,49,55]
    arr=[0.0]*n
    for i in range(n):
        t=i/RATE; b=t/beat; bar=int(b//4)%4; root=roots[bar]
        phase=b%1; sub=.10*osc(root,t)+.05*osc(root*2,t)
        pump=.11*noise()*math.exp(-phase*22) if int(b)%2==0 else 0
        tick=.06*noise()*math.exp(-phase*34) if tense and phase<.18 else 0
        tone=.09*osc(root*4,t)*math.exp(-phase*5) if int(b)%4 in (0,2) else 0
        arr[i]=(sub+pump+tick+tone)*min(1,t/.025,(duration-t)/.025)
    write(name,arr)
    # The portable sequence for the authored pulse, in MIDI format 0.
    def var(n):
        out=[n&127];n>>=7
        while n:out.insert(0,(n&127)|128);n>>=7
        return bytes(out)
    events=[]; last=0
    for b in range(16):
        note=[33,33,36,31][b//4] if tense else [33,36,31,33][b//4]
        for when,status,velocity in [(b*480,0x90,75),(b*480+380,0x80,0)]:
            events.append((when,bytes([status,note,velocity])))
    body=bytearray(b'\x00\xff\x51\x03'+int(60000000/bpm).to_bytes(3,'big'))
    for tick,msg in sorted(events):body+=var(tick-last)+msg;last=tick
    body+=b'\x00\xff\x2f\x00'
    with open(f'{ROOT}/audio/{name}.mid','wb') as f:
        f.write(b'MThd'+(6).to_bytes(4,'big')+(0).to_bytes(2,'big')+(1).to_bytes(2,'big')+(480).to_bytes(2,'big'))
        f.write(b'MTrk'+len(body).to_bytes(4,'big')+body)
music('hall-loop',False);music('danger-loop',True)
