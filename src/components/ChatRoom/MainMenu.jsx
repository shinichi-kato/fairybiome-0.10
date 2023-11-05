import React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';


export default function MainMenu({ displayName, handleToUserRoom, handleReset }) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <Box>
        LOGO
      </Box>
      <Box>
        <Button
          onClick={handleToUserRoom}
        >
          {displayName}の部屋に入る
        </Button>
      </Box>
      <Box>
        <Button
          onClick={handleReset}
        >
          はじめからやり直す
        </Button>
      </Box>
      <Box>
        <Button>
          ユーザ設定
        </Button>
      </Box>

    </Box>
  )
}