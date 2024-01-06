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


## 条件タグ (Condition Tag)

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


## 展開タグ (Expand Tag)

会話の中でランダムな文生成を利用したくなったとき、展開タグが便利である。
展開タグは辞書中で

{animal} 犬\t猫\t鶏

のように記述され、outScript中に{animal}が見つかったらその部分は犬、猫、鶏
のいずれかにランダムに置き換わる。
展開タグのうち、タグ名に含まれるアルファベットがすべて大文字のものは
システムが使用するタグで、これをSystem Tagと呼ぶ。


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

import { systemTags, ICITags } from '../../../static/nlp/tags';
import { TinySegmenter } from '../tinysegmenter';

const RE_TAG = /\{(\?|\?!|\+|-|)[a-zA-Z_][a-zA-Z_0-9]*\}/g;

export class Node {
  constructor(surface, feat) {
    this.surface = surface;
    this.feat = feat;
  }
}

export class Noder {
  constructor() {
    this.systemTagMap1 = getSystemTagMap1();
    this.systemTagMap2 = new Map();
    this.ICITagMap = getICITagMap();
    this.segmenter = new TinySegmenter();

  }

  load(memory) {
    this.systemTagMap2 = getSystemTagMap2(memory);
  }

  run(text) {
    let tagDict = {};
    let nodes = [];
    let i = 0;

    // 条件タグと展開タグ：透過
    text = text.replace(RE_TAG, match => {
      tagDict[i] = { surf: match, feat: match };
      return `\v${i++}\v`;
    })

    // システムタグ：タグ化
    for (const [key, value] of this.systemTagMap2) {
      if(text.indexOf(key) !== -1){
        tagDict[i] = {surf: key, feat: value }
        text = text.replace(key, `\v${i++}\v`);
      }
    }
    for (const [key, value] of this.systemTagMap1) {
      if(text.indexOf(key) !== -1){
        tagDict[i] = {surf: key, feat: value }
        text = text.replace(key, `\v${i++}\v`);
      }
    }

    // ICIタグ該当語句：タグ化
    for (const [key, value] of this.ICITagMap) {
      if (text.indexOf(key) !== -1) {
        tagDict[i] = { surf: key, feat: `{${value}}` }
        text = text.replace(key, `\v${i++}\v`);
      }
    }

    let segments = this.segmenter.segment(text);
    let phase = 0;
    for(let seg of segments){
      if(phase === 0 && seg === '\v'){
        phase = 1;
        continue
      } else 
      if(phase === 1){
        console.error(seg)
        let t = tagDict[seg];
        nodes.push(new Node(t.surf,t.feat))
        phase = 2;
        continue;
      } else 
      if(phase === 2){ // seg === '\v'
        phase=0;
        continue;
      } else {
        nodes.push(new Node(seg,seg))
      }

    }
    return nodes;

  }
}

function getICITagMap() {
  // ICITagsの語句を長い順にソートしたMap

  let dict = {};
  let words = [];
  for (let i = 0, l = ICITags.length; i < l; i++) {
    for (let word of ICITags[i]) {
      dict[word] = i;
      words.push(word);
    }
  }

  let tagMap = new Map();
  words.sort((a, b) => (b.length - a.length));
  for (let word of words) {
    tagMap.set(word, dict[word]);
  }

  return tagMap;
}

function getSystemTagMap1() {
  let dict = {};
  let words = [];
  for (let tag in systemTags) {
    for (let word of systemTags[tag]) {
      dict[word] = tag;
      words.push(word);
    }
  }

  let tagMap = new Map();
  words.sort((a, b) => (b.length - a.length));
  for (let word of words) {
    tagMap.set(word, dict[word]);
  }
  return tagMap;

}

function getSystemTagMap2(memory) {
  let dict = {};
  let words = [];
  if ('{BOT_NAME}' in memory) {
    let word = memory['{BOT_NAME}']
    dict[word] = '{BOT_NAME}';
    words.push(word);
  }

  if ('{BOT_NICKNAMES}' in memory) {
    for (let surf of memory['{BOT_NICKNAMES}']) {
      dict[surf] = '{BOT_NICKNAME}';
      words.push(surf);
    }
  }

  if ('{USER_NICKNAMES}' in memory) {
    for (let surf of memory['{USER_NICKNAMES']) {
      dict[surf] = '{USER_NICKNAME}';
      words.push(surf);
    }
  }

  let tagMap = new Map();
  words.sort((a, b) => (b.length - a.length));
  for (let word of words) {
    tagMap.set(word, dict[word]);
  }
  return tagMap;
}

export const noder = new Noder();
