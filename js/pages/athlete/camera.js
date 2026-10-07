/**
 * 球員食物攝影機入口。
 * 開啟鏡頭。不保存圖片。
 */
import { startPage } from "../../core/app-shell.js";
import { startPlateCamera } from "../shared/camera.js";
import { view } from "../shared/screens.js";
startPage({
  role: "player",
  route: "camera",
  render: (pageState) => view("camera", pageState.data, "player", pageState.filter, pageState),
  mount() {
    startPlateCamera();
  },
});
