import "fake-indexeddb/auto";
import '@vitest/web-worker';
// import PartWorker from '../worker/part.worker?worker';
import { part } from '../worker/part.core';
import { expect, describe, it,not } from 'vitest';
import { db } from '../../dbio.js';
import {Message} from '../../message.js'
import {matrix,zeros,row} from 'mathjs';

const schemeData = {
  "description": "説明",
  "author": "system",
  "avatarDir": "fairy-girl",
  "backgroundColor": "#de53a1",
  "interval": {
    "max": 5000,
    "min": 1200
  },
  "response": {
    "minIntensity": 0.3
  },
  "memory": {
    "{BOT_NAME}": "ティピカ",
    "{I}": ["私"],
    "{YOU}": ["あなた"],
    "{AWAKENING_HOUR}": 7,
    "{BEDTIME_HOUR}": 21
  }
};

const validAvatars = [
  "absent", "cheer", "down", "peace", "sleep", "sleepy", "waving"
];

const partData = {
  "response": {
    "minIntensity": 0.3,
    "retention": 0.5
  },
  "script": [
    "with {?!greeting}",
    "{fruit} りんご",
    "avatar peace",
    "user お兄さんこんにちは",
    "cheer 今日は！{+greeting}",
    "peace 私も姉も元気です。{fruit}いかがですか？",
    "",
    "user こんばんは",
    "cheer こんばんは！{+greeting}"
  ]

};

let channel = new BroadcastChannel('biomebot');

describe('part core', () => {
  it('scheme data prapration', async () => {
    const d = {main:{payload:schemeData}};
    const r = await db.saveScheme('test', 'dir', d);
    expect(r).toBe(true);
  });

  it('part data preparation', async () => {
    const r = await db.savePart('test', 'testPart', partData);
    expect(r).toBe(true);
  });

  it('load', async () => {
    const r = await part.load('test', 'testPart', validAvatars);
    expect(r.status).toBe("ok");
  });

  it('deploy', () => {
    const r = part.deploy();
    expect(r.status).toBe('ok');
  });

  it('retrieve', ()=>{
    const m= new Message('user',{text:"お姉さんこんにちは"})
    const r = part.retrieve(m);
    expect(r.index).toBe(0)
  });

  it('render', ()=>{
    const r = part.render(0);
    console.log(r)
    expect(r.length).not.toBe(0)
  });

  it('activate', ()=>{
    const r = part.activate();
    expect(r).toBe(true);
  });

  it('saveConditionVector', async ()=>{
    const cv = zeros(1,10);
    cv.set([0,3],-1);
    console.log("row",cv.toArray()[0])
    const r = await db.saveConditionVector("test","testPart",cv);
    expect(r).toBe(true);
  });

  it('loadConditionVector', async ()=>{
    const r = await db.loadConditionVector("test","testPart");
    const a = r.toArray()[0];
    console.log(a)
    expect(a[3]).toBe(-1);
  })

  // let worker = new PartWorker();
  // worker.postMessage({ type: 'deploy', partName: 'test' });
  // worker.onmessage = e => {
  //   console.log(e.data)
  // }
});

