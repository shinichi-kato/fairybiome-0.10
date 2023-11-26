/*
自然言語文字列のノード化
========================================

チャットボットの返答では入力に対応した出力を生成することが目的である。
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
当てはまる語句のグループを予め定義しておき、それをタグ化する方法で
これを実現する。Noderは入力文字列を以下のようなNode列に変換する。

私は昨日山に登ったよ

surface 私  は       昨日     山      に          登った  よ 。
        --- ------- -------- -------- ----------  ------- -- --
feat    {I} {I}は   {tagAA}  {tagXF}  {tagXF}に   {tagCD} よ 。

Nodeはsurface(表層語彙)とfeat(特徴量)からなり、文の類似度計算には
featを用いる。
タグの表層文字列は記憶しておき、出力文字列のレンダリングで利用する。
また類似度判定をする場合はfeatを利用する。
ここで、以下に示す固有名詞などシステムで利用するいくつかのタグは
予め定義する。
{BOT_NAME}
{USER_NAME}
{I}
{YOU}
タグに助詞が続いた場合、featは「{tagXF}に」のように先行するタグ+
表層語彙とする。これにより単語レベルだけの一致よりも文節レベルの
一致のほうが高い類似度となる。

*/

import { namedTags, numberedTags } from '../../../static/nlp/tags';
import { TinySegmenter } from '../tinysegmenter';

const RE_TAG = /$\{[a-zA-Z_]+\}$/;

export class Node {
  constructor(surface, feat,kind='*') {
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

    text = text.replace(this.RESurfaces,match=>{
      tags.push(match);
      return '\v'
    });

    let segments = this.segmenter.segment(text);
    let i = 0;
    for(let s of segments){
      if(s === '\v'){
        nodes.push(Node(tags[i],this.tagDict[tags[i]],"tag"))
        i++;
      } else {
        nodes.push(Node(s,s,s.match(RE_TAG) ? "tag" : "*"))
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
      for(let surf of this.memory['{BOT_NICK_NAMES}']){
        dict[surf] = '{BOT_NICK_NAMES}'
      }
    }
    if ('{USER_NICK_NAMES}' in this.memory) {
      for(let surf of this.memory['{USER_NICK_NAMES}']){
        dict[surf] = '{USER_NICK_NAMES}'
      }
    }

    return dict;

  }

  getRESurfaces(){
    // 正規表現の制御文字エスケープは未実装
    let surfs = this.namedTagSurfaces.concat(this.numberedTagSurfaces);

    return new RegExp(surfs.join('|'),"g");
  }

  loadMemory(memory) {
    this.memory = { ...memory }
    this.namedTagSurfaces = this.getNamedTagSurfaces();
    this.tagDict = this.getTagDict();
    this.RESurfaces = this.getRESurfaces();
  }
}

export const noder = new Noder();
