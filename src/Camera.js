import { useEffect, useRef, useCallback } from 'react';
import { detectArUco } from './ArUcoDetector';

function Camera({ onDetected, onPhoto }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);

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

    if (result) {
      if (!result.valid) {
        console.log('無効なカードID:', result.id);
      } else {
        console.log('カード検出！ID:', result.id);
        onDetected && onDetected(result);
      }
    }

    animFrameRef.current = requestAnimationFrame(detect);
  }, [onDetected]);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
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
    .catch((err) => {
      console.error('カメラエラー:', err);
      alert('カメラの許可が必要です。');
    });

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      const video = videoRef.current;
      if (video && video.srcObject) {
        video.srcObject.getTracks().forEach(t => t.stop());
      }
    };
  }, [detect]);

  const takePhoto = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const photoUrl = canvas.toDataURL('image/jpeg');
    onPhoto && onPhoto(photoUrl);
  };

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: '480px' }}>
      <video
        ref={videoRef}
        style={{ width: '100%', borderRadius: '12px', display: 'block' }}
        playsInline
        muted
      />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <button
        onClick={takePhoto}
        style={{
          marginTop: '12px',
          width: '100%',
          padding: '14px',
          backgroundColor: '#FF6200',
          color: 'white',
          border: 'none',
          borderRadius: '12px',
          fontSize: '16px',
          cursor: 'pointer'
        }}
      >
        📷 撮影する
      </button>
    </div>
  );
}

export default Camera;