import { athleteForm } from "../components/athlete.js";
import { esc, avatar } from "../components/ui.js";
export function profileView(data) {
  const player = data.players.find((p) => p.id === "p1");
  return `<section class="panel profile-page"><div class="profile-page-heading">${avatar(player)}<div><h2>${esc(player.name)}</h2><p>讓教練與營養師更了解你的訓練與飲食需求</p></div></div><form data-form="my-profile"><h3>基本資料與訓練狀況</h3><p class="muted">體脂率、背號與位置可選填；飲食注意事項若尚未確認可留白。</p>${athleteForm(player)}<div class="form-error" role="alert"></div><div class="profile-save"><p>儲存後同步提供教練與營養師查看。</p><button class="btn primary" type="submit">儲存個人資料</button></div></form></section>`;
}
