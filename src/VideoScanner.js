import { useRef, useState, useEffect, useCallback } from 'react';
import { stitchFrames } from './Panorama';

function VideoScanner({ pixelsPerCm, onComplete }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const framesRef = useRef([]);
  const [isScanning, setIsScanning] = useState(false);
  const [frameCount, setFrameCount] = useState(0);
  const [status, setStatus] = useState('ready');
  const [progressLog, setProgressLog] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');

  const addLog = (msg) => {
    setProgressLog(prev => [...prev, msg]);
  };

  const capture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    if (video.readyState !== 4) {
      animFrameRef.current = requestAnimationFrame(capture);
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    framesRef.current.push(canvas.toDataURL('image/jpeg', 0.5));
    setFrameCount(framesRef.current.length);
    animFrameRef.current = requestAnimationFrame(capture);
  }, []);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMsg('このブラウザはカメラに対応していません');
      return;
    }
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    })
    .then((stream) => {
      if (videoEl) {
        videoEl.srcObject = stream;
        videoEl.play().catch((e) => setErrorMsg('play error: ' + e.message));
      }
    })
    .catch((err) => {
      setErrorMsg(err.name + ': ' + err.message);
    });
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (videoEl && videoEl.srcObject) {
        videoEl.srcObject.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const startScan = () => {
    framesRef.current = [];
    setFrameCount(0);
    setIsScanning(true);
    setStatus('scanning');
    setProgressLog([]);
    animFrameRef.current = requestAnimationFrame(capture);
  };

  const stopScan = async () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    setIsScanning(false);
    const frames = framesRef.current;
    if (!frames || frames.length === 0) {
      alert('フレームが取得できませんでした。');
      setStatus('ready');
      return;
    }
    setStatus('stitching');
    setProgressLog([]);

    const step = Math.max(1, Math.floor(frames.length / 10));
    const selectedFrames = frames.filter((_, i) => i % step === 0).slice(0, 10);
    addLog(`フレーム数: ${frames.length} → ${selectedFrames.length}枚選択`);

    const panorama = await stitchFrames(selectedFrames, (msg) => {
      addLog(msg);
    });

   setStatus('done');
    addLog('→ 3秒後に次の画面へ');
    setTimeout(() => {
      onComplete && onComplete({
        imageUrl: panorama,
        frameCount: frames.length,
        pixelsPerCm
      });
    }, 3000);
  };

  return (
    <div style={{ width: '100%', maxWidth: '480px' }}>
      {errorMsg && (
        <div style={{ color: 'red', fontSize: '12px', marginBottom: '8px', textAlign: 'center' }}>
          {errorMsg}
        </div>
      )}

      <div style={{
        textAlign: 'center', fontSize: '13px', marginBottom: '8px',
        color: status === 'scanning' ? '#00FF88' : '#aaa'
      }}>
        {status === 'ready' && 'スキャン開始を押してください'}
        {status === 'scanning' && `スキャン中... ${frameCount}フレーム`}
        {status === 'stitching' && 'パノラマ合成中...'}
        {status === 'done' && '✓ 完了'}
      </div>

      {/* ログ表示（常に表示） */}
      {progressLog.length > 0 && (
        <div style={{
          backgroundColor: '#1a1a1a', borderRadius: '8px',
          padding: '10px', marginBottom: '8px',
          fontSize: '11px', color: '#aaa',
          maxHeight: '150px', overflowY: 'auto'
        }}>
          {progressLog.map((log, i) => (
            <div key={i} style={{ marginBottom: '2px' }}>{log}</div>
          ))}
        </div>
      )}

      {status !== 'stitching' && (
        <div style={{
          position: 'relative', width: '100%', height: '300px',
          backgroundColor: '#000', borderRadius: '12px', overflow: 'hidden'
        }}>
          <video
            ref={videoRef}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            playsInline muted
          />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
          {isScanning && (
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              border: '3px solid #00FF88', borderRadius: '12px',
              pointerEvents: 'none'
            }}>
              <div style={{
                position: 'absolute', top: '10px', left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: 'rgba(0,255,136,0.2)',
                color: '#00FF88', padding: '4px 12px',
                borderRadius: '20px', fontSize: '12px', whiteSpace: 'nowrap'
              }}>
                ● REC {frameCount}f
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
        {!isScanning && status !== 'stitching' ? (
          <button
            onClick={startScan}
            style={{
              flex: 1, padding: '14px',
              backgroundColor: '#FF6200', color: 'white',
              border: 'none', borderRadius: '12px',
              fontSize: '16px', cursor: 'pointer'
            }}
          >
            🎬 スキャン開始
          </button>
        ) : status === 'scanning' ? (
          <button
            onClick={stopScan}
            style={{
              flex: 1, padding: '14px',
              backgroundColor: '#00FF88', color: '#000',
              border: 'none', borderRadius: '12px',
              fontSize: '16px', cursor: 'pointer', fontWeight: 'bold'
            }}
          >
            ■ スキャン完了
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default VideoScanner;