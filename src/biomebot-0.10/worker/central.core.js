// central worker
//
// memory
// {BOT_NAME} : チャットボットの名前
// {BOT_NICKNAMES}: チャットボットのニックネーム配列
// {REQUEST_COUNT}: ユーザがボットに話しかけた
// {CURRENT_COND_TAGS}:  

import { db } from '../../dbio.js';
import { random, pickRandom } from 'mathjs';
import { Message } from '../../message';
import { noder } from './noder';

const RE_PERSISTENT_TAG = /^[A-Z][A-Za-z0-9_]*$/;

const day2index = {
  'sun': 0, 'sunday': 0,
  'mon': 1, 'monday': 1,
  'tue': 2, 'tuesday': 2,
  'wed': 3, 'wednesday': 3,
  'thu': 4, 'thursday': 4,
  'fri': 5, 'friday': 5,
  'sat': 6, 'saturday': 6
}

export function initTiming(s) {
  /*
   {year,month,date,day,hour,minute}という辞書型データから
   今後発火するタイミングを示すdatetimeを生成する。
   
   1. day(曜日)が指定された場合date(日)は無視し、同じ曜日の次に現れる日
      が指定されたとみなす。曜日が同じ場合は今日であるとみなす。
   2. !yearの場合now,!monthの場合now,!dateの場合nowとそれぞれみなす
   3. !minのばあいmin=0とする
   4. !hourの場合nowとする
  */
  const now = new Date();
  // 1.!dayの場合同じ曜日の次の日(曜日が同じなら今日)
  let date = s.date;
  if (s.day) {
    let sd = s.day.toLowerCase();
    if (sd in day2index) {
      sd = day2index[sd]
    }
    else {
      return `invalid day string ${s.day}, candidates are: ${Object.keys(day2index)}`;
    }
    let nd = now.getDay();

    date = now.getDate() + (sd >= nd ? sd - nd : sd - nd + 7)
  }

  return new Date(
    s.year || now.getFullYear(),
    s.month ? s.month : now.getMonth(),
    date || now.getDate(),
    s.hour || now.getHours(),
    s.minute || now.getMinutes()
  )

}

export function updateTiming(s) {
  /*
    一度タイマーが発火したあとで
    {year,month,date,day,hour,minute}という辞書型データから次に
    発火するをdatetimeを更新する。曜日指定の場合は一週間後、その他は過去の
    日付にすることで更新のたびに発火するのを防ぐ
   
   1. day(曜日)が指定された場合date(日)は無視し、同じ曜日の次に現れる日
      が指定されたとみなす
   2. !yearの場合now,!monthの場合now,!dateの場合nowとそれぞれみなす
   3. !minのばあいmin=0とする
   4. !hourの場合nowとする

  */
  const now = new Date();
  // 1.!dayの場合同じ曜日の次の日
  let date = s.date;
  if (s.day) {
    let sd = s.day.toLowerCase();
    if (sd in day2index) {
      sd = day2index[sd]
    }
    else {
      return `invalid day string ${s.day}, candidates are: ${Object.keys(day2index)}`;
    }
    let nd = now.getDay();

    date = now.getDate() + (sd > nd ? sd - nd : sd - nd + 7)
    return new Date(
      s.year || now.getFullYear(),
      s.month ? s.month : now.getMonth(),
      date || now.getDate(),
      s.hour || now.getHours(),
      s.minute || now.getMinutes()
    )
  }

  // 曜日指定がないものは再び発火しない。
  // Dateは西暦273790年あたりまでが上限のため、上限値を返すことで発火させない
  return new Date(273790,9)
}

export const scheme = {
  botId: null,
  ownerId: null,
  schemeName: null,
  avatarDir: null,
  backgroundColor: "",
  interval: {
    max: 3000,
    min: 800,
  },
  response: {
    minIntensity: 0.1,  // この値よりもスコアが小さい返答は採用しない
  },
  memory: {},
  timer: {
    prevDateTime: new Date(),
    events: {},
  },
  parts: [],
  partLoadCounter: [],
  innerOutputs: [],
  channel: new BroadcastChannel("biomebot"),

  load: async (botId) => {
    let data = await db.loadScheme(botId);
    if (!data) {
      return false;
    }
    data = data.main;
    let payload = data.payload;
    scheme.botId = botId;
    scheme.schemeName = data.dir;
    scheme.ownerId = data.ownerId;
    scheme.avatarDir = payload.avatarDir;
    scheme.backgroundColor = payload.backgroundColor;
    scheme.interval = {
      ...scheme.interval,
      ...payload.interval,
    };
    scheme.response = { ...payload.response };
    scheme.memory = { ...payload.memory };

    scheme.displayName = scheme.memory["{BOT_NAME}"];

    scheme.lastTimestamp = new Date();
    scheme.timer = { ...payload.timer };
    scheme.timer = {}
    for (let eventName in payload.timer) {
      const event = scheme.timer[eventName];
      scheme.timer[eventName] = {
        ...event,
        next: initTiming(event)
      }

    }

    scheme.channel.onmessage = event => {
      const action = event.data;
      switch (action.type) {
        case 'innerOutput':
          scheme.innerOutputs.push(action);
          break;
        case 'close':
          console.log("closing biomebot channel")
          scheme.channel.close();
          break;

        default:
        /* nop */
      }
    }
    scheme.channel.onmessageerror = event => {
      console.log(event);
    }
    noder.load(scheme.memory);


    return true;
  },

  run: () => {
    // intervalで定義されるランダムな間隔でrun()は実行され、
    // innerOutputを集約して返答する
    // scheme.innerOutputには以下の内容が格納される
    // {
    //   type: 'innerOutput',
    //   partName: part.partName,
    //   text: rndr.text,
    //   score: retr.score,
    //   avatar: rndr.avatar,
    // }
    console.log("run")
    if (scheme.innerOutputs.length !== 0) {
      // ↓そこそこスコアの高かったものからランダムに選ぶ
      const reply = pickRandom(scheme.innerOutputs)

      const message = new Message('bot', {
        avatarDir: scheme.avatarDir,
        text: reply.text,
        speakerName: scheme.displayName,
        speakerId: scheme.botId,
        backgroundColor: scheme.backgroundColor,
        avatar: reply.avatar
      });

      let cond = {}
      for (let key in reply.pendingCond) {
        if (RE_PERSISTENT_TAG.test(key)) {
          cond[key] = reply.pendingCond[key]
        }
      }


      scheme.channel.postMessage({
        type: 'output', message: message,
        partName: reply.partName,
        cond: cond
      });

      scheme.innerOutputs = [];
    } else if ('{REQUEST_COUNT}' in scheme.memory) {
      const req = scheme.memory['{REQUEST_COUNT}'];
      if (req === 1) {
        // ユーザやボットからなにか言われたが返答していない場合、
        // 無言だったことを内言する。内言しても応答できなかった
        // 場合(req>1)は無理にしゃべらない

        const message = new Message('bot', {
          avatarDir: scheme.avatarDir,
          speakerName: scheme.displayName,
          speakerId: scheme.botId,
          backgroundColor: "",
          avatar: "",
          text: "{?SILENCE}"
        })
        scheme.channel.postMessage({ type: 'input', message: message });
      }
    }

    scheme.memory['{REQUEST_COUNT}'] = null;
    return true;

  },

  alarm: () => {
    /*
      run()実行時に呼び出され、scheme.timerに定義された時刻を
      超えたら所定のタグを送出する。

      各event
      
      直前のalarm()呼び出し日時を記憶しておき、各アラームについて
      前回が設定時刻のほうが未来、今回は設定時刻のほうが過去になった
      ものはinvokeする。
    */
    const now = new Date();
    for (let eventName in scheme.timer) {
      const event = scheme.timer[eventName];

      if (event.next < now) {
        const m = new Message('env', eventName)
        scheme.channel.postMessage({ type: 'input', message: message });
        scheme.timer[eventName].next = updateTiming(event);
      }

    }


  },

  kill: () => {
    clearTimeout(scheme.interval.timerId);
    scheme.channel.terminate();
  },

  recieve: (message) => {
    if (message.kind !== 'env') {
      if ('{REQUEST_COUNT}' in scheme.memory) {
        scheme.memory["{REQUEST_COUNT}"]++;
      } else {
        scheme.memory["{REQUEST_COUNT}"] = 1;
      }
    }
    scheme.channel.postMessage({ type: 'input', message: message });
  }
}
