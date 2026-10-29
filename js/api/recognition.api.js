/** 食物辨識 API。模型金鑰只放在辨識服務，不放在前端。 */
export const recognitionConfig = {
  baseURL: 'http://127.0.0.1:8000',
  path: '/api/predict',
  timeoutMs: 120000,
};

export function validatePhoto(file) {
  if (!(file instanceof Blob) || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error('請選擇 JPG、PNG 或 WebP 照片。');
  if (!file.size || file.size > 10 * 1024 * 1024)
    throw new Error('照片不可為空，且須小於或等於 10 MB。');
}

/** 使用 multipart 的 file 欄位。瀏覽器自行產生 Content-Type boundary。 */
export async function recognizePhoto(file, signal) {
  validatePhoto(file);
  const suffix = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }[file.type];
  const body = new FormData();
  body.append('file', file, `plate${suffix}`);
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(abort, recognitionConfig.timeoutMs);
  try {
    const response = await fetch(`${recognitionConfig.baseURL.replace(/\/$/, '')}${recognitionConfig.path}`, {
      method: 'POST', body, signal: controller.signal,
    });
    const result = await response.json().catch(() => { throw new Error('辨識服務未回傳有效 JSON。'); });
    if (!response.ok || result.succeeded === false)
      throw new Error(result.errorMessage || (typeof result.detail === 'string' ? result.detail : '辨識失敗，請重試。'));
    if (!Array.isArray(result.predictions) && !(result.succeeded === true && Array.isArray(result.items)))
      throw new Error('辨識結果格式不正確。');
    const resultDir = result.resultDir || result.result_dir;
    // 此服務將上傳原圖存為 /uploads/{resultDir}/original.{副檔名}。
    const image = resultDir ? {
      objectKey: `${resultDir}/original${suffix}`,
      url: `${recognitionConfig.baseURL.replace(/\/$/, '')}/uploads/${encodeURIComponent(resultDir)}/original${suffix}`,
      annotatedUrl: `${recognitionConfig.baseURL.replace(/\/$/, "")}/uploads/${encodeURIComponent(resultDir)}/result_boxed.jpg`,
      mimeType: file.type,
    } : null;
    return { ...result, image };
  } catch (error) {
    if (controller.signal.aborted) throw new Error(signal?.aborted ? '已取消辨識。' : '辨識逾時，請重試。');
    if (error instanceof TypeError) throw new Error('無法連線辨識服務，請確認服務網址及跨來源設定。');
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}
