const requiredMemories = [
  {
    key: "{BOT_NAME}",
    caption: "チャットボットの名前。吹き出しにも表示される。",
    type: "string",
    defaultValue: "名前"
  },
  {
    key: "{I}",
    caption: "チャットボットが自身を呼ぶときに使う一人称。複数の候補がある場合はカンマ(,)区切り",
    type: "strings",
    defaultValue: ["私"]
  },
  {
    key: "{YOU}",
    caption: "チャットボットが会話相手を呼ぶときに使う二人称。複数の候補がある場合はカンマ(,)区切り",
    type: "strings",
    defaultValue: ['あなた']
  },
  {
    key: "{NICKNAMES}",
    caption: "チャットボットのニックネーム。複数の候補がある場合はカンマ(,)区切り",
    type: "strings",
    defaultValue: ["ニックネーム"]
  },
  {
    key: "{AWAKENING_HOUR}",
    caption: "起床時刻を0~23の整数で指定。",
    type: "hours",
    defaultValue: [7]
  },
  {
    key: "{BEDTIME_HOUR}",
    caption: "就寝時刻を0~23の整数で指定。",
    type: "hours",
    defaultValue: [21]
  },
];

function getDefaultMemories(){
  let dict = {};
  for (let item of requiredMemories){
    dict[item.key]=item.defaultValue;
  }
  return dict;
}