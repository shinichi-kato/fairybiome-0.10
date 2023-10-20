import React, { useState } from 'react';
import Paper from '@mui/material/Paper';
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

export default function SignUpSignInDialog({ state, authState, authDispatch, handleSignOff, handleSignUp, handleSignIn }) {
  const [password1, setPassword1] = useState(null);
  const [password2, setPassword2] = useState(null);
  const [email, setEmail] = useState("");

  const page = state.presentPage;
  const passwordUnmatched =
    password2 != null && !(
      password1 !== "" && password2 !== "" && password1 === password2
    );

  function signUp(e) {
    handleSignUp(email, password1);
  }

  function signIn(e) {
    handleSignIn(email, password1);
  }

  return (
    <Paper
      sx={{
        marginTop: 8,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>
      <Avatar sx={{ m: 1, bgcolor: 'secondary.main' }}>
        <LockOutlinedIcon />
      </Avatar>
      <Typography component="h1" variant="h5">
        {page === 'openSignUp' ? "ユーザ登録" : "サインイン"}
      </Typography>
      <Box component="form" onSubmit={handleSignUp} sx={{ m: 1 }}>
        <FormControl variant="standard">
          <InputLabel shrink htmlFor="email-input">
            Email
          </InputLabel>
          <Input id="email-input"
            value={email}
            onChange={e => { setEmail(e.target.value) }}
            startAdornment={
              <InputAdornment position="start">
                <EmailIcon />
              </InputAdornment>
            } />
        </FormControl>
        <FormControl variant="standard">
          <InputLabel shrink htmlFor="password1-input">
            パスワード
          </InputLabel>
          <Input id="pasword1-input"
            value={password1}
            onChange={e => { setPassword1(e.target.value) }}
            startAdornment={
              <InputAdornment position="start">
                <KeyIcon />
              </InputAdornment>
            } />
        </FormControl>
        {page === 'openSignUp' &&
          <FormControl variant="standard">
            <InputLabel shrink htmlFor="password2-input">
              パスワード(確認)
            </InputLabel>
            <Input id="pasword2-input"
              value={password2}
              onChange={e => { setPassword2(e.target.value) }}
              startAdornment={
                <InputAdornment position="start">
                  <KeyIcon />
                </InputAdornment>
              }
              aria-describedby="password2-message" />
            <FormHelperText id="password2-message">
              {passwordUnmatched && "パスワードが一致しません"}
            </FormHelperText>
          </FormControl>
        }
        {page === 'openSignUp' ?
          <Box>
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
          <Box>
            <Button
              variant="text"
              onClick={() => authDispatch({ type: 'signUp' })}
            >
              ユーザ登録
            </Button>
            <Button
              variant="contained"
              disabled={authState==='waiting'}
              onClick={signIn}
            >
              サインイン
            </Button>
          </Box>
        }
        <Box>
          <Button
            variant="text"
            size="small"
            onClick={handleSignOff}
          >
            サインオフ
          </Button>
        </Box>

      </Box>
    </Paper >
  )
}