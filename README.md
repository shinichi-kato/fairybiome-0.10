FairyBiome-0.10.0
=================================

雑談チャットボット

## 概要

雑談は表層的には話題が多岐にわたり、
LLMは従来のチャットボットと比べて非常に高い理解力と会話能力を持つが、基本的には質問応答や要約を目的としており、ユーザとの雑談には適していない。
また巨大なバックエンドを必要とし


## インストール

firebaseにアカウントを用意します。
githubの場合リポジトリ本体にはセキュリティのためクレデンシャル情報を置かず、変わりに
Settings - Secrets and variables - Repository secretsに以下の変数を作り、
firebaseから取得したクレデンシャルを転記します。Gatsbyではプログラム内で使える環境変数は先頭がGATSBY_から始まっている必要があるため、以下のような名前にします。

```
GATSBY_FIREBASE_API_KEY
GATSBY_FIREBASE_AUTH_DOMAIN
GATSBY_FIREBASE_PROJECT_ID
GATSBY_FIREBASE_STORAGE_BUCKET
GATSBY_FIREBASE_MESSAGING_SENDER_ID
GATSBY_FIREBASE_APP_ID
GATSBY_FIREBASE_MEASUREMENT_ID
```

またローカルで動かす場合は.env.localというファイルを作成し以下のようにクレデンシャル情報を記載します。
```
GATSBY_FIREBASE_API_KEY={...}
GATSBY_FIREBASE_AUTH_DOMAIN=xxxx.firebaseapp.com
GATSBY_FIREBASE_PROJECT_ID={...}
GATSBY_FIREBASE_STORAGE_BUCKET=xxxx.appspot.com
GATSBY_FIREBASE_MESSAGING_SENDER_ID={...}
GATSBY_FIREBASE_APP_ID={...}
GATSBY_FIREBASE_MEASUREMENT_ID={...}
```

### firebase 接続

[firebase CLIをインストールする](https://firebase.google.com/docs/cli?hl=ja#mac-linux-auto-script)を参照して

```
curl -sL https://firebase.tools | bash
firebase login
```
