import React from 'react';
import { withPrefix,navigate } from 'gatsby';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';


export default function MainMenu({
  displayName, handleToUserRoom, handleReset
}) {

  function handleToEdit(){
    navigate("/edit");
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <Box
        sx={{ alignSelf: 'center' }}
      >
        <img
          src={withPrefix('/images/fairydoor.svg')}
          alt="title"
        />
      </Box>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row'
        }}
      >
        <Box>
          <Button
            onClick={handleToUserRoom}
          >
            {displayName}の部屋に入る
          </Button>
        </Box>
        { }
      </Box>
      <Box>
        <Button
          onClick={handleReset}
        >
          はじめからやり直す
        </Button>
      </Box>
      <Box>
        <Button
          onClick={handleToEdit}
        >
          チャットボットの編集
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