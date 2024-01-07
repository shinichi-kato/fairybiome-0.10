import React, { useState, useContext, useEffect, useCallback } from 'react';
import { useStaticQuery, graphql } from "gatsby";

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

  const siteSnap = useStaticQuery(graphql`
  query {
    site {
      siteMetadata {
        balloonBackgroundAlpha
      }
    }
  }
  `);

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
        speakerId: message.speakerId,
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

  const writeError = useCallback(result => {
    console.log(result);
    (async () => {
      const logRef = collection(firestore, "users", auth.uid, "log");
      await addDoc(logRef, {
        text: result.messages.join('\n'),
        speakerName: result.partName,
        speakerId: null,
        timestamp: serverTimestamp(),
        avatarDir: "",
        avatar: "",
        backgroundColor: "#FFBBBB",
        kind: "sys"
      })
    })();
  }, [firestore, auth.uid]);

  //------------------------------------------------
  // チャットボット発言のレンダリング
  //
  useEffect(() => {
    let channel = new BroadcastChannel('biomebot');
    channel.onmessage = (event) => {
      const action = event.data;
      if (action.type === 'output') {
        writeLog(action.message);
      } else if (action.type === 'error') {
        writeError(action.result);
      }
    }
    return () => { channel.close() }
  }, [writeLog, writeError]);


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
    setText("");
  }

  //-----------------------------------

  function handleToBack() {
    bot.pause();
    handleToMainMenu();
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
          handleToBack={handleToBack}
          handleSend={handleSend}
        />
      </Box>
      <Box
        sx={{
          height: "calc ( 100vh - 48px - 256px )",
          overflowY: "scroll",
          alignItems: 'flex-end',
          flexGrow: 1
        }}
      >
        <LogViewer
          log={log}
          uid={auth.uid}
          bgAlpha={siteSnap.site.siteMetadata.balloonBackgroundAlpha} />
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