import { useRef, useState, useEffect, useCallback } from 'react';
import { detectArUco } from './ArUcoDetector';

function VideoScanner({ pixelsPerCm, onComplete }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const framesRef = useRef([]);
  const [isScanning, setIsScanning] = useState(false);
  const [frameCount, setFrameCount] = useState(0);
  const [status, setStatus] = useState('ready');
  const [errorMsg, setErrorMsg] = useState('');

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
    const result = detectArUco(canvas);
    if (result && result.valid) {
      if (framesRef.current.length % 5 === 0) {
        framesRef.current.push(canvas.toDataURL('image/jpeg', 0.6));
        setFrameCount(framesRef.current.length);
      }
    }
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
    animFrameRef.current = requestAnimationFrame(capture);
  };

  const stopScan = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    setIsScanning(false);
    setStatus('done');
    if (framesRef.current.length === 0) {
      alert('有効なフレームが取得できませんでした。');
      setStatus('ready');
      return;
    }
    onComplete && onComplete({
      imageUrl: framesRef.current[0],
      frameCount: framesRef.current.length,
      pixelsPerCm
    });
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
        {status === 'ready' && 'カードを固定してスキャン開始を押してください'}
        {status === 'scanning' && `スキャン中... ${frameCount}フレーム取得`}
        {status === 'done' && `✓ スキャン完了（${frameCount}フレーム）`}
      </div>
      <div style={{
        position: 'relative', width: '100%', height: '360px',
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
      <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
        {!isScanning ? (
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
        ) : (
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
        )}
      </div>
    </div>
  );
}

export default VideoScanner;