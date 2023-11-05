/*
Biomebot
-------------------------
単機能なチャットボットが並列で動作し、それらを統合して会話を形成するチャットボット。
ユーザは一つだけチャットボットを所有することができ、そのスクリプトは他のユーザには公開されない。
初期状態ではチャットボットは未定義状態で、ユーザから声をかけられたことをトリガーと
してチャットボットがランダムに生成され、会話を始める。

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

## システム構成
チャットボットの本体はcentralWorker上で動作し、アプリの開始などの管理をmessageで、
会話をbroadcastChannelを介して行う。

## flagsの管理

*/

import React, {
  useReducer, createContext,
  useContext, useEffect,
  useState, useRef
} from 'react';
import { useStaticQuery, graphql } from "gatsby";
import { AuthContext } from '../components/Auth/AuthProvider';

import { isExistUserChatbot, uploadScheme, downloadScheme } from '../fsio.js';
import { db } from '../dbio.js';
import { Message } from '../message';

import CentralWorker from './worker/central.worker';
import PartWorker from './worker/part.worker';


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
          internal {
            content
          }
        }
      }
    }
  }
}`;

function getBotName2RelativeDir(data) {
  // 上記のgraphql queryから{_BOT_NAME_ :relativeDirectory}という辞書を作る

  let d = {};
  data.allJson.nodes.forEach(n => {
    let dir = n.parent.relativeDirectory;
    if (n.memory && ('_BOT_NAME_' in n.memory)) {
      d[n.memory._BOT_NAME_] = dir;
    }
  })

  return d;
}

const initialState = {
  botId: null,
  displayName: "",
  backgroundColor: "",
  avatarDir: "default",
  botState: "init",
  numOfparts: 0,
  flags: {},
}

function reducer(state, action) {
  console.log(`biomebotProvider - ${action.type}`);

  switch (action.type) {
    case 'load': {
      return {
        ...state,
        botId: action.botId,
        botState: 'loading0',
        flags: {
          load: 'req',
          centralLoaded: 0,
          partLoaded: 0
        }
      }
    }

    case 'centralLoaded': {
      const completed = action.numOfParts === state.flags.partLoaded;
      return {
        ...state,
        botState: completed ? 'loaded' : 'loading1',
        flags: {
          ...state.flags,
          centralLoaded: 1,
        }
      }
    }

    case 'centralDeployed': {
      const completed = action.numOfParts === state.flags.partDeployed;
      return {
        ...state,
        botState: completed ? 'deployed' : 'deploying1',
        flags: {
          ...state.flags,
          centralDeployed: 1,
          deploy: completed ? 'done' : action.flags.deploy
        }
      }
    }

    case 'partLoaded': {
      const completed = state.flags.centralLoaded === 1 &&
        action.numOfParts === state.flags.partLoaded + 1;
      return {
        ...state,
        botState: completed ? 'loaded' : 'loading2',
        flags: {
          ...state.flags,
          partLoaded: state.flags.partLoaded + 1,
        }
      }
    }


    case 'partDeployed': {
      const completed = state.flags.centralDeployed === 1 &&
        action.numOfParts === state.flags.partDeployed + 1;

      return {
        ...state,
        botState: completed ? 'deployed' : 'deploying2',
        flags: {
          ...state.flags,
          partDeployed: state.flags.partDeployed + 1,
          deploy: completed ? 'done' : action.flags.deploy
        }
      }
    }

    case 'centralNotFound': {
      return {
        ...state,
        botState: 'error central not found',
      }
    }

    case 'PartNotFound': {
      return {
        ...state,
        botState: `error ${action.partName} not found`,
        flags: {
          ...state.flags,
          load: null
        }
      }
    }

    case 'flag': {
      console.log(action.flags)
      return {
        ...state,
        flags: {
          ...state.flags,
          ...action.flags
        }
      }
    }

    default:
      throw new Error(`invalid action ${action.type}`);
  }
}

export default function BiomebotProvider({ firestore, children }) {
  const auth = useContext(AuthContext);
  const [state, dispatch] = useReducer(reducer, initialState);
  const [message, setMessage] = useState(new Message());
  const centralWorkerRef = useRef();
  const partWorkersRef = useRef([]);
  const channelRef = useRef();

  const chatbotsSnap = useStaticQuery(chatbotsQuery);
  const flags = state.flags;

  //-------------------------------------------
  // channelの起動
  //

  useEffect(() => {
    channelRef.current = new BroadcastChannel('chat-channel');

    return () => {
      channelRef.current.close();
    }

  }, []);

  //-------------------------------------------
  // 制約充足：発言
  // 

  useEffect(() => {
    if (message.text != null) {
      // workerが起動していなければ
      if (flags.deploy === 'done') {
        channelRef.current.postMessage({type:'userPost', message:message});
      }
      else {
        if(flags.deploy !== 'req'){
          dispatch({type: 'flag', flags: {deploy: 'req'}})
        } 
      }
    }
  }, [message, flags.deploy]);

  //-------------------------------------------
  // 制約充足：workerのdeploy
  //
  // dexieDB上のschemeをworkerに読み込んで類似度計算を始める
  //

  useEffect(() => {
    if (flags.deploy === 'req') {
      if (flags.upload_scheme === 'done') {
        const botId = auth.uid;

        db.getPartNames(botId).then(partNames => {
          // partのデプロイ
          console.log("deployParts")
          partWorkersRef.current = [];

          const numOfParts = partNames.length;

          for (let pn of partNames) {
            const pw = new PartWorker();
            pw.onmessage = function (event) {
              const type = event.data.type;
              // partLoaded, partNotFound, partDeployedをディスパッチ
              dispatch({ type: type, numOfParts: numOfParts });
            }

            pw.postMessage({
              type: 'deploy',
              botId: botId,
              partName: pn,
            })
            partWorkersRef.current.push(pw)
          }

          // centralのデプロイ
          console.log("deployScheme");

          const cw = new CentralWorker();
          cw.onmessage = function (event) {
            console.log(event.data);
            const type = event.data.type;
            // centralLoaded, centralNotFound, centralDeployedをディスパッチ
            dispatch({ type: type, numOfParts: numOfParts });
          }
          cw.postMessage({
            type: 'deploy',
            botId: botId
          });
          centralWorkerRef.current = cw;
        })

        // deploy: 'done'はmessageで受取

      } else {
        if (flags.upload_scheme !== 'req') {
          dispatch({ type: 'flag', flags: { upload_scheme: 'req' } });
        }
      }

    }
    return () => {
      centralWorkerRef.current.terminate();
      partWorkersRef.current.map(p => p.terminate());
    }
  },
    [flags.deploy, flags.upload_scheme, message, auth.uid]);

  //-------------------------------------------------------------
  // 制約充足：schemeの選択とアップロード
  //
  // firestore上にユーザのschemeがない場合、
  // ユーザから受け取ったメッセージにチャットボットの名前が含まれていたら
  // そのschmeとpart一式をfirestoreにアップロード。同じ内容をdexie上にもアップロード
  // トークン辞書の最新版をdexieDB上にコピー

  useEffect(() => {
    if (flags.upload_scheme === 'req') {
      console.log("upload_scheme");
      let data = {};
      const botId = auth.uid;
      (async () => {
        if (!await isExistUserChatbot(firestore, auth.uid)) {
          // ユーザインプットにチャットボットの名前が含まれていたらそれを採用。
          // なければランダムに選ぶ
          const botname2dir = getBotName2RelativeDir(chatbotsSnap);
          let dir;
          for (let botname in botname2dir) {
            if (message.contains(botname)) {
              dir = botname2dir[botname];
              break
            }
          }
          if (!dir) {
            const names = Object.keys(botname2dir)
            const index = Math.floor(Math.random() * names.length)
            dir = botname2dir[names[index]];
          }

          // すべてのschemeをsnapから復元

          for (let node of chatbotsSnap.allJson.nodes) {
            if (node.parent.relativeDirectory === dir) {
              data[node.parent.name] = JSON.parse(node.parent.internal.content)
            }
          }

          // firestoreに上書き
          await uploadScheme(firestore, botId, data);

          // dexieに上書き
          await db.saveScheme(botId, data);
        }
        else {
          // firestore上にあればそれを使用
          data = await downloadScheme(firestore, botId);
          // dexieに書き込む
          await db.saveScheme(botId, data);
        }

        dispatch({ type: 'flag', flags: { upload_scheme: 'done' } });
      })();

      // フラグの読み込みは未実装


    }

  }, [flags.upload_scheme, auth.uid, chatbotsSnap, firestore, message]);

  return (
    <BotContext.Provider
      value={{
        displayName: state.displayName,

      }}
    >
      {children}
    </BotContext.Provider>

  )
}