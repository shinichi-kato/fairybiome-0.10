import { compareNatural, matrix } from 'mathjs';
import { describe, expect, it } from 'vitest'
import { matrixize, tee, preprocess, delayEffector, expand } from '../worker/matrix.js';

describe("matrix", () => {
  const tagDict={'{favorite}':['{fruit}が好き'], '{fruit}':['バナナ']};
  const script = [
    'with {?!favorite}',
    'avatar peace',
    '{fruit} りんご\tブドウ',
    'user 好きなものは？',
    'condWeight 2.2',
    'bot {fruit}!',
    '',
    'env {?onStart}',
    'bot こんにちは',
    'bot 連続行はまとめられます',
    'user そうなんですか？',
    'user user行は？',
    'bot user行は分割されます'
  ];
  // const script= [
  //   "with {!greeting}",
  //   "avatar peace",
  //   "user こんにちは",
  //   "cheer 今日は！{+greeting}",
  //   "",
  //   "user こんばんは",
  //   "cheer こんばんは！{+greeting}"
  // ];

  const validAvatars=['peace','cheer'];
  let ppScript, teeScript, matrixized;

  it("preprocess", ()=>{
    ppScript = preprocess(script, validAvatars);
    expect(ppScript.status).toBe('ok');
  });

  it("tee", ()=>{
    teeScript = tee(ppScript.script);
    expect(teeScript.status).toBe('ok');
  });

  it("matrixize", ()=>{
    matrixized = matrixize(teeScript.inScript,ppScript.params);
    console.log(matrixized)
    expect(matrixized.status).toBe('ok');
  });

  


  it("expand", ()=>{
    const r = expand('{favorite}',tagDict);
    
    expect(r).toBe('バナナが好き');
  });

  it(`delayEffector`, () => {
    const e = delayEffector(5, 0.3);
    const r = matrix([
      [1, 0, 0, 0, 0],
      [0.3, 1, 0, 0, 0],
      [0, 0.3, 1, 0, 0],
      [0, 0, 0.3, 1, 0],
      [0, 0, 0, 0.3, 1],
    ])

    expect(compareNatural(e,r)).toBe(0);
  });
})