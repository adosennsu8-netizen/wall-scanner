import { useState, useEffect, useRef, useCallback } from 'react';
import { detectArUco } from './ArUcoDetector';

const CARD_WIDTH_CM = 14.8;
const CARD_HEIGHT_CM = 21.0;
const HOLD_FRAMES = 30; // 約1秒キープで認証

function GuideFrame({ onCalibrated }) {
  const [status, setStatus] = useState('waiting');
  const [holdCount, setHoldCount] = useState(0);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const holdCountRef = useRef(0);
  const statusRef = useRef('waiting');

  // 認証音
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

  const detect = useCallback(() => {
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
      // カード検出された
      if (statusRef.current === 'waiting') {
        statusRef.current = 'aligned';
        setStatus('aligned');
      }
      holdCountRef.current += 1;
      setHoldCount(holdCountRef.current);

      // HOLD_FRAMES分キープで自動認証
      if (holdCountRef.current >= HOLD_FRAMES && statusRef.current !== 'done') {
        statusRef.current = 'done';
        setStatus('done');
        playBeep();
        onCalibrated && onCalibrated({
          pixelsPerCm: result.pixelsPerCm,
          cardWidthCm: CARD_WIDTH_CM,
          cardHeightCm: CARD_HEIGHT_CM
        });
        return;
      }
    } else {
      // カードが外れた
      if (statusRef.current === 'aligned') {
        statusRef.current = 'waiting';
        setStatus('waiting');
        holdCountRef.current = 0;
        setHoldCount(0);
      }
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
    .catch(() => alert('カメラの許可が必要です。'));

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      const video = videoRef.current;
      if (video && video.srcObject) {
        video.srcObject.getTracks().forEach(t => t.stop());
      }
    };
  }, [detect]);

  const progress = Math.round((holdCount / HOLD_FRAMES) * 100);

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: '480px' }}>

      {/* ガイドテキスト */}
      <div style={{
        textAlign: 'center',
        padding: '8px',
        fontSize: '13px',
        color: status === 'aligned' ? '#00FF88' : status === 'done' ? '#00BFFF' : '#FF6200',
        marginBottom: '8px'
      }}>
        {status === 'waiting' && 'カードを枠の中に合わせてください'}
        {status === 'aligned' && `✓ 検出中... ${progress}%`}
        {status === 'done' && '✓ 認証完了！'}
      </div>

      {/* カメラ映像 */}
      <div style={{
        position: 'relative',
        width: '100%',
        height: '360px',
        backgroundColor: '#000',
        borderRadius: '12px',
        overflow: 'hidden'
      }}>
        <video
          ref={videoRef}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          playsInline
          muted
        />
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* 固定枠 */}
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '148px',
          height: '210px',
          border: `3px solid ${status === 'done' ? '#00BFFF' : status === 'aligned' ? '#00FF88' : '#FF6200'}`,
          borderRadius: '4px',
          boxSizing: 'border-box',
          transition: 'border-color 0.2s'
        }}>
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: status === 'aligned' ? '#00FF88' : '#FF6200',
            fontSize: '11px',
            textAlign: 'center',
            whiteSpace: 'nowrap'
          }}>
            {CARD_WIDTH_CM}cm × {CARD_HEIGHT_CM}cm
          </div>
        </div>

        {/* プログレスバー */}
        {status === 'aligned' && (
          <div style={{
            position: 'absolute',
            bottom: '8px',
            left: '10%',
            width: '80%',
            height: '4px',
            backgroundColor: '#333',
            borderRadius: '2px'
          }}>
            <div style={{
              width: `${progress}%`,
              height: '100%',
              backgroundColor: '#00FF88',
              borderRadius: '2px',
              transition: 'width 0.05s'
            }} />
          </div>
        )}
      </div>
    </div>
  );
}

export default GuideFrame;