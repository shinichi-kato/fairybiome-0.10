/*
Biomebot
-------------------------
単機能なチャットボットが並列で動作し、それらを統合して会話を形成するチャットボット。
ユーザは一つだけチャットボットを所有することができ、そのスクリプトは他のユーザには公開されない。
初期状態ではチャットボットは未定義状態で、ユーザから声をかけられたことをトリガーと
してチャットボットがランダムに生成され、会話を始める。

firestore上のスクリプトをdexieDB上にコピーしておき、それを

botState        Avatar例        内容
---------------------------------------------------------------
unload        なし            初期状態
update_script パーティクル    firestore上のスクリプトを最新に
download      光の玉          firestoreから読み込み ... avatarDirが"default"         
matrixize     光の玉(複数)    tfidf行列を計算。
response      視線が上の方    入力を受付け返答を生成中
asleep        寝てる          会話中の状態
awake         目覚めた        会話中の状態
attention     注目している    会話中の状態
happy         楽しそう        会話中の状態
unhappy       楽しくない      会話中の状態
------------------------------------------------------------------

*/

import React, {
  useReducer, createContext,
  useContext, useEffect,
  useRef, useState
} from 'react';
import { useStaticQuery, graphql, withPrefix } from "gatsby";
import { AuthContext } from '../components/Auth/AuthProvider';

import { isExistUserChatbot, uploadScheme, downloadScheme } from '../fsio.js';
import { writeScheme } from '../dbio.js';

import CentralWorker from './worker/central.worker.js';

let centralWorker = new CentralWorker();

export const BotContext = createContext();

const chatbotsQuery = graphql`
query {
  allFile(filter: {sourceInstanceName: {eq: "botScheme"}, ext: {eq: ".json"}}) {
    nodes {
      modifiedTime(formatString: "yyyy-MM-dd hh:mm:ss")
      relativeDirectory
      name
      sourceInstanceName
    }
  }
  allJson {
    nodes {
      memory {
        _BOT_NAME_
      }
      parent {
        ... on File {
          relativeDirectory
          name
        }
      }
    }
  }
}`;

function getBotName2RelativeDir(data) {
  // 上記のgraphql queryから{_BOT_NAME_ :relativeDirectory}という辞書を作る

  let d = {};
  data.allJson.nodes.foreach(n => {
    let dir = n.parent.relativeDirectory;
    if ('_BOT_NAME_' in n.memory) {
      d[n.memory._BOT_NAME_] = dir;
    }
  })

  return d;
}

function getBotFileNames(data, dir) {
  // 上記のgraphql queryからrelativeDirectoryがdirである[name]を返す

  let l = [];
  data.allJson.nodes.foreach(n => {
    if (n.parent.relativeDirectory === dir) {
      l.push(n.parent.name)
    }
  })

  return l;
}

const initialState = {
  botId: null,
  displayName: "",
  backgroundColor: "",
  avatarDir: "default",
  botState: "init",

}

function reducer() {

}

export default function BiomebotProvider({ firestore, children }) {
  const auth = useContext(AuthContext);
  const [actions, setActions] = useState({});
  const [message, setMessage] = useState({});
  const [state, dispatch] = useState(reducer, initialState);

  const chatbotsSnap = useStaticQuery(chatbotsQuery);

  //-------------------------------------------
  // central workerからの受信
  //

  useEffect(() => {
    centralWorker.onmessage = function (event) {
      const action = event.data;
      switch (action.type) {
        case 'loaded': {

          break
        }

        default:
          throw new Error(`invalid action ${action.type}`)
      }

    }

    centralWorker.postMessage({ type: 'load', uid: auth.uid });

  }, [auth.uid]);

  //-------------------------------------------
  // 制約充足：発言
  // 

  useEffect(() => {
    if (message) {
      // workerが起動していなければ
    }
  }, [message]);

  //-------------------------------------------
  // 制約充足：計算
  //
  // schemeがdexieDB上になければfirestoreから読み込みdexieに書き込む。
  // workerを生成し、workerはdexieからデータを読んで類似度行列の計算を始める

  useEffect(() => {
    if (actions.download === 'req') {
      if (actions.update_scheme === 'done') {
        (async () => {

          // ダウンロード
          const data = await downloadScheme(auth.uid);

          // dexieに書き込み
          await writeScheme(data);

          // central worker起動

        })();


        setActions(prev => ({ ...prev, download: 'done' }));
      } else {
        setActions(prev => ({ ...prev, update_scheme: 'req' }))
      }

    }
  },
    [actions.download, actions.update_scheme, message, auth.uid]);

  //-------------------------------------------------------------
  // 制約充足：schemeの選択とアップロード
  //
  // firestore上にユーザのschemeがない場合、
  // ユーザから受け取ったメッセージにチャットボットの名前が含まれていたら
  // その.jsonをfirestoreにアップロード。
  // トークン辞書の最新版をdexieDB上にコピー

  useEffect(() => {
    if (actions.upload_scheme === 'req') {
      (async () => {
        if (!await isExistUserChatbot(firestore, auth.uid)) {
          // ユーザインプットにチャットボットの名前が含まれていたらそれを採用。
          // なければランダムに選ぶ
          const botname2dir = getBotName2RelativeDir(chatbotsSnap);
          let dir;
          for (let botname in botname2dir) {
            if (message.indexOf(botname) !== -1) {
              dir = botname2dir[botname];
              break
            }
          }
          if (!dir) {
            dir = botname2dir[Math.random(Object.keys(botname2dir).length)]
          }

          // すべてのschemeをfetch
          const filenames = getBotFileNames(chatbotsSnap, dir);

          const content = await Promise.all(filenames.map(async fn => {
            const payload = await fetch(
              withPrefix(`/static/chatbot/scheme/${dir}/${fn}.json`)
            );
            return payload.json();
          }));

          let data = {};
          for (let i = 0; i < filenames.length; i++) {
            data[filenames[i]] = content[i]
          }

          // firestoreに書き込む
          await uploadScheme(firestore, auth.uid, data);

        }
      })();

      // トークン辞書の読み込みは未実装

      setActions(prev => ({ ...prev, upload_scheme: 'done' }));
    }

  }, [actions.upload_scheme, auth.uid, chatbotsSnap, firestore, message]);

  return (
    <BotContext.Provider
      value={{
        seMessage: setMessage
      }}
    >
      {children}
    </BotContext.Provider>

  )
}