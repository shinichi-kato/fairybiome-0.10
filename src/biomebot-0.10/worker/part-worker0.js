/*
part worker
==================================

*/

import { db } from '../../dbio.js';
import {
  zeros, ones, divide, apply, concat, dot, row, add,
  diag, multiply, norm, randomInt, max, clone,
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
// const RE_OUTPUT_TAG = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
// const RE_TAG = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;

const RE_TAG_LINE = /^(\{[a-zA-Z_]+\}) (.+)$/;
const RE_BLANK_LINE = /^#?[ 　]*$/;
const KIND_USER = 1;
const KIND_BOT = 2;
const KIND_ENV = 4;
const DEFAULT_TAG_WEIGHT = 2.0;
const DEFAULT_TAILING = 0.2;

export class Part {
  constructor() {
    this.partName = null;
    this.channel = new BroadcastChannel('biomebot');

    // .jsonの保持
    this.response = {
      minIntensity: 0,  // scoreがこの値以上なら発言する
      retention: 0.4,   // このパートの発言が採用された場合、retentionの確率で
      // 次回のminIntensityが無視される
    }
    this.script = [];

    this.vocab = null;
    this.validAvatars = [];
    this.condVector = null;

    this.channel.onmessage = function (event) {
      const action = event.data;
      // const botId = action.botId;
      switch (action.type) {
        case 'input':
          this.handleInput(action);
          break;

        case 'output':
          this.handleOutput(action);
          break;

        default:
        /* nop */
      }
    }

    console.error("part Constructed")
  }

  handleInput(action) {
    const retr = this.retrieve(action.message.text);
    if (retr.score > this.response.minIntensity) {
      const rndr = this.render(retr.index);

      this.channel.postMessage({
        type: 'innerOutput',
        partName: this.partName,
        text: rndr.text,
        score: retr.score,
        avatar: rndr.avatar,
      })
    }
  }

  handleOutput(action) {
    if (action.partName === this.partName) {
      this.activate();
    } else {
      this.deactivate();
    }
  }

  async load(botId, partName, validAvatars) {
    if (!await db.partExists(botId, partName)) {
      return false;
    }
    const data = await db.loadPart(botId, partName);
    this.partName = partName;
    this.response = { ...data.response };
    this.script = [...data.script];
    this.validAvatars = [...validAvatars];
    return true;
  }

  deploy() {
    // ロードされたスクリプトを解釈し
    // 返答可能な状態にする
    if (this.script.length === 0) {
      return {
        status: 'error',
        message: 'スクリプトがロードされていません'
      }
    }
    // スクリプトから類似度測定用の行列を計算
    const pp = preprocess(this.script, this.validAvatars);
    if (pp.status === 'error') {
      return pp;
    }

    // in,outの分割
    const [inScript, outScript] = tee(pp.script);

    // inの行列生成
    const mt = matrixize(inScript, pp.params);
    if (mt.status === 'error') {
      return mt;
    }

    this.condWeight = pp.condWeight;
    this.tagDict = pp.tagDict;
    this.wordVocabLength = mt.wordVocabLength;
    this.condVocabLength = mt.condVocabLength;
    this.wordVocab = mt.wordVocab;
    this.condVocab = mt.condVocab;
    this.wordMatrix = mt.wordMatrix;
    this.condMatrix = mt.condMatrix;
    this.inDelayEffect = delayEffector(2, pp.condWeight);
    this.outScript = outScript;
    this.prevWv = zeros(1, this.wordVocabLength); // 直前の入力
    this.prevCv = zeros(1, this.condVocabLength); // 直前の入力
    this.condVector = ones(1, this.condVoacabLength) * -1; //初期の条件ベクトル(すべて-1)
    this.pendingCond = {};
    this.ICITags = {};
    return {
      status: 'ok'
    }
  }

  retrieve(text) {
    /* 
      入力文字列を受取り、スコアを返す
      wordVectorは正規化してwordMatrixとの内積。
      condVectorはそのままcondMatrixとの内積を計算してcondWeight倍する。
      両者を加えたものをscoreとする
    */
    let wv = zeros(1, this.wordVocabLength);
    let cv = zeros(1, this.condVocabLength);

    let nodes = noder.run(text);

    for (let node of nodes) {
      const feat = node.feat;
      if (feat in this.wordVocab) {
        let pos = this.wordVocab[feat];
        wv.set([0, pos], wv.get([0, pos]) + 1);
      } else if (feat in this.condVocab) {
        let pos = this.condVocab[feat];
        cv.set([0, pos], node.startswith('{?!') ? -1 : 1);
      } else {
        /*
          ICIタグが入力文字列中にあればその時のsurfとfeatを記憶
        */
        const m = feat.match(RE_ICI_TAG);
        if (m) {
          this.ICITags[feat] = surf;

        }
      }
    }

    // wvは正規化
    const inv_wv = apply(wv, 1, x => divide(1, norm(x)));
    wv = multiply(diag(inv_wv), wv);


    // 直前の入力内容の影響をtailingに応じて受けたwvを得る
    let wvd = concat(this.prevWv, wv, 1);
    wvd = multiply(this.inDelayEffect, wvd);
    wvd = row(wvd, 2);

    // 類似度計算
    const wvdot = apply(this.wordMatrix, 1, x => dot(x, wvd));
    const cvdot = apply(this.condMatrix, 1, x => dot(x, cv)) * this.condWeight;
    const scores = add(wvdot, cvdot).valueOf();
    const maxScore = Math.max(...scores);
    const cands = [];
    let i, l;
    for (i = 0, l = scores.length; i < l; i++) {
      if (scores[i] === max) {
        cands.push(i)
      }
    }

    this.prevCv = clone(cv);
    this.prevWv = clone(wv);

    return {
      score: maxScore,
      index: cands[randomInt(cands.length)]
    }
  }

  render(index) {
    // 返答文字列の生成
    // ICIタグはthis.ICITagsに記憶されているものがあればそれを優先する。
    // 条件タグは値を保持した上で空文字列に置き換える。
    // 展開タグは展開する。

    let cands = this.outScript[index];
    cands = cands.match(RE_OUTSCRIPT);
    const avatar = cands[0];
    cands = cands[1].split('\t');
    let nodes = noder.run(cands[randomInt(cands.length)]);
    let newNodes = [];

    // 展開タグの展開

    for (let node of nodes) {
      const feat = node.feat;
      if (RE_OUTPUT_TAG.test(feat)) {
        newNodes.push(...expand(node))
      } else {
        newNodes.push(node);
      }

    }

    for (let i = 0, l = newNodes.length; i < l; i++) {
      const feat = newNodes[i].feat;

      // ICIタグのレンダリング
      // this.ICITagsにあるものを優先
      if (RE_ICI_TAG.test(feat)) {
        if (feat in this.ICITags) {
          newNodes[i] = Node(ICITags[feat], "*")
        }
      }

      // 条件タグの保持
      // {+tag} {-tag}は記憶しておき、戻り値は空文字
      let match = feat.match(RE_COND_TAG);
      if (match) {
        this.pendingCond[`{?${match[2]}}`] = match[1] === '+' ? 1 : -1;
        newNodes[i] = Node("", "*");
      }
    }

    // クリンナップ
    text = newNodes.map(n => n.surf).join("");

    // 再帰的な展開タグの展開
    function expand(tag) {

      const tagFeat = tag.feat;
      if (!(tagFeat in this.tagDict)) return [tag];

      const items = this.tagDict[tagFeat];
      let item = items[Math.floor(Math.random() * items.length)];

      let nodes = noder.run(item);
      let newNodes = [];
      for (let node of nodes) {
        const feat = node.feat;
        if (RE_OUTPUT_TAG.test(feat)) {
          newNodes.push(...expand(node));
        } else {
          newNodes.push(node);
        }
      }
      return newNodes;
    }

    return {
      avatar: avatar,
      text: text
    }
  }

  activate() {
    // 直前のrenderが採用された
    // retentionチェックが成功したら{?activate}を+に
    // ・CondVectorを更新
  }

  deactivate() {
    // 直前のrenderが不採用だった
    // ・condPendingの削除
  }

}


const part = new Part();

self.onmessage = function (event) {
  console.log("part onmessage",event)
  const action = event.data;
  const botId = action.botId;
  switch (action.type) {
    case 'deploy': {
      (async () => {
        let result = await part.load(botId, action.partName);
        if (result) {
          self.postMessage({ type: 'partLoaded', result: result });
          result = part.deploy();
          self.postMessage({ type: 'partDeployed',result: result });
        } else {
          self.postMessage({ type: 'partNotFound' });
        }
      })();
      break;
    }

    default:
      throw new Error(`part: invalid action ${action.type}`);
  }
}
