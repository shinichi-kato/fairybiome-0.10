import React, { useState } from 'react';
import { useStaticQuery, graphql } from "gatsby";

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import AccountIcon from '@mui/icons-material/AccountCircle';
import Button from '@mui/material/Button';

import CustomInput from './CustomInput';
import AvatarSelector from './AvatarSelector';
import ColorPicker from './ColorPicker';
import UserPanel from '../Panel/UserPanel';

export default function UserSettingsDialog({
  authState,
  authDispatch,
  handleSignOff,
  handleChangeUserSettings
}) {

  const data = useStaticQuery(graphql`
    query {
      site {
        siteMetadata {
          backgroundColorPalette
        }
      }
      allFile(filter: {sourceInstanceName: {eq: "userAvatar"}, name: {eq: "peace"}}) {
        nodes {
          relativeDirectory
        }
      }
    }
  `);

  const palette = data.site.siteMetadata.backgroundColorPalette;
  const avatarDirs = data.allFile.nodes.map(node => (node.relativeDirectory));

  const user = authState.user;
  const userProps = authState.userProps;
  const [displayName, setDisplayName] = useState(user?.displayName);
  const [avatarDir, setAvatarDir] = useState(userProps?.avatarDir || avatarDirs[0]);
  const [backgroundColor, setBackgroundColor] = useState(userProps?.backgroundColor || palette[0]);

  const dataInvalid = (
    !displayName && displayName !== "" &&
    !avatarDir && avatarDir !== "");

  function handleSubmit(e) {
    e.preventDefault()
    handleChangeUserSettings({
      displayName: displayName,
      avatarDir: avatarDir,
      backgroundColor: backgroundColor
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
      <Box component="form"
        onSubmit={handleSubmit}
        id="user-settings"
        sx={{
          m: 1,
          width: 'xs',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}>
        <Box>
          <UserPanel
            user={{
              backgroundColor: backgroundColor,
              avatarDir: avatarDir,
            }}
            panelWidth={200}
          />
        </Box>
        <Box>
          <AvatarSelector
            avatarDirs={avatarDirs}
            avatarDir={avatarDir}
            handleChangeAvatarDir={setAvatarDir}
          />
        </Box>
        <Box>
          <CustomInput
            title="ユーザの名前"
            id="userSettings-name"
            value={displayName}
            onChange={e => { setDisplayName(e.target.value) }}
            startIcon={<AccountIcon />}
          />
        </Box>
        <Box>
          <ColorPicker
            title="背景色"
            palette={palette}
            value={backgroundColor}
            handleChangeValue={c => { setBackgroundColor(c) }}
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
            disabled={dataInvalid}
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
    </Box>
  )
}