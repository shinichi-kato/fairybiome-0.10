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

import React, { useReducer, createContext, useContext, useEffect, useRef, useState } from 'react';
import { AuthContext } from '../components/Auth/AuthProvider';

export const BotContext = createContext();

const initialState = {
  botId: null,
  displayName: "",
  backgroundColor: "",
  avatarDir: "default",
  botState: "init",

}

export default function BiomebotProvider({ firestore, children }) {
  const auth = useContext(AuthContext);
  const [actions, setActions] = useState({});
  const [message, setMessage] = useState({});



  //-------------------------------------------
  // 制約充足：ダウンロード
  //
  // ユーザから受け取ったメッセージにチャットボットの名前が含まれていたら
  // それをロードする。含まれなかった場合メッセージをシードとした
  // 乱数でチャットボットを選んでロードする。

  useEffect(() => {
    if (actions.download === 'req' && actions.update_script === 'done') {

      setActions(prev => ({ ...prev, download: 'done' }));
    }
  },
    [actions.download, actions.update_script, message]);

  //-------------------------------------------------------------
  // 制約充足：スクリプトのアップデート
  //
  // firestore上に最新のスクリプトがあるか確認し、なければ.jsonをコピー
  //

  useEffect(() => {
    if (!actions.update_script) {

      setActions(prev => ({ ...prev, update_script: 'done' }));
    }

  }, [actions.update_script]);

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