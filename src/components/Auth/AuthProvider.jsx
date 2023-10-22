/*
AuthProvider

  authState       状態
  ----------------------------------------------------------------------
  init                初期状態                                            
  connected           firebase接続した                                    
  disconnected        firebase接続に失敗した
  openSignIn          サインイン画面
  openSignUp          サインアップ画面
  openUserSetting     サインオン状態で、ユーザ情報設定
  ready               サインオンしており、ユーザ情報も登録されている
  waiting　           onAuthStateChangeの結果待ち                          
  ----------------------------------------------------------------------

  AuthProviderではfirebaseのauth周りとアプリで使用するユーザ設定を
  管理する。firebaseのuserオブジェクトでは以下の3パラメータを管理する。
  このうちphotoURLには吹き出し横に表示するアイコンのURLを指定し、
  同じディレクトリにはユーザのアバターが格納されているものとみなす。

  user: {
    email
    displayName
    photoURL
  }

  上記に加え、追加で下記のデータをfirestoreでユーザごとに管理する
  userProps: {
    backgroundColor
  }

*/

import React, { useReducer, createContext, useEffect, useRef } from 'react';
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  getAuth, signOut
} from 'firebase/auth';
import { doc, getDoc, setDoc } from "firebase/firestore";

import AuthDialog from './AuthDialog';

export const AuthContext = createContext();

const MESSAGE_MAP = {
  'configuration-not-found': 'firebaseのmail/password認証を有効にしてください',
  'invalid-login-credentials': 'ユーザが登録されていません',
  'Missing or insufficient permissions': 'firestoreのルールを読み書き可能に変更してください',
};

const initialState = {
  auth: null,
  authState: 'init',
  user: null,
  userProps: null,
  subState: null
};

function reducer(state, action) {
  console.log(`auth - ${action.type}`);

  switch (action.type) {
    case 'connect': {
      return {
        ...initialState,
        auth: action.auth,
        authState: 'connected',
        subState: null
      }
    }
    case 'disconnect': {
      return {
        ...initialState,
        authState: 'disconnected'
      }
    }
    case 'authStateChange': {
      const u = action.user;
      const p = action.userProps || state.userProps;
      if (!u) {
        return {
          auth: state.auth,
          user: null,
          authState: 'openSignIn',
          subState: null,
          userProps: null,
        }
      }
      if (u.displayName === null) {
        return {
          user: u,
          auth: state.auth,
          authState: 'openUserSettings',
          subState: null,
          userProps: null,
        }
      }
      if (!p) {
        return {
          user: u,
          auth: state.auth,
          authState: 'openUserSettings',
          subState: null,
          userProps: null
        }
      }
      return {
        user: u,
        auth: state.auth,
        authState: 'ready',
        subState: null,
        userProps: p
      }
    }

    case 'signIn': {
      return {
        ...state,
        authState: 'openSignIn',
        subState: null
      }
    }

    case 'signUp': {
      return {
        ...state,
        authState: 'openSignUp',
        subState: null
      }
    }

    case 'userSettings': {
      return {
        ...state,
        authState: 'openUserSettings',
        subState: null
      }
    }

    case 'changeUserSettings': {
      let user = state.user;
      let userProps = state.userProps;

      if (action.displayName) {
        user.displayName = action.displayName
      }
      if (action.photoURL) {
        user.photoURL = action.photoURL
      }
      if (action.backgroundColor) {
        if (!userProps) {
          userProps = {}
        }
        userProps.backgroundColor = action.backgroundColor;
      }

      return {
        ...state,
        user: user,
        userProps: userProps,
      }
    }

    case 'ready': {
      return {
        ...state,
        user: action.user || state.user,
        authState: 'ready',
        subState: null
      }
    }

    case 'waiting': {
      return {
        ...state,
        subState: 'waiting'
      }
    }

    case 'error': {
      const code = action.errorCode
      for (var msg in MESSAGE_MAP) {
        if (code.indexOf(msg) !== -1) {
          return {
            ...state,
            subState: MESSAGE_MAP[msg]
          }
        }
      }
      return {
        ...state,
        subState: code
      }
    }

    default:
      throw new Error(`invalid action ${action.type}`);
  }
}

export default function AuthProvider({ firebase, firestore, children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const unsubscribeRef = useRef();
  const uid = state.user?.uid;

  // -----------------------------------
  // 初期化
  //

  useEffect(() => {
    if (firebase) {
      const auth = getAuth(firebase);
      dispatch({
        type: "connect",
        auth: auth
      });

      unsubscribeRef.current = onAuthStateChanged(auth, user => {
        dispatch({
          type: 'authStateChange',
          user: user
        });
      });
    }

    return () => {
      if (unsubscribeRef.current) { unsubscribeRef.current(); }
    }

  }, [firebase]);

  // ----------------------------------------------------------
  //  ユーザ追加情報の初期化
  //  displayName, photoURLはuserオブジェクトを利用する。
  //  それ以外のユーザ設定情報はfirestoreに格納しており、
  //  ここで取得する。

  useEffect(() => {
    if (uid) {
      const docRef = doc(firestore, "users", uid);
      getDoc(docRef).then(snap => {
        if (snap.exists()) {
          dispatch({
            type: 'authStateChange',
            userProps: snap.data()
          })
        }
      }).catch(error => {
        dispatch({
          type: 'error',
          errorCode: error.message
        })
      })
    }
  }, [uid, firestore]);

  // -----------------------------------------------------------
  //
  // ユーザ新規作成
  // emailとpasswordを用い、作成が失敗した(emailが登録済み、
  // パスワードが短すぎる等)の場合入力し直しを促す
  //

  function handleSignUp(email, password) {
    dispatch({ type: 'waiting' });
    createUserWithEmailAndPassword(state.auth, email, password)
      // 成功した場合はonAuthStateChangedがトリガされる
      .catch((error) => {
        dispatch({
          type: 'error',
          errorCode: error.message
        })
      });
  }

  // -----------------------------------------------------------
  //
  // ログイン
  // emailとpasswordを用いてログインを試みる
  //

  function handleSignIn(email, password) {
    dispatch({ type: 'waiting' });
    signInWithEmailAndPassword(state.auth, email, password)
      // 成功した場合はonAuthStateChangedがトリガされる
      .catch((error) => {
        console.log(error.message);
        dispatch({
          type: 'error',
          errorCode: error.message
        })
      });
  }

  // -----------------------------------------------------------
  //
  // サインアウト
  //

  function handleSignOff() {
    dispatch({ type: 'waiting' })
    signOut(state.auth);
    // onAuthStateChangedがトリガされる
  }

  // -----------------------------------------------------------
  //
  //  ユーザ情報の更新
  //
  //　ユーザ情報のうちuserは
  //  userPropsはfirestoreに書き込む
  //

  function handleChangeUserSettings(data) {
    if (data.displayName || data.photoURL) {
      updateProfile(state.auth.currentUser, {
        displayName: data.displayName,
        photoURL: data.photoURL,
      })
    }
    if (data.backgroundColor) {
      const docRef = doc(firestore, "users", uid);
      setDoc(docRef, {
        backgroundColor: data.backgroundColor
      });
    }
    dispatch({
      type: 'changeUserSettings',
      ...data
    })
  }

  return (
    <AuthContext.Provider
      value={{
        photoURL: state.user?.photoURL,
        displayName: state.user?.displayName,
        uid: state.usre?.uid,
        handleSignOff: handleSignOff
      }}
    >
      {children}
      <AuthDialog
        authState={state}
        authDispatch={dispatch}
        handleSignOff={handleSignOff}
        handleSignUp={handleSignUp}
        handleSignIn={handleSignIn}
        handleChangeUserSettings={handleChangeUserSettings}
      />
    </AuthContext.Provider>
  )
}

