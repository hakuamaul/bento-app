import * as Linking from "expo-linking";
import * as ReactNative from "react-native";

// Bundle IDからスキームを抽出（末尾のセグメントのタイムスタンプ、接頭辞 "manus"）
// 例: "space.manus.my.app.t20240115103045" -> "manus20240115103045"
const bundleId = "space.manus.bento.reservation.t20260407201146";
const timestamp = bundleId.split(".").pop()?.replace(/^t/, "") ?? "";
const schemeFromBundleId = `manus${timestamp}`;

const env = {
  portal: process.env.EXPO_PUBLIC_OAUTH_PORTAL_URL ?? "",
  server: process.env.EXPO_PUBLIC_OAUTH_SERVER_URL ?? "",
  appId: process.env.EXPO_PUBLIC_APP_ID ?? "",
  ownerId: process.env.EXPO_PUBLIC_OWNER_OPEN_ID ?? "",
  ownerName: process.env.EXPO_PUBLIC_OWNER_NAME ?? "",
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? "",
  deepLinkScheme: schemeFromBundleId,
};

export const OAUTH_PORTAL_URL = env.portal;
export const OAUTH_SERVER_URL = env.server;
export const APP_ID = env.appId;
export const OWNER_OPEN_ID = env.ownerId;
export const OWNER_NAME = env.ownerName;
export const API_BASE_URL = env.apiBaseUrl;

/**
 * APIのベースURLを取得します。設定されていない場合は現在のホスト名から自動判定します。
 * 開発環境のMetroは8081、APIサーバーは3000で動作します。
 * URLパターン: https://ポート番号-環境ID.リージョン.ドメイン
 * 
 * 改造ポイント:
 * インターネット上のNetlify（katsuyamalunch.netlify.app）からアクセスされた場合に、
 * Codespaces側で稼働している本番用APIサーバー（ポート3000）へ迷子にならずに
 * 直接データを届けられるよう、通信先の直通アドレスを明示的に指定します。
 */
export function getApiBaseUrl(): string {
  // API_BASE_URLの環境変数が直接設定されている場合はそれを使用
  if (API_BASE_URL) {
    return API_BASE_URL.replace(/\/$/, "");
  }

  // Web環境の場合、現在のホスト名のポート8081（画面用）を3000（API用）に置換して接続先を誘導
  if (ReactNative.Platform.OS === "web" && typeof window !== "undefined" && window.location) {
    const { protocol, hostname } = window.location;

    // 💡 Netlifyの本番公開サイトから注文された場合、Codespacesのデータサーバー（ポート3000）へ通信のパイプを直結
if (hostname === "katsuyamalunch.netlify.app") {
  return "https://silver-invention-g4pwq597qjpwc9w57-3000.app.github.dev"; 
}

    // 開発プレビュー用パターン: 8081-sandboxid... -> 3000-sandboxid...
    const apiHostname = hostname.replace(/^8081-/, "3000-");
    if (apiHostname !== hostname) {
      return `${protocol}//${apiHostname}`;
    }
  }

  // フォールバック（相対URLを使用）
  return "";
}

export const SESSION_TOKEN_KEY = "app_session_token";
export const USER_INFO_KEY = "manus-runtime-user-info";

const encodeState = (value: string) => {
  if (typeof globalThis.btoa === "function") {
    return globalThis.btoa(value);
  }
  const BufferImpl = (globalThis as Record<string, any>).Buffer;
  if (BufferImpl) {
    return BufferImpl.from(value, "utf-8").toString("base64");
  }
  return value;
};

/**
 * OAuthコールバック用のリダイレクトURIを取得します。
 * - Web環境: APIサーバーのコールバックエンドポイントを使用
 * - アプリ環境: ディープリンクスキームを使用
 */
export const getRedirectUri = () => {
  if (ReactNative.Platform.OS === "web") {
    return `${getApiBaseUrl()}/api/oauth/callback`;
  } else {
    return Linking.createURL("/oauth/callback", {
      scheme: env.deepLinkScheme,
    });
  }
};

export const getLoginUrl = () => {
  const redirectUri = getRedirectUri();
  const state = encodeState(redirectUri);

  const url = new URL(`${OAUTH_PORTAL_URL}/app-auth`);
  url.searchParams.set("appId", APP_ID);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};

/**
 * OAuthログインフローを開始します。
 * 
 * アプリ環境（iOS/Android）では、システムブラウザを直接開き、
 * OAuthコールバックがディープリンク経由でアプリに戻るようにします。
 * 
 * Web環境では、単純にログインURLへリダイレクトします。
 */
export async function startOAuthLogin(): Promise<string | null> {
  const loginUrl = getLoginUrl();

  if (ReactNative.Platform.OS === "web") {
    // Web環境の場合はリダイレクト処理
    if (typeof window !== "undefined") {
      window.location.href = loginUrl;
    }
    return null;
  }

  const supported = await Linking.canOpenURL(loginUrl);
  if (!supported) {
    console.warn("[OAuth] ログインURLを開けません: URLスキームがサポートされていません");
    // 必要に応じてエラーをスローするか、エラー状態を返して呼び出し元で処理することを検討
    return null;
  }

  try {
    await Linking.openURL(loginUrl);
  } catch (error) {
    console.error("[OAuth] ログインURLのオープンに失敗しました:", error);
    // 必要に応じて呼び出し元で処理するためにエラーのスローを検討
  }

  // OAuthコールバックはディープリンクを介してアプリを再起動します
  return null;
}