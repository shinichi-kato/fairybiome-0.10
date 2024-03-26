function stringValidator(state, value) {
  return value !== "" && value !== null && value !== undefined
}

function nopValidator(state, value) {
  return true;
}

function maxIntervalValidator(state, value) {
  if (isNaN(value)) { return false }
  if (isNaN(state.interval.min)) { return false }
  const v = parseFloat(value);
  if (v > 0 && v > parseFloat(state.interval.min)) { return true };
  return false;
}

function minIntervalValidator(state, value) {
  if (isNaN(value)) { return false }
  if (isNaN(state.interval.max)) { return false }
  const v = parseFloat(value);
  if (v > 0 && v < parseFloat(state.interval.max)) { return true };
  return false;
}

function coeffValidator(state, value) {
  if (isNaN(value)) { return false }
  const v = parseFloat(value);
  if (0 < v && v <= 1.0) { return true; }
  return false;
}


function hourValidator(state, value) {
  if (isNaN(value)) { return false; }
  const v = parseFloat(value);
  if (0 <= v && v <= 23) { return true; }
  return false;
}


export const mainModel = [
  {
    header: null,
    children: [
      {
        key: "memory",
        subKey: "{BOT_NAME}",
        caption: "チャットボットの名前。吹き出しにも表示される。",
        inputType: "string",
        validator: stringValidator,
        required: true,
      },
      {
        key: "description",
        caption: "チャットボットの説明",
        inputType: "text",
        validator: stringValidator,
        required: false,
      },
      {
        key: "avatarDir",
        caption: "チャットボットの姿",
        inputType: "avatar",
        validator: stringValidator,
        required: true,
      },
      {
        key: "backgroundColor",
        caption: "キャラクタと吹き出しの背景色",
        inputType: "color",
        validator: stringValidator,
        required: true,
      },
      {
        key: "author",
        caption: "作者名",
        inputType: "string",
        validator: nopValidator,
        required: false
      },
      {
        key: "timestamp",
        caption: "更新日時",
        inputType: "timestamp",
        validator: nopValidator,
        required: true,
      },

    ],
  },
  {
    header: "チャットボットはある周期で返答を返します。 周期が短いと思いついたことを色々しゃべるように、周期が長いと考えてしゃべるように振る舞います。この周期は下記の最短値、最小値の間でランダムに変動します。",
    children: [
      {
        key: "interval",
        subKey: "max",
        caption: "次の返答までの最長時間(msec)",
        inputType: "string",
        validator: maxIntervalValidator,
        required: true,
      },
      {
        key: "interval",
        subKey: "min",
        caption: "次の返答までの最短時間(msec)",
        inputType: "string",
        validator: minIntervalValidator,
        required: true,
      }
    ]
  },
  {
    header: "返答に要求する確信度を設定できます。確信度が低くても回答すると的外れでもとにかく答えるようになります",
    children: [
      {
        key: "response",
        subKey: "minIntensity",
        caption: "返答候補に求められる最小の確信度。(0.0〜1.0)",
        inputType: "string",
        required: true,
        validator: coeffValidator,
      },
    ]
  },
  {
    header: "パートに共通の記憶",
    children: [
      {
        key: "memory",
        subKey: "{BOT_NAME}",
        caption: "チャットボットの名前。吹き出しにも表示される。",
        inputType: "string",
        defaultValue: "名前",
        required: true,
        validator: stringValidator,
      },
      {
        key: "memory",
        subKey: "{I}",
        caption: "チャットボットが自身を呼ぶときに使う一人称。複数の候補がある場合はカンマ(,)区切り",
        inputType: "strings",
        defaultValue: ["私"],
        required: true,
        validator: stringValidator,
      },
      {
        key: "memory",
        subKey: "{YOU}",
        caption: "チャットボットが会話相手を呼ぶときに使う二人称。複数の候補がある場合はカンマ(,)区切り",
        inputType: "strings",
        defaultValue: ['あなた'],
        required: true,
        validator: stringValidator,
      },
      {
        key: "memory",
        subKey: "{NICKNAMES}",
        caption: "チャットボットのニックネーム。複数の候補がある場合はカンマ(,)区切り",
        inputType: "strings",
        defaultValue: ["ニックネーム"],
        required: true,
        validator: stringValidator,
      },
      {
        key: "memory",
        subKey: "{AWAKENING_HOUR}",
        caption: "起床時刻",
        inputType: "hours",
        defaultValue: [7],
        validator: hourValidator,
      },
      {
        key: "memory",
        subKey: "{BEDTIME_HOUR}",
        caption: "就寝時刻",
        inputType: "hours",
        defaultValue: [21],
        validator: hourValidator,
      },
    ]
  }
];

export function getDefaultMemories(){
  let dict = {};
  for (let group of mainModel){
    for(let child of group.children){
      if(child.key === 'memory'){
        dict[child.subKey] = child.defaultValue || "";
      }
    }
  }
  console.log(dict)
  return dict;
}