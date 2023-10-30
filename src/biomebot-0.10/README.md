biomebot-0.10
==================================
チャットボットモジュール

## メカニズム
人の心には複数の「心のパート」が存在し、それらが並列的に動作しながら発言権は競争的に
調整されている。この挙動を再現するため、本チャットボットはシンプルなチャットボットを
複数 web worker として動作させ、それらの取りまとめを別の web worker が行う構成とし、
前者をpart、後者をcentralと呼ぶ。アプリケーションのAPIはcentralが担当する。

## ユーザ用チャットボット初期化の手順
ユーザは自分用のチャットボットを一つ保有する。
アプリ起動時にはチャットボットは未定義状態で始まり、
ユーザや環境からのinputメッセージを受け取ったら類似度行列を利用して返答を行う。
類似度行列がメモリ中にない場合firestore上からschemeをダウンロードを行して
行列計算を行う。firestore上にデータがない場合サイト上の/chatbot/schemeに.json形式
で格納されたものをアップロードする。re上のschemeをロードして使用する。

action名        response
必要フラグ 　   matrixize
処理            返答の開始        

action名        matrixize
必要フラグ      download
処理            central workerを起動し、dexieDBのスクリプトで類似度行列を
                計算してメモリに保持。dexieDBの複合語辞書を利用

action名        download
必要フラグ      update_script
処理            スクリプトをfirestoreからdexieDBにコピー

action名        update_scheme
必要フラグ      なし
処理            firestore上にチャットボットの最新データ(.json)をコピー
                複合語辞書をdexieDB上にコピー

これらの制約充足の管理にはactionsを使う。
actions['matrix_load'] = 'req' リクエストされた
actions['matrix_load'] = 'done' 完了した


## API
チャットボットモジュールは web worker として設計されており、postMessage()を利用して
メインスレッドのスクリプトと通信する。




### ユーザ発言の発信
投入メッセージ { type: 'user_input', name, text }

ユーザ発言はすべてのpartとcentralが受け取る。これを受けたpartは内部的な応答メッセージ
{type: 'internal_speech', name, text, score } をポストする。

### チャットボット発言の発信
応答メッセージ { type: 'bot_speech', name, text, state }

centralは{type: 'user_speech'}を受け取ったら受信まち状態になり、すべてのpartから
{type: 'internal_speech'}を受け取るまで待つ、それらのうち最もスコアの高いものを選び
nameには起源となったpartの名前を格納してこのメッセージとしてポストする。

### 環境からの入力
投入メッセージ {type: 'environment_input', name, text}
ユーザの入退室、季節や時刻、天候などの環境の変化が生じた場合このメッセージを投入する。
textには{env.user_login}、{env.morning}などのタグを用いる。{env.*}

## 会話の動作機序

1. {type: 'user_input'}または{type: 'environment_input'}を受け取ったとき、チャットボットが
起動していなければ起動する

2. ユーザが発言した場合、それを{type: 'user_input'}として投入する。
このメッセージはすべてのpartが受取り、必要な場合結果を{type:'internal_speech}
としてを投入する。

3. {type: 'environment'}が投入されたらすべてのpartがそれを受取り、必要に応じて
結果を{type:'internal_speech'}として投入する。

4. centralは設定した期間の間{type: 'internal_speech'}を受取り、その中でスコアが
一定以上で最も高いものを{type: 'bot_speech'}として投入する。スコアが高いものが複数あったら両方を
投入する。この「設定した期間」は幅を持って変動し、4.の動作を繰り返す。

5. partは{type: 'bot_speech'}を受信したとき、それのnameが自分と同じであった場合
設定した確率で次回の発言スコアを設定した量増やす。nameが自分と異なっていた場合は
改めて{type: 'internal_speech'}を発行するが、このときのスコアは設定した値に弱める。


## 各workerの定義

### main 

firestoreに格納するデータ
scheme {   
    schemeName,      // 型式名(キャラクタの呼び名ではない)
    ownerUID,        // 使用者のuid
    description,     // 説明
    updatedAt,       // 更新日時
    author,          // 作者名
    avatarDir,       // アバターのディレクトリ
    backgroundColor, // 背景色
    interval: {      // 返答生成の期間
        max,         // 最大(msec)
        min          // 最小(msec)
    },
    response: {
        minIntensity, // 応答する最小の強度
    },
    memory: {
        "{BOT_NAME}", // チャットボットの名前 ...この名前をクエリで利用
        "{I}",          // 一人称のリスト
        "{YOU}",        // 二人称のリスト
        "{AWAKENING_HOUR}", // 起床時刻
        "{BEDTIME_HOUR}", //就寝時刻
    }
}


mainはメインスクリプトを読み込んで、パートのweb workerを起動する。
会話ではユーザから入力はpostMessageによりすべてのパートに通知される。mainおよび
各パートは返答をpostMessageで発行し、mainはそれらのうち最も強いものを返答とする。
最も強いものが複数あった場合は両方発言する。

### part
part: {
    encoder,            // エンコーダの方式名
    decoder,            // デコーダの方式名
    avatar,             // このパートが発言する際に表示するアバター
    response: {
        minIntensity    // 返答の強度がminIntensity以上だった場合に返答を投入する
        retention       // このパートの発言が採用された場合、retentionの確率で
                        // 次回のminIntensityが無視される
    },
    scrpt,              // スクリプト
}
パートは

パートに
#### ログ型
会話ログをスクリプトとし、返答に採用した行の番号を保持する。
次の発言はその行からの距離が近いと類似度のスコアが加味される。

#### 収集型

このパートはユーザ入力から情報を集め、それらが揃ったときに

## 辞書スクリプト

### IN辞書で使うコマンド
IN辞書ではtagを記述できる。永続性は表記方法で以下のように異なる

表記          例           
-------------------------------------------------------
小文字        tag_name     セッションが終わると消える
頭のみ大文字　Tag_name     永続
大文字        TAG_NAME     システムが利用
-------------------------------------------------------


#### {tag_name}
チャットボットは名前など特定の記憶を保持する。ユーザ入力中にそれが含まれる場合
{tag_name}に変換され、その後辞書で評価される。

#### {?tag_name}  
例えばユーザがチャットボットに与えたニックネームは{nickname}のように格納される。
IN辞書中に{?nickname}があると、{nickname}が定義されていれば{nickname}に変換され、
定義されていなければ空文字列に変換される。これにより「何かを覚えている場合の動作」
を記述できる

#### {?!tag_name}
{?tag_name}と逆で、{memory_name}が定義されていなければ{memory_name}に変換され、
定義されていれば空文字列に変換される。これにより「何かを覚えていない場合の動作」
を記述できる

### OUT辞書で使うコマンド

#### {+tag_name} 
この文字列が見つかった場合、タグを永続的に記憶

#### {-tag_name} 
この文字列が見つかった場合、記憶されたタグがあれば削除

## 機械学習

