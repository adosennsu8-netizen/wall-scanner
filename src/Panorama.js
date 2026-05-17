// ジャイロ・加速度センサーを使ったパノラマ合成

let motionData = [];

// センサー開始
export const startMotionTracking = () => {
  motionData = [];
  const handler = (e) => {
    motionData.push({
      timestamp: Date.now(),
      rotationAlpha: e.rotationRate?.alpha || 0,
      rotationBeta: e.rotationRate?.beta || 0,
      rotationGamma: e.rotationRate?.gamma || 0,
      accX: e.accelerationIncludingGravity?.x || 0,
      accY: e.accelerationIncludingGravity?.y || 0,
    });
  };
  window.addEventListener('devicemotion', handler);
  return handler;
};

// センサー停止
export const stopMotionTracking = (handler) => {
  window.removeEventListener('devicemotion', handler);
  return motionData;
};

// フレームとモーションデータからパノラマ合成
export const stitchFrames = async (frames, motionLog, pixelsPerCm, onProgress) => {
  onProgress && onProgress('パノラマ合成開始...');

  if (frames.length === 0) return null;
  if (frames.length === 1) return frames[0].dataURL;

  // 各フレームの画像を読み込む
  const loadImage = (dataURL) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = dataURL;
  });

  onProgress && onProgress('フレーム読み込み中...');
  const images = await Promise.all(frames.map(f => loadImage(f.dataURL)));

  const frameW = images[0].width;
  const frameH = images[0].height;

  // モーションデータからカメラの水平移動量を計算
  onProgress && onProgress('移動量を計算中...');

  // 各フレームのX方向オフセットを計算
  const offsets = [0]; // 最初のフレームは0
  for (let i = 1; i < frames.length; i++) {
    const t1 = frames[i - 1].timestamp;
    const t2 = frames[i].timestamp;

    // この区間のモーションデータを取得
    const motions = motionLog.filter(m => m.timestamp >= t1 && m.timestamp <= t2);

    if (motions.length === 0) {
      // モーションデータがない場合はフレームWの10%ずつずらす
      offsets.push(offsets[i - 1] + frameW * 0.1);
      continue;
    }

    // gamma（左右の傾き）の変化からX移動量を推定
    let deltaGamma = 0;
    motions.forEach(m => deltaGamma += m.rotationGamma);
    deltaGamma /= motions.length;

    // gammaの変化をピクセル移動量に変換
    // 1度の回転 ≈ pixelsPerCm * 2cm の移動（経験値）
    const pxPerDegree = (pixelsPerCm || 10) * 2;
    const dx = deltaGamma * pxPerDegree * ((t2 - t1) / 1000);

    offsets.push(offsets[i - 1] + Math.abs(dx));
  }

  onProgress && onProgress('キャンバスに描画中...');

  // 全体の幅を計算
  const totalWidth = Math.round(offsets[offsets.length - 1] + frameW);
  const canvas = document.createElement('canvas');
  canvas.width = Math.min(totalWidth, frameW * frames.length);
  canvas.height = frameH;
  const ctx = canvas.getContext('2d');

  // 後ろのフレームから描画（前のフレームが上書き）
  for (let i = images.length - 1; i >= 0; i--) {
    const x = Math.round(offsets[i]);
    ctx.drawImage(images[i], x, 0);
  }

  onProgress && onProgress('合成完了！');
  return canvas.toDataURL('image/jpeg', 0.8);
};