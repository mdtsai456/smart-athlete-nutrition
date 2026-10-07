/**
 * 依菜名選圖。
 * 先比對較長的詞。
 */
const FOOD_EMOJI = [
  ["花椰菜", "🥦"],
  ["高麗菜", "🥬"],
  ["紅蘿蔔", "🥕"],
  ["胡蘿蔔", "🥕"],
  ["馬鈴薯", "🥔"],
  ["青菜", "🥬"],
  ["番茄", "🍅"],
  ["蕃茄", "🍅"],
  ["地瓜", "🍠"],
  ["燕麥", "🥣"],
  ["優格", "🥛"],
  ["起司", "🧀"],
  ["乳酪", "🧀"],
  ["豆腐", "🫘"],
  ["香蕉", "🍌"],
  ["蘋果", "🍎"],
  ["玉米", "🌽"],
  ["土豆", "🥔"],
  ["堅果", "🥜"],
  ["沙拉", "🥗"],
  ["麵包", "🍞"],
  ["鮭", "🐟"],
  ["雞", "🍗"],
  ["飯", "🍚"],
  ["蛋", "🥚"],
  ["魚", "🐟"],
  ["湯", "🍲"],
  ["菜", "🥬"],
  ["菇", "🍄‍🟫"],
  ["豬", "🥩"],
  ["牛", "🥩"],
  ["肉", "🥩"],
  ["蝦", "🦐"],
  ["麵", "🍜"],
  ["粥", "🥣"],
  ["奶", "🥛"],
  ["豆", "🫘"],
];
const RULES = FOOD_EMOJI.toSorted((a, b) => b[0].length - a[0].length);

export function matchFoodEmoji(name) {
  const text = String(name ?? "");
  const hit = RULES.find(([word]) => text.includes(word));
  return hit ? hit[1] : "🥗";
}

export function foodEmoji(food) {
  if (food?.emojiExplicit && food.emoji) return food.emoji;
  return matchFoodEmoji(food?.name);
}
