// OpenCV.jsの読み込み待ち（最大30秒）
const waitForOpenCV = () => {
  return new Promise((resolve, reject) => {
    if (window.cv && window.cv.Mat) {
      resolve();
      return;
    }
    let count = 0;
    const interval = setInterval(() => {
      count++;
      if (window.cv && window.cv.Mat) {
        clearInterval(interval);
        resolve();
      }
      if (count > 300) {
        clearInterval(interval);
        reject(new Error('OpenCV読み込みタイムアウト'));
      }
    }, 100);
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
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const mat = window.cv.matFromImageData(imageData);
      resolve(mat);
    };
    img.src = dataURL;
  });
};

const matToDataURL = (mat) => {
  const canvas = document.createElement('canvas');
  canvas.width = mat.cols;
  canvas.height = mat.rows;
  window.cv.imshow(canvas, mat);
  return canvas.toDataURL('image/jpeg', 0.8);
};

export const stitchFrames = async (frames, onProgress) => {
  try {
    onProgress && onProgress('OpenCV読み込み待機中...');
    await waitForOpenCV();
    onProgress && onProgress('OpenCV ✓ ORB:' + (typeof cv.ORB) + ' BFMatcher:' + (typeof cv.BFMatcher));
  } catch (err) {
    onProgress && onProgress('OpenCV読み込み失敗: ' + err.message);
    return frames[0];
  }

  const cv = window.cv;

  if (frames.length === 1) {
    return frames[0];
  }

  try {
    onProgress && onProgress('フレーム変換中...');
    const frame1 = await dataURLToMat(frames[0]);
    const frame2 = await dataURLToMat(frames[frames.length - 1]);

    onProgress && onProgress('グレースケール変換中...');
    const gray1 = new cv.Mat();
    const gray2 = new cv.Mat();
    cv.cvtColor(frame1, gray1, cv.COLOR_RGBA2GRAY);
    cv.cvtColor(frame2, gray2, cv.COLOR_RGBA2GRAY);

    onProgress && onProgress('ORB特徴点検出中...');
    const orb = new cv.ORB(500);
    const kp1 = new cv.KeyPointVector();
    const kp2 = new cv.KeyPointVector();
    const desc1 = new cv.Mat();
    const desc2 = new cv.Mat();
    const mask = new cv.Mat();

    orb.detectAndCompute(gray1, mask, kp1, desc1);
    orb.detectAndCompute(gray2, mask, kp2, desc2);

    onProgress && onProgress(`kp1:${kp1.size()} kp2:${kp2.size()} マッチング中...`);

    const bf = new cv.BFMatcher(cv.NORM_HAMMING, true);
    const matches = new cv.DMatchVector();
    bf.match(desc1, desc2, matches);

    const goodMatches = [];
    for (let i = 0; i < matches.size(); i++) {
      if (matches.get(i).distance < 50) {
        goodMatches.push(matches.get(i));
      }
    }

    onProgress && onProgress(`良いマッチ: ${goodMatches.length}点`);

    if (goodMatches.length < 4) {
      onProgress && onProgress(`マッチ不足(${goodMatches.length}) → 最初のフレームを使用`);
      frame1.delete(); frame2.delete();
      gray1.delete(); gray2.delete();
      desc1.delete(); desc2.delete();
      kp1.delete(); kp2.delete();
      matches.delete(); mask.delete();
      return frames[0];
    }

    onProgress && onProgress('ホモグラフィ計算中...');
    const srcPoints = [];
    const dstPoints = [];
    goodMatches.forEach(m => {
      const p1 = kp1.get(m.queryIdx).pt;
      const p2 = kp2.get(m.trainIdx).pt;
      srcPoints.push(p1.x, p1.y);
      dstPoints.push(p2.x, p2.y);
    });

    const srcMat = cv.matFromArray(goodMatches.length, 1, cv.CV_32FC2, srcPoints);
    const dstMat = cv.matFromArray(goodMatches.length, 1, cv.CV_32FC2, dstPoints);
    const H = cv.findHomography(srcMat, dstMat, cv.RANSAC, 5.0);

    onProgress && onProgress('ワーピング中...');
    const result = new cv.Mat();
    const size = new cv.Size(frame1.cols + frame2.cols, frame1.rows);
    cv.warpPerspective(frame1, result, H, size);

    const roi = result.roi(new cv.Rect(frame1.cols, 0, frame2.cols, frame2.rows));
    frame2.copyTo(roi);

    const resultURL = matToDataURL(result);

    frame1.delete(); frame2.delete();
    gray1.delete(); gray2.delete();
    desc1.delete(); desc2.delete();
    kp1.delete(); kp2.delete();
    matches.delete(); result.delete();
    srcMat.delete(); dstMat.delete();
    H.delete(); mask.delete();

    onProgress && onProgress('パノラマ合成完了！');
    return resultURL;

  } catch (err) {
    onProgress && onProgress('エラー: ' + err.message);
    return frames[0];
  }
};