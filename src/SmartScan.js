import { useState, useRef, useEffect, useCallback } from 'react';
import WallMarker from './WallMarker';

const EDGE_RATIO = 0.15;

function SmartScan({ pixelsPerCm: initialPpc, corners, onComplete }) {
  const [phase, setPhase] = useState('shooting');
  const [shots, setShots] = useState([]);
  const [capturedImage, setCapturedImage] = useState(null);
  const [ghostDataUrl, setGhostDataUrl] = useState(null);
  const [pixelsPerCm, setPixelsPerCm] = useState(initialPpc);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const distanceOffsetRef = useRef(0);
  const lastAccelZRef = useRef(null);
  const calibDataRef = useRef(null);
  useEffect(() => {
    if (corners) {
      calibDataRef.current = { corners, pixelsPerCm: initialPpc };
    }
  }, [corners, initialPpc]);
  useEffect(() => {
    if (phase !== 'shooting') return;
    const videoEl = videoRef.current;
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
    }).then(stream => {
      if (videoEl) { videoEl.srcObject = stream; videoEl.play().catch(() => {}); }
    }).catch(err => console.error(err));
    return () => {
      if (videoEl && videoEl.srcObject)
        videoEl.srcObject.getTracks().forEach(t => t.stop());
    };
  }, [phase]);

  useEffect(() => {
    const handleMotion = (e) => {
      const acc = e.accelerationIncludingGravity;
      if (!acc || acc.z == null) return;
      if (lastAccelZRef.current === null) { lastAccelZRef.current = acc.z; return; }
      const dz = acc.z - lastAccelZRef.current;
      distanceOffsetRef.current += dz * 0.008;
      lastAccelZRef.current = acc.z;
    };
    window.addEventListener('devicemotion', handleMotion);
    return () => window.removeEventListener('devicemotion', handleMotion);
  }, []);

  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

  // 透視補正
    try {
      if (window.cv && window.cv.Mat && calibDataRef.current) {
        const { corners } = calibDataRef.current;
        const W = canvas.width;
        const H = canvas.height;

        // カードの傾きから補正行列を計算
        const srcPts = window.cv.matFromArray(4, 1, window.cv.CV_32FC2, [
          corners[0].x, corners[0].y,
          corners[1].x, corners[1].y,
          corners[2].x, corners[2].y,
          corners[3].x, corners[3].y
        ]);

        // カードの横幅・縦幅をピクセルで計算
        const cardW = Math.sqrt(
          Math.pow(corners[1].x - corners[0].x, 2) +
          Math.pow(corners[1].y - corners[0].y, 2)
        );
        const cardH = Math.sqrt(
          Math.pow(corners[3].x - corners[0].x, 2) +
          Math.pow(corners[3].y - corners[0].y, 2)
        );

        // カードの実際のアスペクト比（9.1:5.5）で補正後の座標を計算
        const aspect = 9.1 / 5.5;
        const correctedH = cardW / aspect;

        // カードの左上を基準に補正後の4隅を設定
        const cx = corners[0].x;
        const cy = corners[0].y;

        const dstPts = window.cv.matFromArray(4, 1, window.cv.CV_32FC2, [
          cx, cy,
          cx + cardW, cy,
          cx + cardW, cy + correctedH,
          cx, cy + correctedH
        ]);

        const src = window.cv.imread(canvas);
        const dst = new window.cv.Mat();
        const M = window.cv.getPerspectiveTransform(srcPts, dstPts);
        const dsize = new window.cv.Size(W, H);
        window.cv.warpPerspective(src, dst, M, dsize);
        window.cv.imshow(canvas, dst);
        src.delete(); dst.delete(); M.delete(); srcPts.delete(); dstPts.delete();
      }
    } catch(e) {
      console.log('透視補正スキップ:', e.message);
    }

    // 右端をゴーストとして保存
    const edgeW = Math.floor(canvas.width * EDGE_RATIO);
    const edgeCanvas = document.createElement('canvas');
    edgeCanvas.width = edgeW;
    edgeCanvas.height = canvas.height;
    const edgeCtx = edgeCanvas.getContext('2d');
    edgeCtx.drawImage(canvas, canvas.width - edgeW, 0, edgeW, canvas.height, 0, 0, edgeW, canvas.height);
    setGhostDataUrl(edgeCanvas.toDataURL('image/jpeg', 0.6));

    // 距離補正
    const correction = Math.max(0.75, Math.min(1.4, 1 + distanceOffsetRef.current));
    setPixelsPerCm(initialPpc * correction);
    distanceOffsetRef.current = 0;
    lastAccelZRef.current = null;

    setCapturedImage(canvas.toDataURL('image/jpeg', 0.85));
    setPhase('marking');
  }, [initialPpc]);

  const handleMarkComplete = (result) => {
    setShots(prev => [...prev, {
      id: prev.length + 1,
      wall: parseFloat(result.wall),
      exclude: parseFloat(result.exclude),
      net: parseFloat(result.net),
      excludeCount: result.excludeCount
    }]);
    setCapturedImage(null);
    setPhase('shooting');
  };

  const handleFinish = () => {
    const totalWall = shots.reduce((s, sc) => s + sc.wall, 0);
    const totalExclude = shots.reduce((s, sc) => s + sc.exclude, 0);
    const totalNet = shots.reduce((s, sc) => s + sc.net, 0);
    onComplete && onComplete({
      wall: totalWall.toFixed(2),
      exclude: totalExclude.toFixed(2),
      net: totalNet.toFixed(2),
      excludeCount: shots.reduce((s, sc) => s + sc.excludeCount, 0)
    });
  };

  const isFirst = shots.length === 0;

  return (
    <div style={{ width: '100%', maxWidth: '480px' }}>

      {shots.length > 0 && phase === 'shooting' && (
        <div style={{
          backgroundColor: '#1a1a1a', borderRadius: '12px',
          padding: '12px', marginBottom: '12px', border: '1px solid #333'
        }}>
          {shots.map(sc => (
            <div key={sc.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '13px' }}>
              <span style={{ color: '#aaa' }}>#{sc.id}</span>
              <span style={{ color: 'white' }}>{sc.net} m²</span>
            </div>
          ))}
          <div style={{ borderTop: '1px solid #333', marginTop: '8px', paddingTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#aaa', fontSize: '13px' }}>合計</span>
            <span style={{ color: '#FF6200', fontWeight: 'bold', fontSize: '14px' }}>
              {shots.reduce((s, sc) => s + sc.net, 0).toFixed(2)} m²
            </span>
          </div>
        </div>
      )}

      {phase === 'shooting' && (
        <>
          <div style={{ textAlign: 'center', fontSize: '13px', color: '#aaa', marginBottom: '8px' }}>
            {isFirst
              ? '1枚目：壁を撮影してください'
              : `${shots.length + 1}枚目：左のゴーストに前回の右端を合わせて`}
          </div>

          <div style={{ position: 'relative', width: '100%', height: '300px', backgroundColor: '#000', borderRadius: '12px', overflow: 'hidden' }}>
            <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} playsInline muted />

            {/* ゴーストオーバーレイ */}
            {ghostDataUrl && !isFirst && (
              <img
                src={ghostDataUrl}
                alt="ghost"
                style={{
                  position: 'absolute', top: 0, left: 0,
                  width: `${EDGE_RATIO * 100}%`, height: '100%',
                  objectFit: 'cover', opacity: 0.45,
                  borderRight: '2px dashed #00FF88'
                }}
              />
            )}

            {/* 左エンドライン */}
            {!isFirst && (
              <div style={{
                position: 'absolute', top: 0, bottom: 0,
                left: `${EDGE_RATIO * 100}%`, width: '2px',
                backgroundColor: '#00FF88'
              }}>
                <div style={{
                  position: 'absolute', top: '8px', left: '6px',
                  color: '#00FF88', fontSize: '10px', whiteSpace: 'nowrap'
                }}>← 合わせる</div>
              </div>
            )}

            {/* 右エンドライン */}
            <div style={{
              position: 'absolute', top: 0, bottom: 0,
              right: `${EDGE_RATIO * 100}%`, width: '2px',
              backgroundColor: '#FF4444'
            }}>
              <div style={{
                position: 'absolute', top: '8px', right: '6px',
                color: '#FF4444', fontSize: '10px', whiteSpace: 'nowrap'
              }}>次の基準 →</div>
            </div>

            {!isFirst && (
              <div style={{
                position: 'absolute', top: '8px', left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: 'rgba(0,0,0,0.65)',
                color: '#00FF88', padding: '3px 10px',
                borderRadius: '12px', fontSize: '11px', whiteSpace: 'nowrap'
              }}>
                半透明の部分に前回の右端を合わせて
              </div>
            )}
          </div>

          <canvas ref={canvasRef} style={{ display: 'none' }} />

          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button
              onClick={handleCapture}
              style={{
                flex: 2, padding: '14px',
                backgroundColor: '#FF6200', color: 'white',
                border: 'none', borderRadius: '12px',
                fontSize: '16px', cursor: 'pointer'
              }}
            >
              📷 撮影
            </button>
            {shots.length > 0 && (
              <button
                onClick={handleFinish}
                style={{
                  flex: 1, padding: '14px',
                  backgroundColor: '#00BFFF', color: 'white',
                  border: 'none', borderRadius: '12px',
                  fontSize: '14px', cursor: 'pointer'
                }}
              >
                完了({shots.length}枚)
              </button>
            )}
          </div>
        </>
      )}

      {phase === 'marking' && capturedImage && (
        <div>
          <p style={{ color: '#aaa', fontSize: '13px', marginBottom: '8px', textAlign: 'center' }}>
            #{shots.length + 1} 壁を囲んでください
          </p>
          <WallMarker
            imageUrl={capturedImage}
            pixelsPerCm={pixelsPerCm}
            onComplete={handleMarkComplete}
          />
          <button
            onClick={() => { setCapturedImage(null); setPhase('shooting'); }}
            style={{
              marginTop: '10px', width: '100%', padding: '10px',
              backgroundColor: 'transparent', color: '#555',
              border: '1px solid #333', borderRadius: '8px',
              cursor: 'pointer', fontSize: '12px'
            }}
          >
            撮り直す
          </button>
        </div>
      )}
    </div>
  );
}

export default SmartScan;