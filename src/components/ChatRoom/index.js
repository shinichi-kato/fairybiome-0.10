import React, {useState} from 'react';
import { AuthContext } from "../Auth/AuthProvider";
import {db} from '../../dbio';

export default function ChatRoom() {
  const auth = useContext(AuthContext);
  const [page, setPage] = useState('menu');
  
  function handleToUserRoom(e){
    setPage('room');
  }

  function handleReset(e){
    db.clear(auth.uid).then(()=>{setPage('room')});
  }

  return (
    <>
      {
        page === 'menu' && 
        <MainMenu
          displayName={auth.displayName}
          handleToUserRoom={handleToUserRoom}
          handleReset={handleReset}
        />
      }
      {
        page === 'room' &&
        <UserRoom
          user={auth.user}
        />
      }
    </>

  )
}