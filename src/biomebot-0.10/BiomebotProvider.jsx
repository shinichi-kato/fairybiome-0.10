/*
Biomebot
-------------------------
単機能なチャットボットが並列で動作し、それらを統合して会話を形成するチャットボット。
ユーザは一つだけチャットボットを所有することができ、そのスクリプトは他のユーザには公開されない。
初期状態ではチャットボットは未定義状態で、ユーザから声をかけられたことをトリガーと
してチャットボットが生成され、会話を始める。

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
  useState, useRef, useCallback
} from 'react';
import { useStaticQuery, graphql } from "gatsby";
import { AuthContext } from '../components/Auth/AuthProvider';

import {
  uploadScheme, downloadScheme,
  getPersistentCondition, setPersistentCondition,
} from '../fsio.js';
import { db } from '../dbio.js';
import { randomInt, random } from 'mathjs';
// import { Message } from '../message.js';

import CentralWorker from './worker/central.worker';
import PartWorker from './worker/part.worker';
import useInterval from './useInterval';

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
    if (dir !== 'loading') {
      if (n.memory && ('_BOT_NAME_' in n.memory)) {
        d[n.memory._BOT_NAME_] = dir;
      }
    }
  })

  return d;
}

function getValidBotAvatars(data, avatarDir) {
  let avatars = [];
  for (let node of data.allFile.nodes) {
    if (node.relativeDirectory === avatarDir) {
      avatars.push(node.name);
    }
  }
  return avatars;
}

function generateBotIdFromUserId(uid) {
  return uid && `bot${uid}`;
}

function newerTimestamp(a, b) {
  // ["2022-12-11","22:33:00"]という形式で格納されたtimestampを
  // 比較し、aのほうが新しい場合trueを返す
  if(a && !b){ return true}
  if(!a && b){ return false}
  return a[0] > b[0] && a[1] > b[1];
}

const initialState = {
  botId: null,
  displayName: "",
  backgroundColor: "#cccccc",
  avatarDir: "default",
  botState: "unload",
  numOfparts: 0,
  interval: { min: 800, max: 2000, current: null },
  flags: {
    centralLoaded: 0,
    centralDeployed: 0,
    partLoaded: 0,
    partDeployed: 0
  },
  channel: null
}

function reducer(state, action) {
  console.log(`biomebotProvider - ${action.type}`);

  switch (action.type) {
    case 'setChannel': {
      return {
        ...state,
        channel: action.channel
      }
    }

    case 'centralLoaded': {
      const completed = action.numOfParts === state.flags.partLoaded;
      return {
        ...state,
        botState: completed ? 'loaded' : 'loading',

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
        interval: {
          ...action.interval,
          current: completed ? 1000 : null
        },
        botId: action.botId,
        avatarDir: action.avatarDir,
        backgroundColor: action.backgroundColor,
        displayName: action.displayName,
        flags: {
          ...state.flags,
          centralDeployed: 1,
          deploy: completed ? 'done' : state.flags.deploy
        }
      }
    }

    case 'setNextInterval': {
      const imin = state.interval.min;
      const imax = state.interval.max;
      const interv = random(imin, imax);
      return {
        ...state,
        interval: {
          min: imin,
          max: imax,
          current: interv
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
        interval: {
          ...state.interval,
          current: completed ? 1000 : null
        },
        flags: {
          ...state.flags,
          partDeployed: state.flags.partDeployed + 1,
          deploy: completed ? 'done' : state.flags.deploy
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
      return {
        ...state,
        flags: {
          ...state.flags,
          ...action.flags
        }
      }
    }

    case 'pause': {
      return {
        ...state,
        interval: {
          ...state.interval,
          current: null
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


  useEffect(() => {
    let cw, c, pws;
    if (!centralWorkerRef.current) {
      centralWorkerRef.current = new CentralWorker();
      cw = centralWorkerRef.current;
      c = new BroadcastChannel('biomebot');
      dispatch({ type: 'setChannel', channel: c });
    }

    pws = partWorkersRef.current;

    return () => {
      if (cw && c) {
        cw.postMessage({ type: 'kill' });
        cw = undefined;
        console.log("close all channel")
        c.postMessage({ type: 'close' });
      }
      if (pws.length !== 0) {
        for (let pw of pws) {
          pw.terminate();
        }
      }
    }
  }, []);

  useEffect(() => {
    const botId = generateBotIdFromUserId(auth.uid);
    if (firestore && botId && state.channel) {

      state.channel.onmessage = event => {
        const action = event.data;
        // console.log("biomebot channel monitor:", action);
        switch (action.type) {
          case 'output':
            setPersistentCondition(firestore, botId, action.partName, action.cond);
            break;

          case 'close':
            state.channel.close();
            break;

          default:
          /* nop */
        }
      }
    }
  }, [auth.uid, firestore, state.channel]);


  //-------------------------------------------
  // 制約充足：ユーザ発言の受付け
  //
  // chatbotがdeployされていたらメッセージをチャンネルにポストする
  // 

  const postUserMessage = useCallback(message => {
    if (flags.deploy === 'done') {
      // workerが起動していればchannelにメッセージをポスト
      dispatch({ type: 'setNextInterval' });
      centralWorkerRef.current.postMessage({ type: 'input', message: message });
    } else {
      // 起動前だったら起動。起動前に受け取ったメッセージは最後の
      // 一つだけ記憶しておく
      if (flags.deploy !== 'req') {
        dispatch({ type: 'flag', flags: { deploy: 'req' } })
      }
      setMsgQueue([message]);
    }
  }, [flags.deploy, dispatch]);

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
  // 制約充足：チャットボットの起動
  //
  // chatbotが返答をするためのペーサーを起動
  // 

  useInterval(() => {
    centralWorkerRef.current.postMessage({ type: 'run' });
    dispatch({ type: 'setNextInterval' });


  }, state.interval.current);

  //-------------------------------------------
  // 制約充足：workerのdeploy
  //
  // dexieDB上またはstaticQueryのschemeをworkerに読み込んで類似度行列の計算を始める
  // エラーが起きなかった場合はuploadを要求する

  useEffect(() => {
    if (flags.deploy === 'req') {
      if (flags.upload_scheme === 'done') {
        const botId = generateBotIdFromUserId(auth.uid);

        (async () => {
          const { partNames, avatarDir } = await db.getPartNamesAndAvatarDir(botId);
          // partのデプロイ

          if (partWorkersRef.current.length === 0) {

            const numOfParts = partNames.length;
            const validBotAvatars = getValidBotAvatars(chatbotsSnap, avatarDir);

            for (let pn of partNames) {
              let pw = new PartWorker();

              partWorkersRef.current.push(pw);
              pw.onmessage = function (event) {
                const action = event.data;
                const result = action.result;
                // partLoaded, partNotFound, partDeployedをディスパッチ
                // ここでスクリプトがvalidateされ、エラーの有無をdexidDB上の
                // データに記録する。エラーがある場合はschemeアップロードの制約充足で
                // 必ずロードされる

                if (result.status !== 'ok') {
                  state.channel.postMessage({ type: 'error', result: result });
                  db.noteSchemeValidation(botId, false);

                } else {
                  dispatch({ type: action.type, numOfParts: numOfParts });
                  db.noteSchemeValidation(botId, true);
                }
              }

              const cond = await getPersistentCondition(firestore, botId, pn);
              pw.postMessage({
                type: 'deploy',
                botId: botId,
                partName: pn,
                persistentCond: cond,
                validAvatars: validBotAvatars
              })

            }

            // centralのデプロイ
            console.log("deployScheme");

            // centralWorkerRef.current = new CentralWorker();
            let cw = centralWorkerRef.current;
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
          }
        })();

      } else {
        if (flags.upload_scheme !== 'req') {
          dispatch({ type: 'upload_scheme_req' });
        }
      }

    }

    // ここでpartWorkerをterminateしてしまうと、依存行列の内容が変わった瞬間に
    // terminateが実行されてしまう
    // return () => {
    //   if (pws) {
    //     pws.map(p => p.terminate());
    //   }
    // }
  },
    [flags.deploy, flags.upload_scheme, auth.uid, chatbotsSnap, firestore, state.channel]);

  //-------------------------------------------------------------
  // 制約充足: schemeの選択とアップロード
  //
  // snap(staticQuery)をソースとし、db(dexie)とfs(firestore)にコピーを作る。
  // アプリ動作中の更新はdbに対して行い、アプリ起動時にdbとfsの同期を行う。
  // 
  // 1. db上にデータが存在しない場合ユーザ入力を踏まえてdirを一つ選ぶ。
  // 2. db上にvalidなデータがなければsnapからdbにコピーを作る
  //    deploy時にvalidateが行われる。 
  // 3. db上のデータがvalidであればfsのデータとdbのデータを比べ、新しい方に
  //    同期する  

  useEffect(() => {
    if (flags.upload_scheme === 'req') {
      console.log("upload_scheme");
      let graphqlSnap = {};
      const botId = generateBotIdFromUserId(auth.uid);
      let botDir;

      (async () => {
        // step 1: db上にデータがあればそれを使い、なければdirを一つ選ぶ
        botDir = await db.getDir(botId) || choose();

        // schemeとpartをsnapから復元

        for (let node of chatbotsSnap.allJson.nodes) {
          if (node.parent.relativeDirectory === botDir) {
            graphqlSnap[node.parent.name] = JSON.parse(node.parent.internal.content)
          }
        }

        // step 2: validなデータがなければsnapからdbにコピー
        if (!await db.isSchemeValid(botId)) {
          await db.saveScheme(botId, botDir, graphqlSnap);
        }
        else {
          let fsSnap = await downloadScheme(firestore, botId);

          let dbSnap = await db.loadScheme(botId);
          console.log("fssnap",fsSnap);
          console.log("dbSnap",dbSnap);
          // step3: dbがvalidだった場合、schemeと各partについてそれぞれdb,fsの内容を
          // gq,db,fsの中で最新のものに同期
          for (let sn in graphqlSnap) {
            let dbTs = dbSnap[sn].payload.timestamp;
            let fsTs = fsSnap && fsSnap[sn].timestamp;
            let gqTs = graphqlSnap[sn].timestamp;
            console.log("timestamp",sn,dbTs,fsTs,gqTs)

            if (newerTimestamp(gqTs, fsTs) && newerTimestamp(gqTs, dbTs)) {
              // gqが最新の場合、graphqlSnapをdbに書き込む
              await db.saveScheme(botId, botDir, graphqlSnap)
            }

            else if (newerTimestamp(dbTs, gqTs) && newerTimestamp(dbTs, fsTs)) {
              // dbが最新の場合、dbSnapをfsに書き込む
              await uploadScheme(firestore, botId, dbSnap, botDir);
            }

            else if (newerTimestamp(fsTs, dbTs) && newerTimestamp(fsTs, gqTs)) {
              // fsが最新の場合、fsSnapをdbに書き込む
              await db.saveScheme(botId, botDir, fsSnap)
            }
          }
        }

        dispatch({ type: 'flag', flags: { upload_scheme: 'done' } });
      })();



      // 永続フラグの読み込みは未実装

      function choose() {
        const botname2dir = getBotName2RelativeDir(chatbotsSnap);
        if (msgQueue.length !== 0) {
          for (let botname in botname2dir) {
            if (msgQueue[0].contains(botname)) {
              return botname2dir[botname];
            }
          }

        }
        const names = Object.keys(botname2dir)
        const index = randomInt(names.length);
        return botname2dir[names[index]];
      }


    }

  }, [flags.upload_scheme, auth.uid, chatbotsSnap, firestore, msgQueue.length, msgQueue]);

  function pause() { dispatch({ type: 'pause' }) }
  function restart() { dispatch({ type: 'setNextInterval' }) }

  return (
    <BiomebotContext.Provider
      value={{
        state: state,
        postUserMessage: postUserMessage,
        pause: pause,
        restart: restart
      }}
    >
      {children}
    </BiomebotContext.Provider>

  )
}