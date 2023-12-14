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
// import { matrixize, tee, preprocess, delayEffector, expand } from './matrix.js';

const RE_OUTSCRIPT = /^([^ ]+) (.+)$/;
const RE_INPUT_COND_TAG = /\{\?(!)?([a-zA-Z_]+)\}/g;
const RE_OUTPUT_COND_TAG = /\{([+-])([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
const RE_OUTPUT_TAG = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
const RE_TAG = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;

const RE_TAG_LINE = /^(\{[a-zA-Z_]+\}) (.+)$/;
const RE_BLANK_LINE = /^#?[ 　]*$/;
const KIND_USER = 1;
const KIND_BOT = 2;
const KIND_ENV = 4;
const DEFAULT_TAG_WEIGHT = 2.0;
const DEFAULT_TAILING = 0.2;

class Part {
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
        case 'input': {
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
          break;
        }
        case 'output': {
          if (action.partName === this.partName) {
            this.activate();
          } else {
            this.deactivate();
          }
        }

        default:
        /* nop */
      }
    }

    console.log("part Constructed")
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
    if (this.sript.length === 0) {
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

    this.tagWeight = pp.tagWeight;
    this.tagDict = pp.tagDict;
    this.wordVocabLength = mt.wordVocabLength;
    this.condVocabLength = mt.condVocabLength;
    this.wordVocab = mt.wordVocab;
    this.condVocab = mt.condVocab;
    this.wordMatrix = mt.wordMatrix;
    this.condMatrix = mt.condMatrix;
    this.inDelayEffect = delayEffector(2, pp.tagWeight);
    this.outScript = outScript;
    this.prevWv = zeros(1, this.wordVocabLength); // 直前の入力
    this.prevCv = zeros(1, this.condVocabLength); // 直前の入力
    this.condVector = ones(1, this.condVoacabLength) * -1; //初期の条件ベクトル(すべて-1)
    this.condPending = {};
  }

  retrieve(text) {
    /* 
      入力文字列を受取り、スコアを返す
      wordVectorは正規化してwordMatrixとの内積。
      condVectorはそのままcondMatrixとの内積を計算してtagWeight倍する。
      両者を加えたものをscoreとする
    */
    let wv = zeros(1, this.wordVocabLength);
    let cv = zeros(1, this.condVocabLength);

    let nodes = noder.run(text.map(n => n.feat));

    for (let node of nodes) {
      if (node in this.wordVocab) {
        let pos = this.wordVocab[node];
        wv.set([0, pos], wv.get([0, pos]) + 1);
      } else if (node in this.condVocab) {
        let pos = this.condVocab[node];
        cv.set([0, pos], node.startswith('{?!') ? -1 : 1);
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
    const cvdot = apply(this.condMatrix, 1, x => dot(x, cv)) * this.tagWeight;
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
    let cands = this.outScript[index];
    cands = cands.match(RE_OUTSCRIPT);
    const avatar = cands[0];
    cands = cands[1].split('\t');
    let text = cands[randomInt(cands.length)];

    // {+tag} {-tag}処理
    // condVectorの変化はペンディングしておき、activate()でマージする
    function condReplacer(match, p1, p2) {
      // p1 +|-
      // p2 tagName
      if (match) {
        this.condPending[`{?${p2}}`] = p1 === '+' ? 1 : -1
      }
      return "";
    }
    text = text.replace(RE_OUTPUT_COND_TAG, expand());


    // 再帰的な{tag}展開
    function expander(match, tag) {
      if (!(tag in this.tagDict)) return tag;

      const items = this.tagDict[tag];
      let item = items[Math.floor(Math.random() * items.length)];

      item = item.replace(RE_OUTPUT_TAG, (match, itemTag) => expander(itemTag));
      return item;
    }
    text = text.replace(RE_OUTPUT_TAG, expander);

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

onmessage = function (event) {
  const action = event.data;
  const botId = action.botId;
  switch (action.type) {
    case 'deploy': {
      (async () => {
        const result = await part.load(botId, action.partName);
        if (result) {
          this.postMessage({ type: 'partLoaded' });
          part.deploy();
          this.postMessage({ type: 'partDeployed' });
        } else {
          this.postMessage({ type: 'partNotFound' });
        }
      })();
      break;
    }

    default:
      throw new Error(`part: invalid action ${action.type}`);
  }
}

export function matrixize(inScript, params) {
  /* inスクリプトから類似度計算用の行列を生成する。
    inスクリプトはブロックのリストで各ブロックはuser行のみが
    書かれている。ブロックは一つの話題の単位になっており文脈性を
    類似度行列の中に畳み込む。
    inスクリプトには条件タグ(cond)と単語(word)が書かれており、
    両者を合わせて特徴量(feat)と呼ぶ。
    wordのvectorは単語の出現回数を正規化したものを返し、
    retrieve()にて内積を撮って類似度とする。
    condのvectorはinスクリプトに書かれた条件タグを{?tag}は1、
    {?!tag}は-1という成分としてベクトル化し、正規化せずに
    返す。
  */
  const { tailing } = params;
  let i = 0;
  let nodes;
  let wordVocab = {};
  let condVocab = {};
  let nodesBlocks = [];

  for (let block of inScript) {
    let b = [];
    for (let line of block) {
      line = line.slice(5); // "user "の除去

      nodes = noder.run(line.map(n => n.feat));
      b.push(nodes);
      for (let node of nodes) {
        if (node.startWith('{?') && node.endswith('}')) {
          condVocab[node] = true;
        } else {
          wordVocab[node] = true;
        }
      }
    }
    nodesBlocks.push([...b]);
  }

  /*
    vocabの生成
  */

  const condVocabKeys = Object.keys(condVocab);
  const wordVocabKeys = Object.keys(wordVocab);

  let ic = 0;
  let iw = 0;

  for (let k of condVocabKeys) {
    condVocab[k] = ic++;
  }
  for (let k of wordVocabKeys) {
    wordVocab[k] = iw++;
  }

  /*
    Term Frequency: 各行内での単語の出現頻度
    tf(t,d) = (ある単語tの行d内での出現回数)/(行d内の全ての単語の出現回数の和)
    タグの重み付けとして、タグは一つ出現するごとに1ではなくtagWeight個の単語
    とみなす。
  */

  let wv = zeros(wordVocabKeys.length); // 空の行列に縦積みできないのでzerosを仮置き
  let cv = zeros(condVocabKeys.length); // 空の行列に縦積みできないのでzerosを仮置き

  for (let block of nodesBlocks) {
    i = 0;
    let wvb = zeros(block.length, wordVocabKeys.length);
    let cvb = zeros(block.length, condVocabKeys.length);
    for (let nodes of block) {
      for (let word of nodes) {
        if (word in condVocab) {
          let pos = condVocab[word];
          let w = word.startswith('{?!') ? -1 : 1;
          cvb.set([i, pos], cvb.get([i, pos]) + w);
        } else if (word in wordVocab) {
          let pos = wordVocab[word];
          wvb.set([i, pos], wvb.get([i, pos]) + 1);
        }
      }
      i++;
    }
    if (block.length > 1) {
      const de = delayEffector(block.length, tailing)
      wvb = multiply(de, wvb);
    }
    wv = concat(wv, wvb, 1);
    cv = concat(cv, cvb, 1);
  }

  // 最上行の仮置きしたzerosを削除
  wv = subset(wv, index(range(2, size(wv)[1]), range(1, size(wv)[2])))
  cv = subset(cv, index(range(2, size(cv)[1]), range(1, size(cv)[2])))

  // fv: Feature Vector
  // 成分は非負で類似度計算の際、通常の単語はnorm=1に正規化した上で
  // 内積を計算して類似度とする。条件タグは
  // fv = concat([cond], [wv / norm(wv)])
  // つまり 長さを1に正規化。 tfの場合個数で割るが、
  // 長さを1に規格化するのであれば意味がないため省略

  // 条件タグ部分の行列。成分は+1,0,-1のいずれかで、
  // 類似度計算の際は正規化せずに内積を取り、それをtagWeight倍して
  // fvの内積に加える

  const inv_wv = apply(wv, 1, x => divide(1, norm(x)));
  wv = multiply(diag(inv_wv), wv);


  return {
    status: "ok",
    wordVocabLength: wordVocabKeys.length,
    condVocabLength: condVocabKeys.length,
    wordVocab: wordVocab,
    condVocab: condVocab,
    wordMatrix: wv,
    condMatrix: cv,
  }


}

export function tee(script) {
  // 前処理済みのスクリプトはブロックのリストからなる。一つのブロックは
  // input(envまたはuser)行、ourput(bot行)が交互に現れる。
  // これらをブロックごとにin辞書、out辞書に分割する

  let inScript = [];
  let outScript = [];
  let inBlock = [];
  let outBlock = [];

  for (let block of script) {
    for (let line of block) {
      if (line.startswith('uesr ')) {
        inBlock.push(line)
      } else {
        outBlock.push(line)
      }
    }
    inScript.push([...inBlock]);
    outScript.push([...outBlock]);
    inBlock = [];
    outBlock = [];
  }

  return [inScript, outScript];
}

export function preprocess(script, validAvatars) {
  /*
    スクリプトを入力ー応答のブロックに分け、tagDictを別に抽出して返す
    [
      [
        with句,user文,bot文
      ], ...
    ],
    tagDict,
  */
  let newScript = [];
  let block = [];
  let tagDict = {};
  let withLine = "";
  let avatar = "peace";
  let tagWeight = DEFAULT_TAG_WEIGHT;
  let tailing = DEFAULT_TAILING;
  let isNonWithExists = false;
  let isInputExists = false;
  let isOutputExists = false;
  let prevKind = null;
  let re_va = RegExp("$(" + validAvatars.join("|") + "|bot) ");
  let warnings = [];
  let errors = [];
  let i, l;

  function appendBlock() {
    if (block.length === 0) {
      return
    }
    if (!isInputExists || !isOutputExists) {
      errors.push(`error: ${i}行でenv行, bot行, user行のどれかが足りないブロックが見つかりました`);
      return;
    }
    newScript.push([...block]);
    block = [];
  }

  for (i = 0, l = script.length; i < l; i++) {
    let line = script[i];
    // コメント除去
    if (line.startswith('#')) continue;

    // タグ
    const found = line.match(RE_TAG_LINE);
    if (found) {
      tagDict[found[0]] = found[1].split('\t');
      continue;
    }

    // with文
    // uesr,botより先に記述しなければならない。警告を返し無視される
    if (line.startswith('with ')) {
      if (!isNonWithExists) {
        withLine = withLine + line.slice(5);
      } else {
        warnings.push(`warning: ${i}行でwith行がbotやuser行よりあとに使用されました。無視されます`)
      }
      continue;
    }

    // avatar文
    // デフォルトアバターを指定。botで始まる行に適用される

    if (line.startswith('avatar ')) {
      let a = line.slice(6);
      if (validAvatars.includes(a)) {
        avatar = a;
      } else {
        warnings.push(`warning: ${i}行で指定されたavatar ${a} は有効ではありません`)
      }
      isNonWithExists = true;
      continue;
    }

    // tagWeight文
    if (line.startswith('tagWeight ')) {
      let a = line.slice(9);
      if (!isNaN(a)) {
        tagWeight = parseFloat(a);
      } else {
        warnings.push(`warnings: ${i}行で指定されたtagWeightは有効ではありません`)
      }
      continue;
    }

    // tailing文
    if (line.startswith('tailing ')) {
      let a = line.slice(8);
      if (!isNaN(a)) {
        tailing = parseFloat(a);
      } else {
        warnings.push(`warnings: ${i}行で指定されたtailingは有効ではありません`)
      }
      continue;
    }

    // env行
    if (line.startswith("env ")) {
      const c = line.slice(4);

      if (prevKind === KIND_USER) {
        // user行の次にenv行が来るのは禁止。その場合は
        // user行にenv行の内容を含めてしまう
        const l = block.length - 1;
        block[l] = `${block[l]}${c}`

      } else if (prevKind === KIND_ENV) {
        // 連続したenv行は一つとみなす
        const l = block.length - 1;
        block[l] = `${block[l]}${c}`;
      } else {
        // env行はuser行に読み替える
        block.push(`user ${c}`)
      }
      prevKind = KIND_ENV;
      isNonWithExists = true;
      isInputExists = true;
      continue
    }

    // user行
    if (line.startswith('user ')) {
      if (prevKind === KIND_USER) {
        // 連続したuser行にpromptを挟む
        block.push("peace {prompt}")
      }
      if (prevKind === KIND_ENV) {
        // env行の次にuser行が来るのは禁止。その場合は
        // user行末尾にenv行の内容を加えてしまう
        // env行はblockに追加されるときuser行に読み替えている
        // ため直前の行への追加となる
        const l = block.length - 1;
        const c = line.slice(4)
        block[l] = `${line}${withLine}${c}`;
      } else {
        block.push(line + withLine);
      }
      prevKind = KIND_USER;
      isNonWithExists = true;
      isInputExists = true;
      continue;
    }

    // 連続したbot行を一行にまとめる
    let match = line.match(re_va);
    if (match) {
      if (match[1] === 'bot') {
        line = `${avatar} ${line.slice(4)}`;
      }
      if (prevKind === KIND_BOT) {
        const l = block.length - 1;
        block[l] = `${block[l]}\f{line}`;
      } else {
        block.push(line)
      }
      prevKind = KIND_BOT;
      isNonWithExists = true;
      isOutputExists = true;
      continue;
    }



    // 空行はブロックの終わりとみなす。
    // 連続した空行は一つとみなす
    if (line.match(RE_BLANK_LINE)) {
      appendBlock();
      continue;
    }


    // どれにも当てはまらない行はエラー
    errors.push(`error: ${i}行(${line})は無効な行です`)
  }
  appendBlock();

  if (errors.length !== 0) {
    return {
      status: 'error',
      messages: errors
    };
  }
  if (warnings.length !== 0) {
    return {
      status: 'warning',
      messages: warnings,
      script: newScript,
      params: {
        tagDict: tagDict,
        tagWeight: tagWeight,
        tailing: tailing,
      }
    }
  } else {
    return {
      status: 'ok',
      script: newScript,
      params: {
        tagDict: tagDict,
        tagWeight: tagWeight,
        tailing: tailing,
      }
    }
  }
}

export function delayEffector(size, level) {
  /* 正方行列で、levelをlとしたとき
   1 0 0 0
   l 1 0 0
   0 l 1 0
   0 0 l 1 
   のように幅と高さがsizeの単位行列に、対角成分のひとつ下が
   lである成分が加わった行列deを返す。
   任意の行列 M に対して de×M をすることで上の行の情報が
   下の行に影響を及ぼす、やまびこのような効果を与える
  */
  let m = level * identity(size - 1);
  let pr = zeros(1, size - 1);
  let pt = zeros(size);
  m = concat(m, pr)
  m = concat(pt, m, 0)
  return m;
}

export function expand(tag, dict) {
  // main辞書の中でタグ展開
  // {[^}]+}はmain辞書内の同じ名前の内容で置き換える。
  if (!(tag in dict)) return tag;

  const items = dict[tag];

  let item = items[Math.floor(Math.random() * items.length)];

  item = item.replace(RE_TAG, (whole, itemTag) => expand(itemTag, dict));

  return item;
}