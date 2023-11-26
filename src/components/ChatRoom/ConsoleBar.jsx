import React from 'react';
import { alpha } from '@mui/material/styles';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import ArrowBackIcon from '@mui/icons-material/ArrowBackIos';
import SendIcon from '@mui/icons-material/Send';
import InputBase from '@mui/material/InputBase';


export default function ConsoleBar({
  text, handleChangeText, handleToBack, handleSend }) {
  return (
    <AppBar
      position="static"
    >
      <Toolbar
      >
        <IconButton
          onClick={handleToBack}
          edge="start"
          color="inherit"
        >
          <ArrowBackIcon />
        </IconButton>
        <Box
          sx={{
            display: "flex",
            flexDirection: "row",
            flexGrow: 1
          }}
          component="form"
        >
          <Box
            sx={{
              my: "2px",
              ml: "2px",
              borderRadius: "6px",
              backgroundColor: alpha("#eeeeee", 0.2),
              display: "flex",
              flexDirection: "row",
              width: "100%"
            }}
          >
            <Box>

            </Box>
            <InputBase
              value={text}
              onChange={handleChangeText}
              sx={{
                width: "100%",
                color: "inherit",
                p: 1
              }}
            />
            <IconButton
              color="inherit"
              type="submit"
            >
              <SendIcon />
            </IconButton>
          </Box>
        </Box>

      </Toolbar>
    </AppBar >
  )
}