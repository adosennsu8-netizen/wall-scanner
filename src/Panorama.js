const waitForOpenCV = () => {
  return new Promise((resolve, reject) => {
    if (window.cv && window.cv.Mat) { resolve(); return; }
    let count = 0;
    const interval = setInterval(() => {
      count++;
      if (window.cv && window.cv.Mat) { clearInterval(interval); resolve(); }
      if (count > 300) { clearInterval(interval); reject(new Error('タイムアウト')); }
    }, 100);
  });
};

const loadImage = (dataURL) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = dataURL;
  });
};

const dataURLToMat = (dataURL) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const mat = window.cv.matFromImageData(
        ctx.getImageData(0, 0, canvas.width, canvas.height)
      );
      resolve(mat);
    };
    img.src = dataURL;
  });
};

export const stitchFrames = async (frames, onProgress) => {
  try {
    onProgress && onProgress('OpenCV待機中...');
    await waitForOpenCV();
  } catch (err) {
    onProgress && onProgress('OpenCV失敗');
    return frames[0];
  }

  const cv = window.cv;
  if (frames.length === 1) return frames[0];

  try {
    onProgress && onProgress('フレーム読み込み中...');
    const frame1 = await dataURLToMat(frames[0]);
    const frame2 = await dataURLToMat(frames[frames.length - 1]);

    const gray1 = new cv.Mat();
    const gray2 = new cv.Mat();
    cv.cvtColor(frame1, gray1, cv.COLOR_RGBA2GRAY);
    cv.cvtColor(frame2, gray2, cv.COLOR_RGBA2GRAY);

    onProgress && onProgress('特徴点検出中...');
    const orb = new cv.ORB(1000);
    const kp1 = new cv.KeyPointVector();
    const kp2 = new cv.KeyPointVector();
    const desc1 = new cv.Mat();
    const desc2 = new cv.Mat();
    const mask = new cv.Mat();

    orb.detectAndCompute(gray1, mask, kp1, desc1);
    orb.detectAndCompute(gray2, mask, kp2, desc2);

    onProgress && onProgress(`kp1:${kp1.size()} kp2:${kp2.size()}`);

    if (desc1.rows === 0 || desc2.rows === 0) {
      onProgress && onProgress('特徴点なし');
      frame1.delete(); frame2.delete();
      gray1.delete(); gray2.delete();
      return frames[0];
    }

    const bf = new cv.BFMatcher(cv.NORM_HAMMING, true);
    const matches = new cv.DMatchVector();
    bf.match(desc1, desc2, matches);

    const goodMatches = [];
    for (let i = 0; i < matches.size(); i++) {
      if (matches.get(i).distance < 60) {
        goodMatches.push(matches.get(i));
      }
    }

    onProgress && onProgress(`マッチ: ${goodMatches.length}点`);

    if (goodMatches.length < 4) {
      onProgress && onProgress('マッチ不足');
      frame1.delete(); frame2.delete();
      gray1.delete(); gray2.delete();
      desc1.delete(); desc2.delete();
      kp1.delete(); kp2.delete();
      matches.delete(); mask.delete();
      return frames[0];
    }

    onProgress && onProgress('ホモグラフィ計算中...');

    // frame1の点 → frame2の点
    const srcPts = [];
    const dstPts = [];
    goodMatches.forEach(m => {
      const p1 = kp1.get(m.queryIdx).pt;
      const p2 = kp2.get(m.trainIdx).pt;
      srcPts.push(p2.x, p2.y);
      dstPts.push(p1.x, p1.y);
    });

    const srcMat = cv.matFromArray(goodMatches.length, 1, cv.CV_32FC2, srcPts);
    const dstMat = cv.matFromArray(goodMatches.length, 1, cv.CV_32FC2, dstPts);

    // H: frame1 → frame2 への変換行列
    const H = cv.findHomography(srcMat, dstMat, cv.RANSAC, 5.0);

    onProgress && onProgress('パノラマ合成中...');

    // frame1をframe2の座標系にワープ
    const w = frame1.cols + frame2.cols;
    const h = Math.max(frame1.rows, frame2.rows);
    const warped = new cv.Mat();
    cv.warpPerspective(frame2, warped, H, new cv.Size(w, h));

    // 結果canvasに描画
    const resultCanvas = document.createElement('canvas');
    resultCanvas.width = w;
    resultCanvas.height = h;
    const ctx = resultCanvas.getContext('2d');

    // frame1を左側に描画
    const frame1Canvas = document.createElement('canvas');
    frame1Canvas.width = frame1.cols;
    frame1Canvas.height = frame1.rows;
    cv.imshow(frame1Canvas, frame1);
    ctx.drawImage(frame1Canvas, 0, 0);

    // warpedを右側に描画
    const warpedCanvas = document.createElement('canvas');
    warpedCanvas.width = warped.cols;
    warpedCanvas.height = warped.rows;
    cv.imshow(warpedCanvas, warped);
    ctx.drawImage(warpedCanvas, frame1.cols, 0);
    const resultURL = resultCanvas.toDataURL('image/jpeg', 0.8);

    frame1.delete(); frame2.delete();
    gray1.delete(); gray2.delete();
    desc1.delete(); desc2.delete();
    kp1.delete(); kp2.delete();
    matches.delete(); mask.delete();
    srcMat.delete(); dstMat.delete();
    H.delete(); warped.delete();

    onProgress && onProgress('合成完了！');
    return resultURL;

  } catch (err) {
    onProgress && onProgress('エラー: ' + err.message);
    return frames[0];
  }
};