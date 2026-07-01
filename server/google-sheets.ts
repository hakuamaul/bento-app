import { google } from "googleapis";
import { StudentProfile } from "@/types/student-profile";
import { Reservation } from "@/types/reservation";

const sheets = google.sheets("v4");

/**
 * Google Sheets API 用の認証クライアントを作成
 */
function getAuthClient() {
  const projectId = process.env.GOOGLE_SHEETS_PROJECT_ID;
  const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY;
  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;

  if (!projectId || !privateKey || !clientEmail) {
    throw new Error("Google Sheets credentials not configured");
  }

  // プライベートキーの改行をエスケープから実際の改行に変換
  const formattedPrivateKey = privateKey.replace(/\\n/g, "\n");

  return new google.auth.JWT({
    email: clientEmail,
    key: formattedPrivateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

/**
 * 新しいスプレッドシートを作成
 */
export async function createSpreadsheet(title: string): Promise<string> {
  const auth = getAuthClient();
  const drive = google.drive({ version: "v3", auth });

  const spreadsheet = await sheets.spreadsheets.create({
    auth,
    requestBody: {
      properties: {
        title,
      },
      sheets: [
        {
          properties: {
            sheetId: 0,
            title: "基本情報",
          },
        },
        {
          properties: {
            sheetId: 1,
            title: "注文",
          },
        },
      ],
    },
  });

  const spreadsheetId = spreadsheet.data.spreadsheetId;
  if (!spreadsheetId) {
    throw new Error("Failed to create spreadsheet");
  }

  // スプレッドシートを共有可能に設定
  await drive.permissions.create({
    fileId: spreadsheetId,
    requestBody: {
      role: "reader",
      type: "anyone",
    },
  });

  return spreadsheetId;
}

/**
 * 基本情報シートに学生情報を書き込む
 */
export async function writeStudentProfile(
  spreadsheetId: string,
  profile: StudentProfile
): Promise<void> {
  const auth = getAuthClient();

  // 属性ラベルの変換
  const categoryLabels: Record<string, string> = {
    undergraduate_1: "学部生 1年",
    undergraduate_2: "学部生 2年",
    undergraduate_3: "学部生 3年",
    undergraduate_4: "学部生 4年",
    graduate: "大学院生",
    staff: "教職員",
    other: "その他",
  };
  const categoryLabel = categoryLabels[profile.category] ?? profile.category;

  // ヘッダー行
  const headers = [["\u6c0f\u540d", "\u5c5e\u6027", "\u5b66\u7c4d\u756a\u53f7", "\u96fb\u8a71\u756a\u53f7", "\u30e1\u30fc\u30eb\u30a2\u30c9\u30ec\u30b9", "\u767b\u9332\u65e5"]];

  // データ行
  const data = [
    [
      profile.name,
      categoryLabel,
      profile.studentId ?? "",
      profile.phone,
      profile.email,
      new Date(profile.createdAt).toLocaleDateString("ja-JP"),
    ],
  ];

  // ヘッダーを書き込む
  await sheets.spreadsheets.values.update({
    auth,
    spreadsheetId,
    range: "基本情報!A1:F1",
    valueInputOption: "RAW",
    requestBody: {
      values: headers,
    },
  });

  // データを書き込む
  await sheets.spreadsheets.values.update({
    auth,
    spreadsheetId,
    range: "基本情報!A2:F2",
    valueInputOption: "RAW",
    requestBody: {
      values: data,
    },
  });
}

/**
 * 注文シートにデータを追記する
 */
export async function appendReservation(
  spreadsheetId: string,
  reservation: Reservation
): Promise<void> {
  const auth = getAuthClient();

  // 最初の追記の場合、ヘッダーを書き込む
  const existingData = await sheets.spreadsheets.values.get({
    auth,
    spreadsheetId,
    range: "注文!A1:F1",
  });

  if (!existingData.data.values || existingData.data.values.length === 0) {
    const headers = [["予約ID", "学生名", "受け取り日", "メニュー", "合計金額", "備考"]];
    await sheets.spreadsheets.values.update({
      auth,
      spreadsheetId,
      range: "注文!A1:F1",
      valueInputOption: "RAW",
      requestBody: {
        values: headers,
      },
    });
  }

  // メニューを「；」で区切った形式で出力
  const menuSummary = reservation.orderItems
    .map((o) => `${o.menuName}×${o.quantity}`)
    .join("；");

  const row = [
    [
      reservation.id,
      reservation.studentName,
      reservation.pickupDate,
      menuSummary,
      reservation.totalPrice,
      reservation.notes || "",
    ],
  ];

  await sheets.spreadsheets.values.append({
    auth,
    spreadsheetId,
    range: "注文!A:F",
    valueInputOption: "RAW",
    requestBody: {
      values: row,
    },
  });
}

/**
 * スプレッドシートの URL を取得
 */
export function getSpreadsheetUrl(spreadsheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
}


/**
 * 集計シートを作成・初期化する
 */
export async function createSummarySheet(
  spreadsheetId: string,
  menuItems: Array<{ id: string; name: string; price: number }>
): Promise<void> {
  const auth = getAuthClient();

  // 既存のシートを確認
  const spreadsheet = await sheets.spreadsheets.get({
    auth,
    spreadsheetId,
  });

  const sheetExists = spreadsheet.data.sheets?.some(
    (s) => s.properties?.title === "集計"
  );

  // 集計シートが存在しない場合は作成
  if (!sheetExists) {
    await sheets.spreadsheets.batchUpdate({
      auth,
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: "集計",
                sheetId: 2,
              },
            },
          },
        ],
      },
    });
  }

  // 集計シートのヘッダーを作成
  const headers = [
    [
      "メニュー",
      "価格",
      "1年",
      "2年",
      "3年",
      "4年",
      "合計",
      "売上",
    ],
  ];

  // メニューごとの行を作成
  const menuRows = menuItems.map((item) => [
    item.name,
    item.price,
    0, // 1年
    0, // 2年
    0, // 3年
    0, // 4年
    "=SUM(C:C)", // 合計（後で更新される）
    "=B*G", // 売上
  ]);

  const allData = [...headers, ...menuRows];

  await sheets.spreadsheets.values.update({
    auth,
    spreadsheetId,
    range: "集計!A1:H100",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: allData,
    },
  });
}

/**
 * 集計シートを更新する
 */
export async function updateSummarySheet(
  spreadsheetId: string,
  reservation: Reservation
): Promise<void> {
  const auth = getAuthClient();

  // 注文シートから全データを取得
  const allReservations = await sheets.spreadsheets.values.get({
    auth,
    spreadsheetId,
    range: "注文!A:F",
  });

  if (!allReservations.data.values) {
    return;
  }

  // メニュー別・学年別の集計を計算
  const summary: Record<string, Record<string, number>> = {};

  // ヘッダー行をスキップ
  for (let i = 1; i < allReservations.data.values.length; i++) {
    const row = allReservations.data.values[i] as any[];
    if (!row || row.length < 4) continue;

    const menuSummary = String(row[3]); // "メニュー1×数量；メニュー2×数量" 形式
    const gradeStr = String(row[2]); // 学年情報

    // メニューを解析
    if (menuSummary) {
      const menus: string[] = menuSummary.split("；");
      for (const menu of menus) {
        const match = menu.match(/(.+?)×(\d+)/);
        if (match) {
          const menuName = match[1];
          const quantity = parseInt(match[2], 10);

          if (!summary[menuName]) {
            summary[menuName] = { "1年": 0, "2年": 0, "3年": 0, "4年": 0 };
          }

          // 学年ごとに集計
          const gradeKey = `${gradeStr}年`;
          if (summary[menuName][gradeKey] !== undefined) {
            summary[menuName][gradeKey] += quantity;
          }
        }
      }
    }
  }

  // 集計シートを更新
  const updateRows = Object.entries(summary).map(([menuName, counts]) => [
    menuName,
    0, // 価格は別途設定
    counts["1年"],
    counts["2年"],
    counts["3年"],
    counts["4年"],
    `=SUM(C${Object.keys(summary).indexOf(menuName) + 2}:F${Object.keys(summary).indexOf(menuName) + 2})`,
    `=B${Object.keys(summary).indexOf(menuName) + 2}*G${Object.keys(summary).indexOf(menuName) + 2}`,
  ]);

  if (updateRows.length > 0) {
    await sheets.spreadsheets.values.update({
      auth,
      spreadsheetId,
      range: "集計!A2:H100",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: updateRows,
      },
    });
  }
}
