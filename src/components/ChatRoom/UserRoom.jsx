import React, { useState, useContext, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';

import FairyPanel from '../Panel/FairyPanel';
import UserPanel from '../Panel/UserPanel';

import ConsoleBar from './ConsoleBar';
import LogViewer from './LogViewer';
import { BiomebotContext } from '../../biomebot-0.10/BiomebotProvider';
import { AuthContext } from '../../components/Auth/AuthProvider';
import { Message } from '../../message';
import {
  collection, query, orderBy, limit, onSnapshot,
  addDoc, serverTimestamp
} from 'firebase/firestore'

const panelWidth = 192;

export default function UserRoom({ firestore, handleToMainMenu }) {
  const bot = useContext(BiomebotContext);
  const auth = useContext(AuthContext);
  const [text, setText] = useState("");
  const [log, setLog] = useState([]);

  //------------------------------------------------
  // ログの購読
  //

  useEffect(() => {
    let unsubscribe = null;

    if (auth.uid) {
      console.log("subscribe start")
      const logRef = collection(firestore, "users", auth.uid, "log");
      const q = query(
        logRef,
        orderBy("timestamp", "desc"),
        limit(20));

      unsubscribe = onSnapshot(q, snap => {
        let l = [];
        snap.forEach(doc => {
          const d = doc.data();
          l.push({
            ...d,
            id: doc.id,
            timestamp: d.timestamp ? d.timestamp.toDate() : ""
            // timestampはserverTimestamp()で書き込むとratency補正時にnullが帰ってくる
          });
        });
        setLog(l);

      });
    }

    return () => {
      if (unsubscribe) {
        console.log("unsubscribed");
        unsubscribe();
      }
    }
  }, [auth.uid, firestore]);

  // -------------------------------------
  // ログへの書き込み
  //

  const writeLog = useCallback(message => {
    (async () => {
      const logRef = collection(firestore, "users", auth.uid, "log");
      await addDoc(logRef, {
        text: message.text,
        speakerName: message.speakerName,
        timestamp: serverTimestamp(),
        avatarDir: message.avatarDir,
        avatar: message.avatar,
        backgroundColor: message.backgroundColor,
        kind: message.kind
      })
    })();
  }, [firestore, auth.uid]);

  function handleChangeText(e) {
    setText(e.target.value);
  }

  //------------------------------------------------
  // チャットボット発言のレンダリング
  //
  useEffect(() => {
    let channel = new BroadcastChannel('biomebot');
    channel.onmessage = (event) => {
      const action = event.data;
      if (action.type === 'botSpeech') {
        writeLog(action.message);
      }
    }
    return () => { channel.close() }
  }, [writeLog]);


  //-----------------------------------------------
  // ユーザ発言のレンダリング
  //

  function handleSend(event) {
    const user = auth.userProps;
    const msg = new Message('user', {
      avatarDir: user.avatarDir,
      avatar: 'peace',
      speakerName: user.displayName,
      speakerId: auth.uid,
      backgroundColor: user.backgroundColor,
      text: text,
    })
    writeLog(msg);
    bot.postUserMessage(msg);
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: "100vh"
      }}
    >
      <Box>
        <ConsoleBar
          text={text}
          handleChangeText={handleChangeText}
          handleToBack={handleToMainMenu}
          handleSend={handleSend}
        />
      </Box>
      <Box
        sx={{
          flexGrow: 1
        }}
      >
        <LogViewer log={log} uid={auth.uid}/>
      </Box>
      <Box
        sx={{
          display: 'flex',
          felxDirection: 'row'
        }}
      >
        <Box>
          <FairyPanel
            state={bot.state}
            panelWidth={panelWidth}
          />
        </Box>
        <Box sx={{ flexGrow: 1 }} />
        <Box>
          <UserPanel
            user={auth.userProps}
            panelWidth={panelWidth}
          />
        </Box>
      </Box>

    </Box>
  )
}