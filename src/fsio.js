/*
チャットボットデータのfirestore I/O

chatbots コレクション
└{uid} schemeドキュメント
   │
   └partsコレクション
*/

import { collection, doc, setDoc, getDoc, getDocs } from "firebase/firestore";

export async function isExistUserChatbot(firestore, uid) {
  // ユーザのチャットボットがfirestore上にあるか確認。
  const botRef = doc(firestore, 'chatbot', uid);
  const botSnap = await getDoc(botRef);
  return botSnap.exists();
}

export async function uploadScheme(firestore, botId, data) {
  // json形式で取得したdataをfirestoreに書き込む
  const botRef = doc(firestore, 'chatbot', botId);

  for (let fn in data) {
    if (fn === 'main') {
      await setDoc(botRef, {
        ...data[fn],
        ownerId: botId,
      })
    } else {
      const partsRef = collection(botRef, 'parts');
      await setDoc(doc(partsRef, fn), data[fn]);
    }
  }
}

export async function downloadScheme(firestore, uid) {
  // firestoreに格納されたschemeを読み込み、
  // { name: content }という辞書にして返す

  let main = {}
  let parts = {}

  const botRef = doc(firestore, 'chatbot', uid);
  const mainSnap = await getDoc(botRef);
  if (mainSnap.exists()) {
    main = mainSnap.data();
  }

  const partsRef = collection(botRef, "parts");
  const snap = await getDocs(partsRef);
  snap.forEach(doc => {
    parts[doc.id] = doc.data()
  })

  console.log("downloadshceme", main);
  return { payload: { main: main, ...parts } };
}



export async function getPersistentCondition(firestore, botId, partName) {
  const collectionRef = collection(firestore, "chatbot", botId, "partCondition");
  const snap = await getDoc(doc(collectionRef, partName));
  if (snap.exists()) {
    return snap.data();
  }
  return {};
}

export async function setPersistentCondition(firestore, botId, partName, condDict) {
  // condDictは{ cond名: 値 }という形式でCondVectorの要素が格納されている

  const collectionRef = collection(firestore, "chatbot", botId, "partCondition");

  await setDoc(doc(collectionRef, partName, condDict))
}

export async function clearPersistentCondition(firestore, botId, partName) {
  await setPersistentCondition(firestore, botId, partName, {});
}