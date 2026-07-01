export type PickupTime = "lunch" | "afterschool";
export type MenuCategory = "bento" | "donburi" | "noodles";
export type MenuId = string; // 新しいお弁当のIDに柔軟に対応できるように string に広げます
export type CompanyName = 'アサヒフード' | 'のむき風の郷' | '焼肉味楽' | 'はなまる弁当';

export interface MenuItem {
  id: MenuId;
  name: string;
  price: number;
  category: MenuCategory;
  company: CompanyName; // ★新しく会社名を追加
  availableDays: number[]; // ★新しく提供曜日（1:月〜5:金）を追加
  note?: string;
}

export interface OrderItem {
  menuId: MenuId;
  menuName: string;
  price: number;
  quantity: number;
}

// アプリの他の画面で使う重要な定義
export interface Reservation {
  id: string;
  studentName: string;
  grade: string;
  pickupDate: string; // ISO date string YYYY-MM-DD
  orderItems: OrderItem[]; // 複数メニュー対応
  totalPrice: number;
  notes: string;
  createdAt: string; // ISO datetime string
  status: "confirmed" | "picked_up" | "cancelled";
  paymentStatus: "unpaid" | "paid"; // 支払い状態（デフォルト: unpaid）
}

export const GRADES = ["1年", "2年", "3年", "4年"];

export const CATEGORY_LABELS: Record<MenuCategory, string> = {
  bento: "お弁当",
  donburi: "丼もの",
  noodles: "麺類・その他",
};

// ★会社ごとの締切ルール表示用のデータ
export const COMPANY_RULES: Record<CompanyName, { deadline: string; note: string }> = {
  'アサヒフード': {
    deadline: '当日朝 8:30 まで申し込み可',
    note: '毎日（月〜金）受取可能'
  },
  'のむき風の郷': {
    deadline: '木曜受取 ➔ 火曜11:00まで / 月曜受取 ➔ 金曜11:00まで',
    note: 'お弁当は木曜のみ、丼ものは月・木受取可能'
  },
  '焼肉味楽': {
    deadline: '木曜受取 ➔ 火曜11:00まで / 月曜受取 ➔ 金曜11:00まで',
    note: '月・木受取可能（焼肉特製スタミナメニュー）'
  },
  'はなまる弁当': {
    deadline: '前日午前中（12:00）まで予約可',
    note: '毎日（月〜金）受取可能（新登場！）'
  }
};

// ★4社合同の最新メニューリストに更新
export const MENU_ITEMS: MenuItem[] = [
  // --- アサヒフード（毎日受取可能メニュー） ---
  { id: 'asahi-a', name: '日替わり弁当（おかずのみ・A）', price: 380, category: 'bento', company: 'アサヒフード', availableDays: [1, 2, 3, 4, 5] },
  { id: 'asahi-b', name: '日替わり弁当（おかずのみ・B）', price: 440, category: 'bento', company: 'アサヒフード', availableDays: [1, 2, 3, 4, 5] },
  { id: 'asahi-c', name: '日替わり弁当（おかずのみ・C）', price: 500, category: 'bento', company: 'アサヒフード', availableDays: [1, 2, 3, 4, 5] },
  { id: 'asahi-maku', name: '幕の内弁当', price: 660, category: 'bento', company: 'アサヒフード', availableDays: [1, 2, 3, 4, 5] },
  { id: 'asahi-onigiri-bento', name: 'おにぎり弁当', price: 420, category: 'bento', company: 'アサヒフード', availableDays: [1, 2, 3, 4, 5] },
  { id: 'asahi-onigiri-2', name: 'おにぎり（2個）', price: 300, category: 'noodles', company: 'アサヒフード', availableDays: [1, 2, 3, 4, 5] },
  { id: 'asahi-rice-1', name: 'ごはん（普通）', price: 220, category: 'noodles', company: 'アサヒフード', availableDays: [1, 2, 3, 4, 5] },
  { id: 'asahi-rice-2', name: 'ごはん（大盛）', price: 250, category: 'noodles', company: 'アサヒフード', availableDays: [1, 2, 3, 4, 5] },
  // ✨ チラシ通り、以下の丼もの7種をアサヒフード（毎日 [1,2,3,4,5]）に正しく戻しました！
  { id: 'asahi-don-egg', name: 'たまご丼', price: 550, category: 'donburi', company: 'アサヒフード', availableDays: [1, 2, 3, 4, 5] },
  { id: 'asahi-don-oyako', name: '親子丼', price: 650, category: 'donburi', company: 'アサヒフード', availableDays: [1, 2, 3, 4, 5] },
  { id: 'asahi-don-egg-katsu', name: 'たまごかつ丼', price: 650, category: 'donburi', company: 'アサヒフード', availableDays: [1, 2, 3, 4, 5] },
  { id: 'asahi-don-sauce-katsu', name: 'ソースかつ丼', price: 650, category: 'donburi', company: 'アサヒフード', availableDays: [1, 2, 3, 4, 5] },
  { id: 'asahi-don-ten', name: '天丼', price: 700, category: 'donburi', company: 'アサヒフード', availableDays: [1, 2, 3, 4, 5] },
  { id: 'asahi-don-gyu', name: '牛丼', price: 700, category: 'donburi', company: 'アサヒフード', availableDays: [1, 2, 3, 4, 5] },
  { id: 'asahi-don-karbi', name: '牛カルビ丼', price: 700, category: 'donburi', company: 'アサヒフード', availableDays: [1, 2, 3, 4, 5] },

  // --- のむき風の郷（月・木メニュー） ---
  { id: 'nomuki-bento', name: '風の郷弁当（日替わり）', price: 680, category: 'bento', company: 'のむき風の郷', availableDays: [4] }, // 木曜のみ
  { id: 'nomuki-ten', name: 'えび天丼', price: 650, category: 'donburi', company: 'のむき風の郷', availableDays: [1, 4] },           // 月・木
  { id: 'nomuki-katsu', name: 'とんかつ丼', price: 650, category: 'donburi', company: 'のむき風の郷', availableDays: [1, 4] },         // 月・木
  { id: 'nomuki-skatsu', name: 'ソースかつ丼', price: 650, category: 'donburi', company: 'のむき風の郷', availableDays: [1, 4] },       // 月・木

  // --- 焼肉味楽 ---
  { id: 'miraku-harami', name: '特製ハラミ丼', price: 780, category: 'donburi', company: '焼肉味楽', availableDays: [1, 4] },         // 月・木
  { id: 'miraku-bibimba', name: '特製ビビンバ', price: 680, category: 'donburi', company: '焼肉味楽', availableDays: [1, 4] },        // 月・木

  // --- はなまる弁当 ---
  { id: 'hanamaru-daily', name: '日替わり弁当', price: 650, category: 'bento', company: 'はなまる弁当', availableDays: [1, 2, 3, 4, 5] }
];