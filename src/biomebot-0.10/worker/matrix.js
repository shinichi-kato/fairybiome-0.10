import {
  zeros, identity, divide, apply, concat, add, subset, index,range,size,
  diag, multiply, norm,
} from "mathjs";
import { noder } from './noder';

const RE_TAG_LINE = /^(\{[a-zA-Z_]+\}) (.+)$/;
const RE_BLANK_LINE = /^#?[ 　]*$/;
const RE_EXPAND_TAG = /^\{[a-zA-Z_][a-zA-Z0-9_]*\}/;

const KIND_USER = 1;
const KIND_BOT = 2;
const KIND_ENV = 4;
const DEFAULT_TAG_WEIGHT = 2.0;
const DEFAULT_TAILING = 0.2;

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
  const tailing = params.tailing;
  let i = 0;
  let feats;
  let wordVocab = {};
  let condVocab = {};
  let nodesBlocks = [];

  for (let block of inScript) {
    let b = [];
    for (let line of block) {
      line = line.slice(5); // "user "の除去

      feats = noder.run(line).map(n=>n.feat);
      b.push(feats);
      for (let feat of feats) {
        if (feat.startsWith('{?') && feat.endsWith('}')) {
          condVocab[feat] = true;
        } else 
        if(feat.startsWith('{!')){
          return {
            status: 'error',
            message: [`${i}行に不正なタグ${feat}が見つかりました。{?!~}を使ってください`]
          }
        
        }else {
          wordVocab[feat] = true;
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

  // condVocab,wordVocabともに1つしか要素がない場合
  // dot()計算が失敗するのでダミーを加える
  if(condVocabKeys.length === 1){
    condVocabKeys.push('{?__dummy__}')
  }
  if(wordVocabKeys.length === 1){
    wordVocabKeys.push('__dummy__');
  }

  let ic = 0;
  let iw = 0;
  for (let k of condVocabKeys) {
    condVocab[k] = ic++;
  }
  for (let k of wordVocabKeys) {
    wordVocab[k] = iw++;
  }


  /*
    Word Vector: 各行内での単語の出現回数
    Cond Vector: 各行での各条件タグの「真」「偽」「非該当」状態
  */

  let wv = zeros(1,wordVocabKeys.length); // 空の行列に縦積みできないのでzerosを仮置き
  let cv = zeros(1,condVocabKeys.length); // 空の行列に縦積みできないのでzerosを仮置き
  for (let block of nodesBlocks) {
    i = 0;
    let wvb = zeros(block.length, wordVocabKeys.length);
    let cvb = zeros(block.length, condVocabKeys.length);
    for (let nodes of block) {
      for (let word of nodes) {
        if (word in condVocab) {
          let pos = condVocab[word];
          let w = word.startsWith('{?!') ? -1 : 1;
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
    wv = concat(wv, wvb, 0);
    cv = concat(cv, cvb, 0);
  }

  // console.log(wv,cv)

  // 最上行の仮置きしたzerosを削除
  const wvSize = size(wv).toArray()
  const cvSize = size(cv).toArray()
  wv = subset(wv, index(range(1, wvSize[0]), range(0, wvSize[1])))
  cv = subset(cv, index(range(1, cvSize[0]), range(0, cvSize[1])))

  // 成分は非負で類似度計算の際、通常の単語はnorm=1に正規化した上で
  // 内積を計算して類似度とする。条件タグは
  // fv = concat([cond], [wv / norm(wv)])
  // つまり 長さを1に正規化。 tfの場合個数で割るが、
  // 長さを1に規格化するのであれば意味がないため省略

  // 条件タグ部分の行列。成分は+1,0,-1のいずれかで、
  // 類似度計算の際は正規化せずに内積を取り、それをtagWeight倍して
  // fvの内積に加える

  const inv_wv = apply(wv, 1, x => divide(1, norm(x) || 1 ));
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
  let errors = [];

  let i=0;
  for (let block of script) {
    for (let line of block) {
      if (line.startsWith('user ')) {
        inBlock.push(line)
      } else {
        outBlock.push(line)
      }
      i++;
    }
    inScript.push([...inBlock]);
    outScript.push([...outBlock]);
    inBlock = [];
    outBlock = [];
    if(inBlock.length !== outBlock.length){
      errors.push(`${i}行目: 入力と出力の数が異なっています`)
    }
  }

  return {
    inScript:inScript,
    outScript: outScript,
    status: errors.length === 0 ? "ok" : "error",
    errors: errors
  };
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
  let re_va = RegExp("^(" + validAvatars.join("|") + "|bot) (.*)$");
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
    if (line.startsWith('#')) continue;

    // タグ
    const found = line.match(RE_TAG_LINE);
    if (found) {
      tagDict[found[1]] = found[2].split('\t');
      continue;
    }

    // with文
    // uesr,botより先に記述しなければならない。警告を返し無視される
    if (line.startsWith('with ')) {
      if (!isNonWithExists) {
        withLine = withLine + line.slice(5);
      } else {
        warnings.push(`warning: ${i}行でwith行がbotやuser行よりあとに使用されました。無視されます`)
      }
      continue;
    }

    // avatar文
    // デフォルトアバターを指定。botで始まる行に適用される

    if (line.startsWith('avatar ')) {
      let a = line.slice(7);
      if (validAvatars.includes(a)) {
        avatar = a;
      } else {
        warnings.push(`warning: ${i}行: avatar '${a}' は有効ではありません。無視されます。`)
      }
      isNonWithExists = true;
      continue;
    }

    // tagWeight文
    if (line.startsWith('tagWeight ')) {
      let a = line.slice(10);
      if (!isNaN(a)) {
        tagWeight = parseFloat(a);
      } else {
        warnings.push(`warnings: ${i}行: tagWeight ${a} は有効ではありません`)
      }
      continue;
    }

    // tailing文
    if (line.startsWith('tailing ')) {
      let a = line.slice(8);
      if (!isNaN(a)) {
        tailing = parseFloat(a);
      } else {
        warnings.push(`warnings: ${i}行で指定されたtailingは有効ではありません`)
      }
      continue;
    }

    // env行
    if (line.startsWith("env ")) {
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
        block.push(`user ${c}${withLine}`)
      }
      prevKind = KIND_ENV;
      isNonWithExists = true;
      isInputExists = true;
      continue
    }

    // user行
    if (line.startsWith('user ')) {
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

    // bot行
    // 連続したbot行は一行にまとめる
    let match = line.match(re_va);
    if (match) {
      if (match[1] === 'bot') {
        line = `${avatar} ${match[2]}`;
      }
      if (prevKind === KIND_BOT) {
        const l = block.length - 1;
        block[l] = `${block[l]}\f${line}`;
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
      prevKind=null;
      continue;
    }


    // どれにも当てはまらない行はエラー
    errors.push(`error: ${i}行(${line})は無効な行です`)
  }
  appendBlock();

  if (errors.length !== 0) {
    return {
      status: 'error',
      messages: [...errors,...warnings]
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
  let m = identity(size);
  let d = multiply(identity(size - 1), level);
  d = concat(zeros(1, size - 1), d,0);
  d = concat(d, zeros(size, 1));
  return add(m, d);
}

export function expand(tag, dict) {
  // main辞書の中でタグ展開
  // {[^}]+}はmain辞書内の同じ名前の内容で置き換える。
  if (!(tag in dict)) return tag;

  const items = dict[tag];

  let item = items[Math.floor(Math.random() * items.length)];

  item = item.replace(RE_EXPAND_TAG, match => expand(match, dict));

  return item;
}