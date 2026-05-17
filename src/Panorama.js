// OpenCV.jsを使ったパノラマ合成

// OpenCV.jsの読み込み待ち
const waitForOpenCV = () => {
  return new Promise((resolve) => {
    if (window.cv && window.cv.Mat) {
      resolve();
      return;
    }
    const interval = setInterval(() => {
      if (window.cv && window.cv.Mat) {
        clearInterval(interval);
        resolve();
      }
    }, 100);
  });
};

// dataURLをcv.Matに変換
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

// cv.MatをdataURLに変換
const matToDataURL = (mat) => {
  const canvas = document.createElement('canvas');
  canvas.width = mat.cols;
  canvas.height = mat.rows;
  window.cv.imshow(canvas, mat);
  return canvas.toDataURL('image/jpeg', 0.8);
};

// パノラマ合成メイン関数
export const stitchFrames = async (frames, onProgress) => {
  await waitForOpenCV();
  const cv = window.cv;

  onProgress && onProgress('OpenCV読み込み完了...');

  if (frames.length === 1) {
    return frames[0];
  }

  try {
    onProgress && onProgress('フレームを変換中...');

    // 最初の2フレームで試す（まず動作確認）
    const frame1 = await dataURLToMat(frames[0]);
    const frame2 = await dataURLToMat(frames[Math.floor(frames.length / 2)]);

    onProgress && onProgress('特徴点を検出中...');

    // グレースケールに変換
    const gray1 = new cv.Mat();
    const gray2 = new cv.Mat();
    cv.cvtColor(frame1, gray1, cv.COLOR_RGBA2GRAY);
    cv.cvtColor(frame2, gray2, cv.COLOR_RGBA2GRAY);

    // ORB特徴点検出
    const orb = new cv.ORB(500);
    const kp1 = new cv.KeyPointVector();
    const kp2 = new cv.KeyPointVector();
    const desc1 = new cv.Mat();
    const desc2 = new cv.Mat();

    orb.detectAndCompute(gray1, new cv.Mat(), kp1, desc1);
    orb.detectAndCompute(gray2, new cv.Mat(), kp2, desc2);

    onProgress && onProgress('特徴点をマッチング中...');

    // BFMatcherでマッチング
    const bf = new cv.BFMatcher(cv.NORM_HAMMING, true);
    const matches = new cv.DMatchVector();
    bf.match(desc1, desc2, matches);

    // 良いマッチだけ抽出
    const goodMatches = [];
    for (let i = 0; i < matches.size(); i++) {
      if (matches.get(i).distance < 50) {
        goodMatches.push(matches.get(i));
      }
    }

    onProgress && onProgress(`マッチ数: ${goodMatches.length}点`);

    if (goodMatches.length < 4) {
      // マッチが少なすぎる場合は横に並べる
      onProgress && onProgress('マッチ不足 → 横結合で対応');
      return await sideBySideStitch(frames, onProgress);
    }

    // ホモグラフィ計算
    const srcPoints = [];
    const dstPoints = [];
    goodMatches.forEach(m => {
      const kp = kp1.get(m.queryIdx);
      const kp2pt = kp2.get(m.trainIdx);
      srcPoints.push(kp.pt.x, kp.pt.y);
      dstPoints.push(kp2pt.pt.x, kp2pt.pt.y);
    });

    const srcMat = cv.matFromArray(goodMatches.length, 1, cv.CV_32FC2, srcPoints);
    const dstMat = cv.matFromArray(goodMatches.length, 1, cv.CV_32FC2, dstPoints);
    const H = cv.findHomography(srcMat, dstMat, cv.RANSAC, 5.0);

    onProgress && onProgress('パノラマ合成中...');

    // frame2にframe1をワープして結合
    const result = new cv.Mat();
    const size = new cv.Size(frame1.cols + frame2.cols, frame1.rows);
    cv.warpPerspective(frame1, result, H, size);

    // frame2を右側にコピー
    const roi = result.roi(new cv.Rect(frame1.cols, 0, frame2.cols, frame2.rows));
    frame2.copyTo(roi);

    const resultURL = matToDataURL(result);

    // メモリ解放
    frame1.delete(); frame2.delete();
    gray1.delete(); gray2.delete();
    desc1.delete(); desc2.delete();
    kp1.delete(); kp2.delete();
    matches.delete(); result.delete();
    srcMat.delete(); dstMat.delete(); H.delete();

    onProgress && onProgress('完了！');
    return resultURL;

  } catch (err) {
    console.error('パノラマ合成エラー:', err);
    onProgress && onProgress('合成エラー → 最初のフレームを使用');
    return frames[0];
  }
};

// フォールバック：横に並べるだけ
const sideBySideStitch = async (frames, onProgress) => {
  onProgress && onProgress('横結合中...');
  const canvas = document.createElement('canvas');
  const images = await Promise.all(
    frames.slice(0, 3).map(f => new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.src = f;
    }))
  );
  canvas.width = images.reduce((s, img) => s + img.width, 0);
  canvas.height = images[0].height;
  const ctx = canvas.getContext('2d');
  let x = 0;
  images.forEach(img => {
    ctx.drawImage(img, x, 0);
    x += img.width;
  });
  return canvas.toDataURL('image/jpeg', 0.8);
};