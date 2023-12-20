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
// const RE_OUTPUT_TAG = /\{([+-])?([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
const RE_ICI_TAG = /^\{[0-9]+\}$/;
// const RE_INPUT_COND_TAG = /\{\?(!)?([a-zA-Z_]+)\}/g;
const RE_COND_TAG = /\{([+-])([a-zA-Z_][a-zA-Z0-9_]*)\}/;
// const RE_TAG = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;

const RE_TAG_LINE = /^(\{[a-zA-Z_]+\}) (.+)$/;
const RE_BLANK_LINE = /^#?[ 　]*$/;
const KIND_USER = 1;
const KIND_BOT = 2;
const KIND_ENV = 4;
const DEFAULT_TAG_WEIGHT = 2.0;
const DEFAULT_TAILING = 0.2;

const channel = new BroadcastChannel('biomebot');

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
  condVector: null,
  outScript: [],

  handleInput: (action) => {
    const retr = retrieve(action.message.text);
    if (retr.score > part.response.minIntensity) {
      const rndr = part.render(retr.index);

      channel.postMessage({
        type: 'innerOutput',
        partName: part.partName,
        text: rndr.text,
        score: retr.score,
        avatar: rndr.avatar,
      })
    }
  },

  handleOutput: (action) => {
    if (action.partName === part.partName) {
      part.activate();
    } else {
      part.deactivate();
    }
  },

  load: async (botId, partName, validAvatars) => {
    const data = await db.loadPart(botId, partName);
    if (!data) {
      return false;
    }
    part.partName = partName;
    const payload = data.payload;
    part.response = { ...payload.response };
    part.script = [...payload.script];
    part.validAvatars = [...validAvatars];
    return true;
  },

  deploy: () => {
    // ロードされたスクリプトを解釈し
    // 返答可能な状態にする
    if (part.script.length === 0) {
      return {
        status: 'error',
        message: 'スクリプトがロードされていません'
      }
    }
    // スクリプトから類似度測定用の行列を計算
    const pp = preprocess(part.script, part.validAvatars);
    if (pp.status !== 'ok') {
      return pp;
    }

    // in,outの分割
    const t = tee(pp.script);
    if (t.status !== 'ok') {
      return t;
    }

    // inの行列生成
    const mt = matrixize(t.inScript, pp.params);
    if (mt.status !== 'ok') {
      return mt;
    }

    // outをsqueeze
    const outScript = t.outScript.flat();

    const params = pp.params;

    part.tagWeight = params.tagWeight;
    part.tagDict = params.tagDict;
    part.wordVocabLength = mt.wordVocabLength;
    part.condVocabLength = mt.condVocabLength;
    part.wordVocab = mt.wordVocab;
    part.condVocab = mt.condVocab;
    part.wordMatrix = mt.wordMatrix;
    part.condMatrix = mt.condMatrix;
    part.inDelayEffect = delayEffector(2, params.tagWeight);
    part.outScript = outScript;
    part.prevWv = zeros(1, mt.wordVocabLength); // 直前の入力
    part.prevCv = zeros(1, mt.condVocabLength); // 直前の入力
    part.condVector = ones(1, mt.condVocabLength) * -1; //初期の条件ベクトル(すべて-1)
    part.pendingCond = {};
    part.ICITags = {};
    return {
      status: 'ok'
    }
  },

  retrieve: (text) => {
    /* 
      入力文字列を受取り、スコアを返す
      wordVectorは正規化してwordMatrixとの内積。
      condVectorはそのままcondMatrixとの内積を計算してtagWeight倍する。
      両者を加えたものをscoreとする
    */
    let wv = zeros(1, part.wordVocabLength);
    let cv = zeros(1, part.condVocabLength);

    let nodes = noder.run(text);

    for (let node of nodes) {
      const feat = node.feat;
      if (feat in part.wordVocab) {
        let pos = part.wordVocab[feat];
        wv.set([0, pos], wv.get([0, pos]) + 1);
      } else if (feat in part.condVocab) {
        let pos = part.condVocab[feat];
        cv.set([0, pos], node.startswith('{?!') ? -part.tagWieght : part.tagWeight);
      }
      /*
        ICIタグが入力文字列中にあればその時のsurfaceとfeatを記憶
      */
      const m = feat.match(RE_ICI_TAG);
      if (m) {
        part.ICITags[feat] = node.surface;

      }
    }

    // wvは正規化
    const inv_wv = apply(wv, 1, x => divide(1, norm(x)));
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
      let match = feat.match(RE_COND_TAG);
      if (match) {
        part.pendingCond[`{?${match[2]}}`] = match[1] === '+' ? 1 : -1;
        newNodes[i].surface = "";
      }
    }


    // クリンナップ
    let text = newNodes.map(n => n.surface).join("");
    let feeds = text.split('\f');
    let queue = [];
    if(feeds.length> 1){
      for(let feed of feeds.slice(1)){
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
      let item = items[Math.floor(Math.random() * items.length)];

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
      queue: queue
    }
  },

  activate: () => {
    // 直前のrenderが採用された
    // retentionチェックが成功したら{?activate}を+に
    // CondVectorを更新
    
  },

  deactivate: () => {
    // 直前のrenderが不採用だった
    // ・condPendingの削除
  }
};


channel.onmessage = function (event) {
  const action = event.data;
  // const botId = action.botId;
  switch (action.type) {
    case 'input':
      part.handleInput(action);
      break;

    case 'output':
      part.handleOutput(action);
      break;

    default:
    /* nop */
  }
};