import React, { useState, useContext } from 'react';
import { AuthContext } from "../Auth/AuthProvider";
import MainMenu from './MainMenu';
import UserRoom from './UserRoom';
import { db } from '../../dbio';

export default function ChatRoom({ firestore }) {
  const auth = useContext(AuthContext);
  const [page, setPage] = useState('menu');

  function handleToUserRoom(e) {
    setPage('room');
  }

  function handleToMainMenu() {
    setPage('menu');
  }

  function handleReset(e) {
    db.clear(auth.uid).then(() => { setPage('room') });
  }

  return (
    <>
      {
        page === 'menu' &&
        <MainMenu
          displayName={auth.userProps?.displayName}
          handleToUserRoom={handleToUserRoom}
          handleReset={handleReset}
        />
      }
      {
        page === 'room' &&
        <UserRoom
          firestore={firestore}
          handleToMainMenu={handleToMainMenu}
        />
      }
    </>

  )
}