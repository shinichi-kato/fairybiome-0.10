import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import Avatar from '@mui/material/Avatar';
import Input from '@mui/material/InputBase';
import InputAdornment from '@mui/material/InputAdornment';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import InputLabel from '@mui/material/InputLabel';
import EmailIcon from '@mui/icons-material/Email';
import KeyIcon from '@mui/icons-material/Key';
import { Button } from '@mui/material';

function CustomInput({ title, value, onChange, startIcon, type = 'text' }) {
  return (
    <Box sx={{ p: 1 }}>
      <Box>
        <Typography>
          {title}
        </Typography>
      </Box>
      <Box>
        <Input
          sx={{
            backgroundColor: "inputBg.main",
            p: 0.5,
            borderRadius: 2
          }}
          required
          type={type}
          value={value}
          onChange={onChange}
          startAdornment={
            <InputAdornment position="start">
              {startIcon}
            </InputAdornment>
          } />
      </Box>
    </Box>
  )
}

export default function SignUpSignInDialog({ state, authState, authDispatch, handleSignOff, handleSignUp, handleSignIn }) {
  const [password1, setPassword1] = useState("");
  const [password2, setPassword2] = useState("");
  const [email, setEmail] = useState("");

  const page = state.presentPage;
  const passwordUnmatched =
    password2 !== "" && !(
      password1 !== "" && password2 !== "" && password1 === password2
    );

  function signUp(e) {
    handleSignUp(email, password1);
  }

  function signIn(e) {
    handleSignIn(email, password1);
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
      <Avatar sx={{ m: 1, bgcolor: 'secondary.main' }}>
        <LockOutlinedIcon />
      </Avatar>
      <Typography component="h1" variant="h5">
        {page === 'openSignUp' ? "ユーザ登録" : "サインイン"}
      </Typography>

      <Box component="form" onSubmit={handleSignUp}
        sx={{
          m: 1,
          width: 'xs',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}>
        <CustomInput
          title="Email"
          value={email}
          onChange={e => { setEmail(e.target.value) }}
          startIcon={<EmailIcon />}
        />
        <CustomInput
          title="パスワード"
          type="password"
          value={password1}
          onChange={e => { setPassword1(e.target.value) }}
          startIcon={<KeyIcon />}
        />
        {page === 'openSignUp' &&
          <>
            <CustomInput
              title="パスワード(確認)"
              value={password2}
              type="password"
              onChange={e => { setPassword2(e.target.value) }}
              startIcon={<KeyIcon />}
            />
            {passwordUnmatched && "パスワードが一致しません"}
          </>
        }
        {page === 'openSignUp' ?
          <Box
            alignSelf="flex-end"
          >
            <Button
              variant="text"
              onClick={() => authDispatch({ type: 'signIn' })}>
              サインイン
            </Button>
            <Button
              variant="contained"
              onClick={signUp}
            >
              ユーザ登録
            </Button>
          </Box>
          :
          <Box
            alignSelf="flex-end"
            sx={{p:1}}
          >
            <Button
              variant="text"
              onClick={() => authDispatch({ type: 'signUp' })}
            >
              ユーザ登録
            </Button>
            <Button
              variant="contained"
              disabled={authState.subState === 'waiting'}
              onClick={signIn}
            >
              サインイン
            </Button>
          </Box>
        }
        {authState.subState}
        <Box
          sx={{p:1}}
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
    </Box >
  )
}