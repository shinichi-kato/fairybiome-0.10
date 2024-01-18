/*
part worker
==================================

*/

import { db } from '../../dbio.js';
import {
  zeros, ones, divide, apply, concat, dot, row, add,
  diag, multiply, norm, randomInt, max, clone, squeeze,
  identity, index, range, subset, size
} from "mathjs";
import { noder } from './noder';
import { matrixize, tee, preprocess, delayEffector, expand } from './matrix.js';

const RE_OUTSCRIPT = /^([^ ]+) (.+)$/;
const RE_EXPAND_TAG = /^\{([a-zA-Z_][a-zA-Z0-9_]*)\}/;
const RE_ICI_TAG = /^\{[0-9]+\}$/;
const RE_OUT_COND_TAG = /\{([+-])([a-zA-Z_][a-zA-Z0-9_]*)\}/;
const RE_IN_COND_TAG = /^\{(\?!?)([a-zA-Z_][a-zA-Z0-9_]*)\}$/;

const RE_TAG_LINE = /^(\{[a-zA-Z_]+\}) (.+)$/;
const RE_BLANK_LINE = /^#?[ 　]*$/;
const KIND_USER = 1;
const KIND_BOT = 2;
const KIND_ENV = 4;
const DEFAULT_TAG_WEIGHT = 2.0;
const DEFAULT_TAILING = 0.2;

export const part = {
  partName: null,

  // .jsonの保持
  response: {
    minIntensity: 0,  // scoreがこの値以上なら発言する
    retention: 0.4,   // このパートの発言が採用された場合、retentionの確率で
    // 次回のminIntensityが無視される
  },
  script: [],
  vocab: null,
  validAvatars: [],
  condVocab: null,
  wordVocab: null,
  pendingCond: {},
  outScript: [],
  channel: new BroadcastChannel('biomebot'),
  
  handleInput: (action) => {
    const retr = part.retrieve(action.message);
    console.log("part input ", retr)
    if (retr.score > part.response.minIntensity) {
      const rndr = part.render(retr.index);

      part.channel.postMessage({
        type: 'innerOutput',
        partName: part.partName,
        text: rndr.text,
        score: retr.score,
        avatar: rndr.avatar,
        pendingCond: part.pendingCond
      })
    }
  },

  handleOutput: (action) => {
    if (action.partName === part.partName) {
      part.activate();
    } else {
      part.inertial();
    }
  },

  load: async (botId, partName, validAvatars) => {
    const data = await db.loadPart(botId, partName);
    if (!data) {
      return {
        status: 'error',
        messages: [`${partName}がロードできませんでした`]
      }
    }
    part.partName = partName;
    part.script = [...data.script];
    part.validAvatars = [...validAvatars];

    part.channel.onmessage = event => {
      const action = event.data;
      switch (action.type) {
        case 'input':
          part.handleInput(action);
          break;

        case 'output': {
          part.handleOutput(action);
          break;
        }

        case 'close': {
          console.log("closing biomebot");
          part.channel.close();
          break;
        }

        default:
        /* nop */
      }
    }

    return { status: 'ok' };
  },

  deploy: () => {
    // ロードされたスクリプトを解釈し
    // 返答可能な状態にする
    if (part.script.length === 0) {
      return {
        status: 'error',
        messages: ['スクリプトがロードされていません']
      }
    }
    // スクリプトから類似度測定用の行列を計算
    const pp = preprocess(part.script, part.validAvatars);
    if (pp.status !== 'ok') {
      return { partName: part.partName, ...pp };
    }

    // in,outの分割
    const t = tee(pp.script);
    if (t.status !== 'ok') {
      return { partName: part.partName, ...t };
    }

    // inの行列生成
    const mt = matrixize(t.inScript, pp.params);
    if (mt.status !== 'ok') {
      return { partName: part.partName, ...mt };
    }

    // outをsqueeze
    const outScript = t.outScript.flat();

    const params = pp.params;

    part.condWeight = params.condWeight;
    part.tagDict = params.tagDict;
    part.response = {
      minIntensity: params.minIntensity,
      retention: params.retention,
    },
    part.wordVocabLength = mt.wordVocabLength;
    part.condVocabLength = mt.condVocabLength;
    part.wordVocab = {...mt.wordVocab};
    part.condVocab = {...mt.condVocab};
    part.wordMatrix = mt.wordMatrix;
    part.condMatrix = mt.condMatrix;
    part.inDelayEffect = delayEffector(2, params.condWeight);
    part.outScript = outScript;
    part.prevWv = zeros(1, mt.wordVocabLength); // 直前の入力
    part.prevCv = zeros(1, mt.condVocabLength); // 直前の入力
    part.condVector = multiply(ones(1, mt.condVocabLength), -1); //初期の条件ベクトル(すべて-1)
    part.pendingCond = {};
    part.ICITags = {};


    part.channel.postMessage({type:"test",partName:part.partName})

    return {
      partName: part.partName,
      status: 'ok'
    }
  },

  retrieve: (message) => {
    /* 
      Message型の入力を受取り、スコアを返す
      wordVectorは正規化してwordMatrixとの内積。
      condVectorはそのままcondMatrixとの内積を計算してcondWeight倍する。
      両者を加えたものをscoreとする
    */
    let text = message.text;
    let tagDict = message.tagDict;
    let wv = zeros(1, part.wordVocabLength);
    let cv = zeros(1, part.condVocabLength);
    // messageにcondTagsが含まれていたらそれを考慮に入れる
    for (let tag in tagDict) {
      if(tag in part.condVocab){
        const pos = part.condVocab[tag];
        cv.set([0, pos], tagDict[tag] * part.condWeight);
      }
    }


    let nodes = noder.run(text);

    for (let node of nodes) {
      const feat = node.feat;
      if (feat in part.wordVocab) {
        let pos = part.wordVocab[feat];
        wv.set([0, pos], wv.get([0, pos]) + 1);
      } else {
        const m = feat.match(RE_IN_COND_TAG);
        if (m) {
          let pos = part.condVocab[m[2]];
          cv.set([0, pos], m[1] === '?' ? part.condWeight : -part.condWeight);
        }
      }
      /*
        ICIタグが入力文字列中にあればその時のsurfaceとfeatを記憶
      */
      let m = feat.match(RE_ICI_TAG);
      if (m) {
        part.ICITags[feat] = node.surface;

      }
    }

    // wvは正規化
    // norm(x)が0の場合はzerosで何もしない
    const inv_wv = apply(wv, 1, x => divide(1, norm(x)||1));
    wv = multiply(diag(inv_wv), wv);

    // 直前の入力内容の影響をtailingに応じて受けたwvを得る
    let wvd = concat(part.prevWv, wv, 0);
    wvd = multiply(part.inDelayEffect, wvd);
    wvd = squeeze(row(wvd, 1));
    cv = squeeze(cv)

    // 類似度計算
    const wvdot = apply(part.wordMatrix, 1, x => dot(squeeze(x), wvd));
    const cvdot = apply(part.condMatrix, 1, x => dot(squeeze(x), cv));
    const scores = add(wvdot, cvdot).valueOf();
    
    const maxScore = Math.max(...scores);
    const cands = [];
    let i, l;
    for (i = 0, l = scores.length; i < l; i++) {
      if (scores[i] === maxScore) {
        cands.push(i)
      }
    }

    // 直前の状態を記憶。
    // condのうち永続化するものはdbに記憶する予定(未実装)
    part.prevCv = clone(cv);
    part.prevWv = clone(wv);

    return {
      score: maxScore,
      index: cands[randomInt(cands.length)]
    }
  },

  render: (index) => {
    // 返答文字列の生成
    // ICIタグはpart.ICITagsに記憶されているものがあればそれを優先する。
    // 条件タグは値を保持した上で空文字列に置き換える。
    // 展開タグは展開する。

    let cands = part.outScript[index];
    cands = cands.match(RE_OUTSCRIPT);
    const avatar = cands[1];
    let nodes = noder.run(cands[2]);
    let newNodes = [];

    // 展開タグの展開

    for (let node of nodes) {
      const feat = node.feat;
      if (RE_EXPAND_TAG.test(feat)) {
        newNodes.push(...expand(node))
      } else {
        newNodes.push(node);
      }

    }

    for (let i = 0, l = newNodes.length; i < l; i++) {
      const feat = newNodes[i].feat;

      // ICIタグのレンダリング
      // part.ICITagsにあるものを優先
      if (RE_ICI_TAG.test(feat)) {
        if (feat in part.ICITags) {
          newNodes[i].surface = part.ICITags[feat];
        }
      }

      // 条件タグの保持
      // {+tag} {-tag}は記憶しておき、戻り値は空文字
      let m = feat.match(RE_OUT_COND_TAG);
      if (m) {
        part.pendingCond[m[2]] = m[1] === '+' ? 1 : -1;
        newNodes[i].surface = "";
      }
    }


    // クリンナップ
    let text = newNodes.map(n => n.surface).join("");
    let feeds = text.split('\f');
    let queue = [];
    if (feeds.length > 1) {
      for (let feed of feeds.slice(1)) {
        feed = feed.match(RE_OUTSCRIPT)
        queue.push({
          avatar: feed[1],
          text: feed[2]
        })
      }
    }

    // 再帰的な展開タグの展開
    function expand(tag) {

      const tagFeat = tag.feat;
      if (!(tagFeat in part.tagDict)) return [tag];

      const items = part.tagDict[tagFeat];
      let item = items[randomInt(items.length)];

      let nodes = noder.run(item);
      let newNodes = [];
      for (let node of nodes) {
        const feat = node.feat;
        if (RE_EXPAND_TAG.test(feat)) {
          newNodes.push(...expand(node));
        } else {
          newNodes.push(node);
        }
      }
      return newNodes;
    }

    return {
      avatar: avatar,
      text: text,
      queue: queue,
    }
  },

  activate: () => {
    // 直前のrenderが採用された
    // retentionチェックが成功したら{?ACTIVATED}を+に
    // CondVectorを更新

    let pos = part.condVocab['ACTIVATED'];
    console.log(part.condVector)
    part.condVector.set([0, pos], part.condWeight);

    for (let key in part.pendingCond) {
      pos = part.condVocab[key];
      part.condVector.set([0, pos], part.condWeight * part.pendingCond[key]);
    }
    part.pendingCond = {};
    return true;
  },

  inertial: () => {
    // 直前のrenderが不採用だった
    // ・condPendingの削除
    if (part.retention > Math.random()) {
      let pos = part.condVocab['ACTIVATED'];
      part.condVector.set([0, pos], -part.condWeight);
    }
    part.pendingCond = {};
  }
};