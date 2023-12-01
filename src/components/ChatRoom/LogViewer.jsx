import React, { useLayoutEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';

function LeftBalloon({ message, uid }) {
  const avatarPath = message.kind === 'bot' ?
    `/chatbot/avatar/${message.avatarDir}/avatar.svg`
    :
    `/user/avatar/${message.avatarDir}/avatar.svg`;
  const backgroundColor = message.backgroundColor;
  return (
    <Box
      display="flex"
      flexDirection="row"
      alignSelf="flex-start"
    >
      <Box>
        <Avatar
          alt={message.speakerName}
          src={avatarPath}
        />
      </Box>
      <Box
        sx={{
          borderRadius: "15px 15px 15px 0px",
          padding: "0.5em",
          marginLeft: 4,
          backgroundColor: backgroundColor,
        }}
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
  const backgroundColor = message.backgroundColor || "#FFFFFFBB";

  return (
    <Box
      display="flex"
      flexDirection="row"
      alignSelf="flex-end"
    >
      <Box
        sx={{
          borderRadius: " 15px 15px 0px 15px",
          padding: "0.5em",
          marginRight: 4,
          backgroundColor: backgroundColor,
        }}
      >
        <Typography variant="body1">{message.text}</Typography>
        <Typography variant="caption1">{message.speakerName}</Typography>
      </Box>
      <Box>
        <Avatar
          alt={message.speakerName}
          src={avatarPath}
        />
      </Box>
    </Box>
  )
}

function SystemMessage({ message }) {
  return (
    <Box
      display="flex"
      flexDirection="row"
      alignItems="center"
    >
      <Box>
        <Typography>{message.text}</Typography>
      </Box>
    </Box>
  )
}

export default function LogViewer({ log, uid }) {
  const scrollBottomRef = useRef();

  useLayoutEffect(() => {
    // 書き換わるたびに最下行へ自動スクロール
    scrollBottomRef?.current?.scrollIntoView();
  }, [log]);

  return (
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
        }else {
          return <LeftBalloon key={message.id} message={message} />
        }
      })}

    </Box>
  )
}