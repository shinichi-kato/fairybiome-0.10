import React, { useLayoutEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { alpha } from '@mui/material';

function getPalletteDict(log, bgAlpha) {
  // messageのリストからspeakerIdと背景色の辞書を生成し、
  // 背景色をbgAlphaに従った半透明にする。
  // see: https://qiita.com/kiyoshi999/items/3935734624fc909079e8

  const dict = {};
  for (let m of log) {
    const sid = m.speakerId;
    if(sid){
      const bgColor = m.backgroundColor;
      dict[`balloon_${sid}`] = { main: alpha(bgColor, bgAlpha) };
      dict[`avatar_${sid}`] = {main: bgColor}
    }
  }
  return dict;
}

function LeftBalloon({ message, uid }) {
  const avatarPath = message.kind === 'bot' ?
    `/chatbot/avatar/${message.avatarDir}/avatar.svg`
    :
    `/user/avatar/${message.avatarDir}/avatar.svg`;
  const sid = message.speakerId;

  return (
    <Box
      display="flex"
      flexDirection="row"
      sx={{
        borderRadius: "15px 15px 15px 0px",
        alignSelf: "flex-start",
        padding: "0.5em",
        marginLeft: "2px",
        marginBottom: "2px",
        backgroundColor: `balloon_${sid}.main`,
      }}
    >
      <Box
        alignS
      >
        <Avatar
          alt={message.speakerName}
          src={avatarPath}
          sx={{bgcolor: `avatar_${sid}.main`}}
        />
      </Box>
      <Box
      >
        <Typography
          variant="body1"
        >
          {message.text}
        </Typography>
        <Typography
          variant="caption"
        >
          {message.speakerName}
        </Typography>

      </Box>
    </Box>
  )
}

function RightBalloon({ message }) {
  const avatarPath = message.kind === 'bot' ?
    `/chatbot/avatar/${message.avatarDir}/avatar.svg`
    :
    `/user/avatar/${message.avatarDir}/avatar.svg`;
  const sid = message.speakerId;

  return (
    <Box
      display="flex"
      flexDirection="row"
      alignSelf="flex-end"
      sx={{
        borderRadius: " 15px 15px 0px 15px",
        padding: "0.5em",
        marginRight: "2px",
        marginBottom: "2px",
        backgroundColor: `balloon_${sid}.main`,
      }}
    >
      <Box>
        <Typography variant="body1">{message.text}</Typography>
        <Typography variant="caption">{message.speakerName}</Typography>
      </Box>
      <Box
        alignSelf="flex-end"
      >
        <Avatar
          alt={message.speakerName}
          src={avatarPath}
          sx={{bgcolor: `avatar_${sid}.main`}}
        />
      </Box>
    </Box>
  )
}

function SystemMessage({ message }) {
  let texts = message.text.split('\n');
  texts = texts.map((text,index)=>
    <Typography variant="body2" color="error.main" key={index}>{text}</Typography>
    );
  return (
    <Box
      display="flex"
      flexDirection="row"
      alignItems="center"
    >
      <Box>
        {
          message.speakerName && 
          <Typography variant="caption">{message.speakerName}</Typography>
        }
        {texts}
      </Box>
    </Box>
  )
}

export default function LogViewer({ log, uid, bgAlpha }) {
  const customTheme = createTheme({
    palette: getPalletteDict(log, bgAlpha)
  });
  const scrollBottomRef = useRef();

  useLayoutEffect(() => {
    // 書き換わるたびに最下行へ自動スクロール
    scrollBottomRef?.current?.scrollIntoView();
  }, [log]);

  return (
    <ThemeProvider theme={customTheme}>
      <Box
        display="flex"
        flexDirection="column"
      >
        {log.map(message => {
          const id = message.speakerId;
          if (!id) {
            return <SystemMessage key={message.id} message={message} />
          }
          else if (id === uid) {
            return <RightBalloon key={message.id} message={message} />
          } else {
            return <LeftBalloon key={message.id} message={message} />
          }
        })}

      </Box>
    </ThemeProvider>

  )
}