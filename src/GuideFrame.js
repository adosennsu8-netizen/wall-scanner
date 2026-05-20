/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useRef, useCallback } from 'react';
import { detectArUco } from './ArUcoDetector';

const CARD_WIDTH_CM = 9.1;
const CARD_HEIGHT_CM = 5.5;
const HOLD_FRAMES = 5;
const ALIGN_TOLERANCE = 0.5; // 枠サイズの15%以内のズレを許容

function GuideFrame({ onCalibrated }) {
  const [status, setStatus] = useState('waiting');
  const [holdCount, setHoldCount] = useState(0);
  const [message, setMessage] = useState('カードを枠の中に合わせてください');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const holdCountRef = useRef(0);
  const doneRef = useRef(false);

  const playBeep = () => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  };

  const isAlignedWithFrame = (corners, canvasWidth, canvasHeight) => {
    // 枠の位置（GuideFrameの固定枠と同じ位置）
    const frameW = 182;
    const frameH = 110;
    const frameLeft = (canvasWidth - frameW) / 2;
    const frameTop = canvasHeight - 20 - frameH;
    const frameRight = frameLeft + frameW;
    const frameBottom = frameTop + frameH;

    const tolerance = frameW * ALIGN_TOLERANCE;

    // カードの4隅
    const cardLeft = Math.min(...corners.map(c => c.x));
    const cardRight = Math.max(...corners.map(c => c.x));
    const cardTop = Math.min(...corners.map(c => c.y));
    const cardBottom = Math.max(...corners.map(c => c.y));

    return (
      Math.abs(cardLeft - frameLeft) < tolerance &&
      Math.abs(cardRight - frameRight) < tolerance &&
      Math.abs(cardTop - frameTop) < tolerance &&
      Math.abs(cardBottom - frameBottom) < tolerance
    );
  };

  const detect = useCallback(() => {
    if (doneRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    if (video.readyState !== 4) {
      animFrameRef.current = requestAnimationFrame(detect);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    const result = detectArUco(canvas);

    if (result && result.valid) {
      const aligned = isAlignedWithFrame(result.corners, canvas.width, canvas.height);

      if (aligned) {
        holdCountRef.current += 1;
        setHoldCount(holdCountRef.current);
        setStatus('aligned');
        setMessage(`読み取り中... ${Math.round((holdCountRef.current / HOLD_FRAMES) * 100)}%`);

        if (holdCountRef.current >= HOLD_FRAMES) {
          doneRef.current = true;
          setStatus('done');
          setMessage('✅ 認証完了！');
          playBeep();
          onCalibrated && onCalibrated({
            pixelsPerCm: result.pixelsPerCm,
            cardWidthCm: CARD_WIDTH_CM,
            cardHeightCm: CARD_HEIGHT_CM
          });
          return;
        }
      } else {
        holdCountRef.current = 0;
        setHoldCount(0);
        setStatus('waiting');
        setMessage('枠にぴったり合わせてください');
      }
    } else {
      holdCountRef.current = 0;
      setHoldCount(0);
      setStatus('waiting');
      setMessage('カードを枠の中に合わせてください');
    }

    animFrameRef.current = requestAnimationFrame(detect);
  }, [onCalibrated]);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
    })
    .then((stream) => {
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
        videoRef.current.onplaying = () => {
          animFrameRef.current = requestAnimationFrame(detect);
        };
      }
    })
    .catch(() => alert('カメラの許可が必要です'));
    const videoEl = videoRef.current;
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (videoEl && videoEl.srcObject) {
        videoEl.srcObject.getTracks().forEach(t => t.stop());
      }
    };
  }, [detect]);

  const progress = Math.round((holdCount / HOLD_FRAMES) * 100);

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: '480px' }}>
      <div style={{
        textAlign: 'center', padding: '8px', fontSize: '13px',
        color: status === 'aligned' ? '#00FF88' : status === 'done' ? '#00BFFF' : '#FF6200',
        marginBottom: '8px'
      }}>
        {message}
      </div>
      <div style={{
        position: 'relative', width: '100%', height: '360px',
        backgroundColor: '#000', borderRadius: '12px', overflow: 'hidden'
      }}>
        <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} playsInline muted />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        <div style={{
          position: 'absolute', bottom: '20px', left: '50%',
          transform: 'translateX(-50%)',
          width: '182px', height: '110px',
          border: `3px solid ${status === 'done' ? '#00BFFF' : status === 'aligned' ? '#00FF88' : '#FF6200'}`,
          borderRadius: '4px', boxSizing: 'border-box'
        }} />
        {status === 'aligned' && (
          <div style={{
            position: 'absolute', bottom: '8px', left: '10%',
            width: '80%', height: '4px', backgroundColor: '#333', borderRadius: '2px'
          }}>
            <div style={{
              width: `${progress}%`, height: '100%',
              backgroundColor: '#00FF88', borderRadius: '2px'
            }} />
          </div>
        )}
      </div>
    </div>
  );
}

export default GuideFrame;