import React, { useState, useContext } from 'react';
import Box from '@mui/material/Box';

import FairyPanel from '../Panel/FairyPanel';
import UserPanel from '../Panel/UserPanel';

import ConsoleBar from './ConsoleBar';
import { BiomebotContext } from '../../biomebot-0.10/BiomebotProvider';
import { AuthContext } from '../../components/Auth/AuthProvider';

const panelWidth = 192;

export default function MainMenu({ user, handleToMainMenu }) {
  const bot = useContext(BiomebotContext);
  const auth = useContext(AuthContext);
  const [text, setText] = useState("");

  function handleChangeText(e) {
    setText(e.target.value);
  }

  function handleSend() {
    bot.postUserMessage();
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
        ログ表示
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
        <Box sx={{flexGrow:1}}/>
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