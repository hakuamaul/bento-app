const GAS_URL = "https://bento-app-5fp8.onrender.com/proxy";

export async function loadReservations() {
  try {
    const t = await fetch(GAS_URL);
    const e = await t.json();
    return e.orders || [];
  } catch (t) {
    console.error("データ取得失敗", t);
    return [];
  }
}
