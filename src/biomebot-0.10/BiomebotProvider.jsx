/*
Biomebot
-------------------------
単機能なチャットボットが並列で動作し、それらを統合して会話を形成するチャットボット。
ユーザは一つだけチャットボットを所有することができ、そのスクリプトは他のユーザには公開されない。
初期状態ではチャットボットは未定義状態で、ユーザから声をかけられたことをトリガーと
してチャットボットがランダムに生成され、会話を始める。

state             内容
---------------------------------------------------------------
botId             fsとdbで識別するのに使うId。
displayName       表示名。memory:_BOT_NAME_を利用
backgroundColor   背景色
avatarDir         avatarの親ディレクトリ
botState          botの状態。${avatarDir}/${botState}.svgがavatar
numOfparts        partの数
flags             状態管理フラグ
-----------------------------------------------------------------

botState        Avatar例        内容
---------------------------------------------------------------
unload        なし            初期状態
uploading     パーティクル    schmeをfb,dbに読み込む
loading       光の玉(小)      workerがdbからschemeを読む         
loaded        光の玉(中)      読み込み完了
deploying     光の玉(大)      tfidf行列を計算開始。
deployed      光るシルエット  tfidf行列を計算終了
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
import {randomInt} from 'mathjs';
// import { Message } from '../message.js';

import CentralWorker from './worker/central.worker';
import PartWorker from './worker/part.worker';

export const BiomebotContext = createContext();

const chatbotsQuery = graphql`
query {
  allFile(filter: {sourceInstanceName: {eq: "botAvatar"}, ext: {eq: ".svg"}}) {
    nodes {
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
  // ただし'loading'という名前のチャットボットは除外

  let d = {};
  data.allJson.nodes.forEach(n => {
    let dir = n.parent.relativeDirectory;
    if (dir !== 'loading'){
      if (n.memory && ('_BOT_NAME_' in n.memory)) {
        d[n.memory._BOT_NAME_] = dir;
      }
    }
  })

  return d;
}

function getAvatarNameDict(data) {
  let d = {};
  console.log(data);
  data.allFile.nodes.forEach(n => {
    const dir = n.relativeDirectory;
    if (dir in d) {
      d[dir].push(n.name);
    } else {
      d[dir] = [n.name];
    }
  });
  return d;
}

function getValidBotAvatars(data, avatarDir) {
  let avatars = [];
  for (let node of data.allFile.nodes) {
    if (node.avatarDir === avatarDir) {
      avatars.push(node.name);
    }
  }
  return avatars;
}

const initialState = {
  botId: null,
  displayName: "",
  backgroundColor: "#cccccc",
  avatarDir: "default",
  botState: "unload",
  numOfparts: 0,
  flags: {},
}

function reducer(state, action) {
  console.log(`biomebotProvider - ${action.type}`);

  switch (action.type) {
    case 'load': {
      return {
        ...initialState,
        botId: action.botId,
        botState: 'loading',
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
        botState: completed ? 'loaded' : 'loading',
        avatarDir: action.avatarDir,
        backgroundColor: action.backgroundColor,
        displayName: action.displayName,
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
        botState: completed ? 'deployed' : 'deploying',

        flags: {
          ...state.flags,
          centralDeployed: 1,
          deploy: completed ? 'done' : state.flags.deploy
        }
      }
    }

    case 'partLoaded': {
      const completed = state.flags.centralLoaded === 1 &&
        action.numOfParts === state.flags.partLoaded + 1;
      return {
        ...state,
        botState: completed ? 'loaded' : 'loading',
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
        botState: completed ? 'deployed' : 'deploying',
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

    case 'partNotFound': {
      return {
        ...state,
        botState: `error ${action.partName} not found`,
        flags: {
          ...state.flags,
          load: null
        }
      }
    }

    case 'upload_scheme_req': {
      return {
        ...state,
        botState: 'uploading',
        flags: {
          ...state.flags,
          upload_scheme: 'req'
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
  const [msgQueue, setMsgQueue] = useState([]);
  const centralWorkerRef = useRef();
  const partWorkersRef = useRef([]);

  const chatbotsSnap = useStaticQuery(chatbotsQuery);
  const flags = state.flags;


  //-------------------------------------------
  // 制約充足：ユーザ発言の受付け
  //
  // chatbotがdeployされていたらメッセージをチャンネルにポストする
  // 

  function postUserMessage(message) {
    if (flags.deploy === 'done') {
      // workerが起動していればchannelにメッセージをポスト
      centralWorkerRef.current.postMessage({ type: 'input', message: message });
    } else {
      // 起動前だったら起動。起動前に受け取ったメッセージは最後の
      // 一つだけ記憶しておく
      if (flags.deploy !== 'req') {
        dispatch({ type: 'flag', flags: { deploy: 'req' } })
      }
      setMsgQueue([message]);
    }
  }

  //-------------------------------------------
  // 制約充足：queueの消費
  //
  // msgQueueにメッセージが残っていたらポストする
  //

  useEffect(() => {
    if (flags.deploy === 'done' && msgQueue.length !== 0) {
      for (let m of msgQueue) {
        // 一度にpostしてOKか？
        centralWorkerRef.current.postMessage({ type: 'input', message: m });
      }
      setMsgQueue([]);
    }

  }, [flags.deploy, msgQueue]);

  //-------------------------------------------
  // 制約充足：workerのdeploy
  //
  // dexieDB上のschemeをworkerに読み込んで類似度行列の計算を始める
  //

  useEffect(() => {
    if (flags.deploy === 'req') {
      if (flags.upload_scheme === 'done') {
        const botId = auth.uid;

        db.getPartNamesAndAvatarDir(botId).then(({partNames, avatarDir}) => {
          // partのデプロイ
          console.log("deployParts",partNames,avatarDir)
          partWorkersRef.current = [];

          const numOfParts = partNames.length;
          const validBotAvatars = getValidBotAvatars(chatbotsSnap, avatarDir);

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
              validAvatars: validBotAvatars
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
            switch (type) {
              case 'centralDeployed': {
                dispatch({
                  type: type,
                  ...event.data,
                  numOfParts: numOfParts
                });
                break;
              }
              default:
                dispatch({ type: type, numOfParts: numOfParts });

            }
          }
          cw.postMessage({
            type: 'deploy',
            botId: botId
          });
          centralWorkerRef.current = cw;
        })

      } else {
        if (flags.upload_scheme !== 'req') {
          dispatch({ type: 'upload_scheme_req' });
        }
      }

    }
    return () => {
      centralWorkerRef.current?.terminate();
      partWorkersRef.current.map(p => p.terminate());
    }
  },
    [flags.deploy, flags.upload_scheme, auth.uid, chatbotsSnap]);

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
      const avatarDict = getAvatarNameDict(chatbotsSnap);
      let dir;
      (async () => {
        if (!await isExistUserChatbot(firestore, auth.uid)) {
          // ユーザインプットにチャットボットの名前が含まれていたらそれを採用。
          // なければランダムに選ぶ
          const botname2dir = getBotName2RelativeDir(chatbotsSnap);
          if (msgQueue.length !== 0) {
            for (let botname in botname2dir) {
              if (msgQueue[0].contains(botname)) {
                dir = botname2dir[botname];
                break
              }
            }

          }
          if (!dir) {
            const names = Object.keys(botname2dir)
            const index = randomInt(names.length);
            dir = botname2dir[names[index]];
          }

          // すべてのschemeをsnapから復元

          for (let node of chatbotsSnap.allJson.nodes) {
            if (node.parent.relativeDirectory === dir) {
              data[node.parent.name] = JSON.parse(node.parent.internal.content)
            }
          }

          // firestoreに上書き
          
          await uploadScheme(firestore, botId, data, avatarDict);

        }
        else {
          // firestore上にあればそれを使用
          data = await downloadScheme(firestore, botId);

        }

        // dexieに書き込む
        await db.saveScheme(botId, data, avatarDict);

        dispatch({ type: 'flag', flags: { upload_scheme: 'done' } });
      })();

      // 永続フラグの読み込みは未実装


    }

  }, [flags.upload_scheme, auth.uid, chatbotsSnap, firestore, msgQueue.length, msgQueue]);



  return (
    <BiomebotContext.Provider
      value={{
        state: state,
        postUserMessage: postUserMessage,
      }}
    >
      {children}
    </BiomebotContext.Provider>

  )
}