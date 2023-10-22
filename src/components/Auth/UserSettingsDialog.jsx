import React, { useState, useEffect } from 'react';
import { useStaticQuery, graphql } from "gatsby";

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CustomInput from './CustomInput';
import AccountIcon from '@mui/icons-material/AccountCircle';
import Button from '@mui/material/Button';

export default function UserSettingsDialog({
  authState,
  authDispatch,
  handleSignOff,
  handleChangeUserSettings
}) {
  const user = authState.user;
  const [displayName, setDisplayName] = useState(user.displayName);
  const [photoURL, setPhotoURL] = useState(user.photoURL);
  const [backgroundColor, setBackgroundColor] = useState(authState.userProps?.backgroundColor);

  function handleSubmit() {
    handleChangeUserSettings({
      displayName: displayName === "" ? null : displayName,
      photoURL: photoURL === "" ? null : photoURL,
      backgroundColor: backgroundColor === "" ? null : backgroundColor
    })
    authDispatch({ type: 'ready' });
  }
  return (
    <Box
      sx={{
        marginTop: 8,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        maxWidth: 'xs',
        px: 'auto',
        borderRadius: "16px 16px 0px 0px",
        backgroundColor: 'background.paper'
      }}>
      <Typography component="h1" variant="h5">
        ユーザ設定
      </Typography>
      <Box component="form" onSubmit={handleSubmit}
        sx={{
          m: 1,
          width: 'xs',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}>
        <CustomInput
          title="ユーザ名"
          value={displayName}
          onChange={e => { setDisplayName(e.target.value) }}
          startIcon={<AccountIcon />}
        />
      </Box>
      <Box>
        {authState.subState}
      </Box>
      <Box
        sx={{ p: 1 }}
      >
        <Button
          variant="contained"
          onClick={handleSubmit}
          type="submit"
        >
          OK
        </Button>
      </Box>
      <Box
        sx={{ p: 1 }}
      >
        <Button
          variant="text"
          size="small"
          onClick={handleSignOff}
        >
          サインオフ
        </Button>
      </Box>
    </Box>
  )
}