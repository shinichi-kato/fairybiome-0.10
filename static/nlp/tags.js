/* 似た概念をまとめてタグ化する辞書
 検索時に大まかに意味が似通っているならOK
 タグに変換される側の文字列は正規表現
*/
export const namedTags = {
  '{I}': ['私', 'ボク', '僕', '俺', 'わたし', 'あたし', 'ぼく', 'ボク',
    'オレ', 'おれ', '拙者', 'わたくし'],
  '{YOU}': ['キミ', 'きみ', '君ら', '君たち', '君達', 'あなた', '貴女',
    '貴男', 'お前', 'おまえ', '貴様', 'きさま', '君']
};

export const numberedTags = [
  ['母', '親', 'お母さん', 'おかあさん', '母親', 'ママ', '父',
    'お父さん', 'おとうさん', '父親', '親父', 'おやじ', 'パパ', '両親'],
  ['子どもたち', '子供たち', '子供達', '子供ら', '子供'],
  ['おにいさん', 'お兄さん', '兄貴', 'あにき', '兄', '弟',
   '姉妹', 'おとうと', 'お姉さん', '姉貴', '姉', 'アネキ',
    'ねえさん', 'おねえさん', '妹', '兄弟姉妹'],
  ['いとこ', '従兄弟', '従姉妹', '従兄妹', '従兄', '従弟', '従姉', '従妹'],
  ['問題','課題'],
  ['さよなら','さようなら','バイバイ','またね'],
];