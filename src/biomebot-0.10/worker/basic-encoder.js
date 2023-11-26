/*
basic-encoder
===========================

文脈性を考慮したスクリプトによる返答

スクリプトは以下の形式
[
  "with {!greeting}", // 'with 'で始まる行はすべての入力に付加される
  "user テキスト", // 'user 'で始まる行はユーザの入力
  "peace 返答", // 'アバター名 'で始まる行はbotの返答
]

[
  "user テキスト1",
  "user テキスト2", // user行が連続した場合、自動的に{prompt}が挟まれる
  "peace 返答1",
  "peace 返答2", // bot行が連続した場合、連続した発言になる
]

[
  "user テキスト1",
  "peace 返答1\t返答2\t返答3", // bot行が\tで区切られていたらその中の一つを
                               // ランダムに返す
  "", // 空行は話題の終了
  "# コメント", #で始まる行はコメント
  "{tag} ", '{[a-zA-Z_]+} 'で始まる行はタグの定義
]




speechEncoder()
encodeScript()
*/

// import {
//   zeros, divide, apply, sum,
//   diag, multiply, isPositive, map, norm
// } from "mathjs";
import { noder } from './noder';

const RE_TAG_LINE = /^(\{[a-zA-Z_]+\}) (.+)$/;
const RE_BLANK_LINE = /^#?[ 　]*$/;
const KIND_USER = 1;
const KIND_BOT = 2;

export function matrixize(script, validAvatars) {
  let withLine = "";
  let inScript = [];
  let outScript = [];
  let tagDict = {};

  let result = preprocess(script, validAvatars);
  if (result.status === 'error') {
    return result;
  }

  tagDict = result.tagDict;
  script = result.script;


  for (let block of script) {
    for (let line of block) {
      if (line.startswith('with ')) {
        withLine = line.slice(5);
        continue;
      }

      // inスクリプトの抽出
      if (line.startswith('user ')) {
        let content = line.slice(5);
        inScript.push(`${content}${withLine}`);
        continue;
      }

      // outスクリプト
      outScript.push(line)

      // inscriptとoutScriptの行番号は1:1に対応している。
      // outScriptはランダム選択の\tと連続発言の\fにより複数の可能性が
      // 畳み込まれているが、それはレンダリングの再決定する。
      // 類似度行列ではnode.featを比較する

      let squeezeDict = [];
      let vocab = {};
      for (let i = 0, l = inScript.length; i < l; i++) {
        let inFeats = noder.run(inScript[i]).map(n => n.feat);
        squeezeDict.push(inFeats)

        for (let word of inFeats) {
          vocab[word] = true;
        }

      }

      // vocabの生成
      // ここで既知のタグはすべて辞書に追加(未実装)

      const vocabKeys = Object.keys(vocab);

      for (let i = 0, l = vocabKeys.length; i < l; i++) {
        vocab[vocabKeys[i]] = i
      }

    }
  }
}

function preprocess(script, validAvatars) {
  /*
    スクリプトを
    [
      [
        with句, user文,bot文
      ], ...
    ]
    に変形する
  */
  let newScript = [];
  let block = [];
  let tagDict = {};
  let withLine = "";
  let isUserOrBotExists = false;
  let prevKind = null;
  let re_va = RegExp("$(" + validAvatars.join("|") + ") ");
  let warnings = [];
  let errors = [];
  let i,l;

  function appendBlock() {
    if (block.length === 0) {
      return
    }
    if (block.length < 2) {
      errors.push(`error: ${i}行でbot,userのどちらかが足りないブロックが見つかりました`);
      return;
    }
    if (withLine !== "") {
      block.unshift(withLine);
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
      if (!isUserOrBotExists) {
        withLine = withLine + line;
      } else {
        warnings.push(`warning: ${i}行でwith行がbotやuser行よりあとに使用されました。無視されます`)
      }
      continue;
    }

    // 連続したuser行にpromptを挟む
    if (line.startswith('user ')) {
      if (prevKind === KIND_USER) {
        block.push("peace {prompt}")
      }
      block.push(line);
      prevKind = KIND_USER;
      isUserOrBotExists = true;
      continue;
    }

    // 連続したbot行を一行にまとめる
    if (line.match(re_va)) {
      if (prevKind === KIND_BOT) {
        const l = block.length - 1;
        block[l] = `${block[l]}\f{line}`;
      } else {
        block.push(line)
      }
      prevKind = KIND_BOT;
      isUserOrBotExists = true;
      continue;
    }

    // 連続した空行は一つとみなす
    if (line.match(RE_BLANK_LINE)) {
      appendBlock();
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
      tagDict: tagDict
    }
  } else {
    return {
      status: 'ok',
      script: newScript,
      tagDict: tagDict
    }
  }
}
