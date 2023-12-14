/*
自然言語文字列のノード化
========================================

チャットボットの返答生成では、様々な入力に対して柔軟な出力を返し、また
場面に応じた適切な返答を出力することが重要である。これらを実現するため
下記のタグを用いる。

## 交換可能概念識別タグ(Interchangeable Concept Identification Tag, ICIタグ)

例えば「私はテニスが好きだ」に対して「あなたはテニスが好きなんですね」と
返す。辞書としてこの入出力のペアを記憶しておくことが素朴な方法であるが、
これを一般化すれば「私は{X}が好きだ」に対して「あなたは{X}が好きなん
ですね」であり、さらに「私は{X}が{Y}だ」に対して「あなたは{X}が{Y}なん
ですね」となると小さい辞書でもかなり柔軟性の高い応答が可能になる。
ここで{X}に入ってもよいのは
テニス,庭球
のような同義語にとどまらず、
テニス,庭球,ゴルフ,野球,山登り,料理,...
のように同じ文脈に現れうるものは幅広く許容される。そこで{X}や{Y}に
当てはまる語句のグループを予め定義しておき、inScriptやoutScriptに
対応する語句が現れた場合それを{0023}のように数字４桁以上からなる名前の
タグに置き換える。対応する表層形は記憶しておき、テキストマッチングの際は
表層形ではなくタグの一致で評価する。outScriptに記憶済みのICIタグに
対応した語句が現れた場合、これを記憶した内容に置き換える。


## 条件タグ

会話の中で一度挨拶をしたら、二度は必要ない。このような条件判断は適切な
応答をするのに有力な方法になる。これをかんたんな記述で実現するため、
条件タグを用いる。条件タグはinScriptにおいて類似度を計算するWordVectorの
特殊なfeatureとして機能し、

{?tag}  事象「tag」が存在する場合類「一致」
{?!tag} 事象「tag」が存在しない場合「一致」

という動作をする。事象「tag」の存在・非存在はoutScriptにおいて下記のような
タグで代入できる。

{+tag}  事象「tag」が存在する
{-tag}  事象「tag」が存在しない

これにより、inScirptに{?!greeting}が書かれていれば、その行は事象greetingが
存在しないときに採用されやすくなり、greetingがすでに存在したら採用されに
くくなる。このような変化はoutScirptで挨拶が終わったときに{+tag}を記述する
ことで可能になる。なお、outScriptに書かれた条件タグはCondVectorに影響を
与えるが出力文字列としては空文字に置き換わる。


## 展開タグ

会話の中でランダムな文生成を利用したくなったとき、展開タグが便利である。
展開タグは辞書中で

{animal} 犬\t猫\t鶏

のように記述され、outScript中に{animal}が見つかったらその部分は犬、猫、鶏
のいずれかにランダムに置き換わる。


## タグの命名規則
ICIタグ、条件タグ、展開タグの名前には先頭が半角アルファベットまたは'_'、
二文字目以降は半角英数字または'_'が使える。また、全角/半角の使い分け
によって以下のように動作する。

{TAG} システムで使用するタグ。ユーザが定義しても無効 
{Tag} アプリが終了しても永続する
{tag} アプリが終了したら揮発する


## 変換
Noderは入力文字列を以下のようなNode列に変換する。

私は昨日山に登ったよ

surface 私  は       昨日     山      に          登った  よ 。  {?topic}
        --- ------- -------- -------- ----------  ------- -- --  --------
feat    {I} {I}は   {0234}    {0023}  {0023}に    {5408} よ 。  {?topic}


タグに助詞が続いた場合、featは「{0023}に」のように先行するタグ+
表層語彙とする。これにより単語レベルだけの一致よりも文節レベルの
一致のほうが高い類似度となる。

NoderにICITagDictを与えることで、辞書にある単語だけをタグ化する。

*/

import { namedTags, numberedTags } from '../../../static/nlp/tags';
import { TinySegmenter } from '../tinysegmenter';

const RE_TAG = /$\{[a-zA-Z_]+\}$/;

export class Node {
  constructor(surface, feat, kind = '*') {
    this.surface = surface;
    this.feat = feat;
    this.kind = kind;
  }
}

export class Noder {
  constructor() {
    this.memory = {};
    this.loadMemory = this.loadMemory.bind(this);
    this.run = this.run.bind(this);
    this.getNamedTagSurfaces = this.getNamedTagSurfaces.bind(this);
    this.getNumberedTagSufaces = this.getNumberedTagSufaces.bind(this);
    this.getTagDict = this.getTagDict.bind(this);
    this.getRESurfaces = this.getRESurfaces.bind(this);

    this.segmenter = new TinySegmenter();
    this.namedTagSurfaces = this.getNamedTagSurfaces();
    this.numberedTagSurfaces = this.getNumberedTagSufaces();
    this.RESurfaces = this.getRESurfaces();
    this.tagDict = this.getTagDict();

  }


  run(text) {
    let tags = [];
    let nodes = [];

    text = text.replace(this.RESurfaces, match => {
      tags.push(match);
      return '\v'
    });

    let segments = this.segmenter.segment(text);
    let i = 0;
    for (let s of segments) {
      if (s === '\v') {
        nodes.push(Node(tags[i], this.tagDict[tags[i]], "tag"))
        i++;
      } else {
        nodes.push(Node(s, s, s.match(RE_TAG) ? "tag" : "*"))
      }
    }

    return nodes;

  }

  getNamedTagSurfaces() {
    let surfs = [];
    for (let tag in namedTags) {
      surfs.push.apply(surfs, namedTags[tag]);
    }
    if ('{BOT_NAME}' in this.memory) {
      surfs.push(this.memory['{BOT_NAME}'])
    }
    if ('{BOT_NICK_NAMES}' in this.memory) {
      surfs.push.apply(surfs, this.memory['{BOT_NICK_NAMES}']);
    }
    if ('{USER_NICK_NAMES}' in this.memory) {
      surfs.push.apply(surfs, this.memory['{USER_NICK_NAMES}']);
    }

    surfs = surfs.sort((a, b) => (b.length - a.length));
    return surfs;
  }

  getNumberedTagSufaces() {
    let surfs = [];
    for (let ts of numberedTags) {
      surfs.push.apply(surfs, ts);
    }
    surfs = surfs.sort((a, b) => (b.length - a.length));
    return surfs;
  }

  getTagDict() {
    let dict = {};

    for (let tag in namedTags) {
      for (let surf of namedTags[tag]) {
        dict[surf] = tag
      }
    }

    for (let num in numberedTags) {
      for (let surf of numberedTags[num]) {
        let code = `${num}`
          .replace(/0/g, 'A')
          .replace(/1/g, 'B')
          .replace(/2/g, 'C')
          .replace(/3/g, 'D')
          .replace(/4/g, 'E')
          .replace(/5/g, 'F')
          .replace(/6/g, 'G')
          .replace(/7/g, 'H')
          .replace(/8/g, 'I')
          .replace(/9/g, 'J')
        dict[surf] = `{tag${code}}`
      }
    }

    if ('{BOT_NAME}' in this.memory) {
      dict[this.memory['{BOT_NAME}']] = '{BOT_NAME}';
    }
    if ('{BOT_NICK_NAMES}' in this.memory) {
      for (let surf of this.memory['{BOT_NICK_NAMES}']) {
        dict[surf] = '{BOT_NICK_NAMES}'
      }
    }
    if ('{USER_NICK_NAMES}' in this.memory) {
      for (let surf of this.memory['{USER_NICK_NAMES}']) {
        dict[surf] = '{USER_NICK_NAMES}'
      }
    }

    return dict;

  }

  getRESurfaces() {
    // 正規表現の制御文字エスケープは未実装
    let surfs = this.namedTagSurfaces.concat(this.numberedTagSurfaces);

    return new RegExp(surfs.join('|'), "g");
  }

  loadMemory(memory) {
    this.memory = { ...memory }
    this.namedTagSurfaces = this.getNamedTagSurfaces();
    this.tagDict = this.getTagDict();
    this.RESurfaces = this.getRESurfaces();
  }
}

export const noder = new Noder();
