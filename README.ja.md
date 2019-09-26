
# ヘッドライン自動翻訳機能付きのニュース モニター 
## 目次

* [概要](#overview)
* [免責事項](#disclaimer)
* [必須要件](#prerequisites)
* [パッケージ](#package)
* [ウィジェットの実行](#monitor)

## <a id="overview"></a>概要
リアルタイム ニュース ウィジェットは、Elektron RealTime (ERT) ストリーミング サービスで提供される機能を利用して、リアルタイムにニュースのヘッドラインおよび記事の本文をブラウザーに配信する、軽量のウェブ ベースのインターフェースです。このバージョンは、Nick Zincone によるオリジナルの [Real-time news widget](https://github.com/Refinitiv-API-Samples/Example.WebSocketAPI.Javascript.NewsMonitor) を改造したものであり、ヘッドラインのリアルタイム翻訳機能が付いたニュース モニターを簡単に作成できることを示す目的で作成されました。ここでは機械翻訳に Google の商用 API を使用していますが、別のベンダーの機械翻訳に簡単に置き換えることができます。

より詳しい情報やコンセプトについては、Developer Community ポータルにある [Real-time News Monitor using Refinitiv Elektron](https://developers.refinitiv.com/content/creating-real-time-news-monitor-app-mrn-and-elektron-websocket-api) ビデオにて説明されています。

![image](images/news.gif)

この記事の内容に関してご不明な点がある場合は、Developer Community の [Q&A Forum](https://community.developers.refinitiv.com) をご利用ください。

***注:** [Developer Community ポータル](https://community.developers.refinitiv.com) で質問をしたり、そのコンテンツを最大限にご活用いただくには、[ユーザー登録](https://developers.thomsonreuters.com/iam/register) または [ログイン](https://developers.thomsonreuters.com/iam/login?destination_path=Lw%3D%3D) が必要です。*

## <a id="disclaimer"></a>免責事項
このプロジェクトで提供されているソースコードは、ヘッドラインの自動翻訳機能付きのリアルタイム ニュース モニターを構築するコンセプトを示す目的だけのために Refinitiv が作成したものです。このコードは、**プロダクション環境には適していません**  (特に Translation API がクライアント サイドからアクセスされるため) 

## <a id="prerequisites"></a>必須要件

使用するソフトウェア コンポーネントおよび API

* [Elektron WebSocket API](https://developers.thomsonreuters.com/elektron/websocket-api-early-access) - Elektron のリアルタイム マーケット データにアクセスするためのインターフェイス
* [Angular JS](https://angularjs.org/) (v1.6.5)- Google による、リッチ HTML アプリケーションを構築するためのクライアント サイドの JavaScript フレームワーク。ページ内のコンテンツをバインドするための簡単且つ直感的な機能を提供するほか、リアルタイム更新のアニメーション視覚フィードバックも提供します。
* [Bootstrap](http://getbootstrap.com/css/) (v3.3.7) - CSS テンプレート
* ERT ストリーミング サービスへのアクセス
* [Google Translate API](https://cloud.google.com/translate/) - コンテンツのニーズに基づいてトレーニングやカスタマイズが行われた Google の機械学習モデルを使用して、言語間の翻訳を動的に行うことができます。 

ブラウザー サポート: 

- [ES2015 の仕様](https://en.wikipedia.org/wiki/ECMAScript#6th_Edition_-_ECMAScript_2015)をサポートしている[ブラウザー](https://kangax.github.io/compat-table/es6/)。

## <a id="package"></a>パッケージ

パッケージには、完全なソース コードと実行に必要なライブラリなどが含まれています。接続してテストするために必要な設定については、社内のマーケット データ チームまたはリフィニティブの担当者までお問い合わせください。パッケージには [ERTController](https://github.com/TR-API-Samples/Example.ERT.Javascript.ERTController) サブモジュールが含まれているため、以下のコマンドを使用してクローンする必要があります:

`git clone --recursive <URL of this package>`

また、Google の API を使用するには、Google から有償で提供されている API キーも必要です。[Google Translation API](https://cloud.google.com/translate/docs/quickstarts)

アプリケーション パッケージには以下が含まれています:

- **ERTController/ERTWebSocketController.js**

- **ERTController/ERTRESTController.js**

  プラットフォームへの認証および Elektron RealTime (ERT) サービスへの通信を管理する一般的なインターフェイス。詳細については、[Example.ERT.Javascript.ERTController](https://github.com/TR-API-Samples/Example.ERT.Javascript.ERTController) を参照してください。

- **newsObject.html, newsObject.js**

  ウィジェットを構築するための Angular JS フレームワークを使用した HTML/JavaScript。

- **css / fonts / js**

  サポートされているテクノロジー: Angular JS、Bootstrap。

## <a id="running"></a>ウィジェットの実行

ニュース モニターは、Elektron Data Platform (EDP)、ローカルに展開された TREP 環境、または Eikon デスクトップを介して (予定) 利用可能な ERT ストリーミング サービスへのアクセスを提供するアプリケーションです。特定の認証プロパティを構成する前に、ストリーミング サービスへのアクセス方法を指定する必要があります。  

*newsObject.js* ファイル内で使用するセッションを指定します:

```javascript
// Application session configuration
// Define the session (TREP, EDP/ERT) you wish to use to access streaming services.  
// To define your session, update the following setting:
//      session: undefined
//
// Eg:  session: 'EDP'     // EDP/ERT Session
//      session: 'ADS'     // TREP/ADS Session
app.constant('config', {
   session: undefined,         // 'ADS' or 'EDP'.
```

使用するセッションを指定したら、以下にある該当するセクションの手順にしたがって設定を行い、ブラウザーでこのウィジェットを実行してください。

**注:** *Eikon* からの ERT ストリーミング サービスへのアクセスは、Eikon デスクトップでのサービスがリリースされてからの提供になります。

### TREP/ADS

ローカルで展開された TREP 環境へのアクセスを設定するには、*newsObject.js* ファイルにサーバーおよび認証情報を記述する必要があります。コード セクションで、以下のようにプロパティを定義します:

```javascript
// TREP (ADS) session.
// This section defines the connection and authentication requirements to connect
// directly into the streaming services from your locally installed TREP installation.
// Load this example directly within your browswer.
adsSession: {
   wsServer: 'ewa',    // Address of our ADS Elektron WebSocket server.  Eg: 'elektron'
   wsPort: '15000',    // Address port of our ADS Elektron Websccket server. Eg: 15000
   wsLogin: {          // Elektron WebSocket login credentials
      user: 'user',              // User name.  Optional.  Default: desktop login.
      appId: '256',              // AppID. Optional.  Default: '256'
      position: '127.0.0.1',     // Position.  Optional. Default: '127.0.0.1'         
   }             
},
```

ウィジェットを実行するには、ブラウザーでファイルを読み込んでください。

### EDP/ERT

ブラウザーからクラウドに接続するためには、ローカル プロキシ内で JavaScript を実行する必要があります。ブラウザーでは、セキュリティ攻撃を防止するために [***Same-origin***](https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy) ポリシー (同一生成元ポリシー) という仕組みが実装されています。  

クラウド上の ERT にアクセスするには、以下の手順で環境を設定してください:

1. インストール ディレクトリ内で、次のコマンドを使用して [Node.js](https://nodejs.org/en/) モジュールをインストールします:  

   **注:** Node.js はご自身の PC にインストールする必要があります。

   ```
   $> npm install
   ```

   これにより、ローカル HTTP サーバーを実行するためのモジュールを含む node_modules/ というローカル ディレクトリが作成されます。

2. アクセス方法を定義します。認証情報を指定するコード セクションをご確認ください。

   ```javascript
   // ERT (Elektron Real Time) in Cloud session.
   // This section defines authenticastion to access EDP (Elektron Data Platform)/ERT.
   // Start the local HTTP server (provided) and within your browser, specify the 
   // URL: http://localhost:8080/quoteObject.html
   edpSession: {
       wsLogin: {
           user: undefined,
           password: undefined,
           clientId: undefined
       } 
   ```

3. Google Translation API の API アクセス キーを指定します。newsObject.js の130行目:

   ```
        // Enter an API key from the Google API Console:
        //   https://console.developers.google.com/apis/credentials
        const apiKey = "enter key here";
   ```

4. サーバーを開始します。

   ```
   $> node server.js
   ```

   これにより、ポート 8080 上でローカル HTTP サーバーが開始されます。

   **注:** 使用している PC がプロキシ サーバーの背後にある場合、以下のコマンドを指定して、プロキシ サーバーを介した接続をするよう Node.js を設定します:

   ```
   set https_proxy=http://<proxy.server>:<port>
   ```

5. 以下の URL 形式を使用してブラウザーでウィジェットを読み込みます:

   ```
   http://localhost:8080/newsObject.html
   ```

### Refinitiv Workspace (リリース予定)

### <a id="contributing"></a>貢献

弊社の行動規範およびプルリクエストのプロセスについては、[CONTRIBUTING.md](https://gist.github.com/PurpleBooth/b24679402957c63ec426) を参照してください。

### <a id="authors"></a>作者

* **Nick Zincone**   - Release 1.0.  *Initial version* (TREP connectivity only)
* **Nick Zincone**   - Release 2.0.  Added connectivity into EDP/ERT in the cloud.
* **James Sullivan** - Release 3.0.  Added machine translation of streaming headlines.

### <a id="license"></a>ライセンス

このプロジェクトは MIT License のもとでライセンスされています - 詳細については [LICENSE.md](LICENSE.md) ファイルをご覧ください。
