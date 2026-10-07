/**
 * 食物攝影機入口。
 * 顯示即時畫面與餐盤框。不保存圖片。
 * 開始記錄的按鈕在 app-shell.js。
 */
import { button } from "../../components/ui.js";

let stream = null;

function cameraFailure(error) {
  if (error?.name === "NotAllowedError") return "請允許瀏覽器使用攝影機";
  if (error?.name === "NotFoundError") return "找不到攝影機";
  if (error?.name === "NotReadableError") return "攝影機正在被其他程式使用";
  return "無法使用攝影機";
}

export function stopPlateCamera() {
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
}

/** 已有鏡頭就接到這個畫面。沒有才開啟。不保存圖片。 */
export async function startPlateCamera(video, note) {
  const view = video || document.querySelector("#plate-camera");
  const label = note || document.querySelector("#plate-camera-note");
  if (!view || !label) return;
  if (stream?.getTracks().some((track) => track.readyState === "live")) {
    view.srcObject = stream;
    try {
      await view.play();
    } catch {
      label.textContent = "無法使用攝影機";
      return;
    }
    label.textContent = "把餐盤放進框裡";
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    label.textContent = "這台瀏覽器無法使用攝影機";
    return;
  }
  const attempts = [
    { video: { facingMode: { ideal: "environment" } }, audio: false },
    { video: true, audio: false },
  ];
  let opened = null;
  let reason = "無法使用攝影機";
  for (const constraints of attempts) {
    try {
      opened = await navigator.mediaDevices.getUserMedia(constraints);
      break;
    } catch (error) {
      opened = null;
      reason = cameraFailure(error);
    }
  }
  if (!view.isConnected) {
    opened?.getTracks().forEach((track) => track.stop());
    return;
  }
  if (!opened) {
    label.textContent = reason;
    return;
  }
  stream = opened;
  view.srcObject = stream;
  try {
    await view.play();
  } catch {
    stopPlateCamera();
    label.textContent = "無法使用攝影機";
    return;
  }
  label.textContent = "把餐盤放進框裡";
}

/** 頁面上還有攝影畫面時不關鏡頭。 */
export function releaseExtraCamera() {
  if (document.querySelector("#plate-camera")) return;
  stopPlateCamera();
}

export function cameraView() {
  return `<section class="panel panel-padded plate-page"><div class="plate-camera"><video id="plate-camera" autoplay playsinline muted></video><div class="plate-frame" aria-hidden="true"></div><p id="plate-camera-note">正在開啟攝影機</p></div><div class="actions">${button("開始記錄", "record", true)}</div></section>`;
}
