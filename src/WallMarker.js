import { useRef, useState, useEffect } from 'react';

function WallMarker({ imageUrl, pixelsPerCm, onComplete }) {
  const canvasRef = useRef(null);
  const [points, setPoints] = useState([]);
  const [imageObj, setImageObj] = useState(null);

  // 画像を読み込む
  useEffect(() => {
    if (!imageUrl) return;
    const img = new Image();
    img.onload = () => setImageObj(img);
    img.src = imageUrl;
  }, [imageUrl]);

  // canvasに描画
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // 画像を描画（画像がない場合はグレー背景）
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (imageObj) {
      ctx.drawImage(imageObj, 0, 0, canvas.width, canvas.height);
    } else {
      ctx.fillStyle = '#222';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#444';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('壁の角をタップして囲んでください', canvas.width / 2, canvas.height / 2);
    }

    if (points.length === 0) return;

    // 点と線を描画
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    if (points.length > 2) ctx.closePath();
    ctx.strokeStyle = '#00BFFF';
    ctx.lineWidth = 2;
    ctx.stroke();

    if (points.length > 2) {
      ctx.fillStyle = 'rgba(0, 191, 255, 0.15)';
      ctx.fill();
    }

    // 各点に丸を描画
    points.forEach((p, i) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = i === 0 ? '#00FF88' : '#00BFFF';
      ctx.fill();
      ctx.fillStyle = 'white';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(i + 1, p.x, p.y);
    });
  }, [points, imageObj]);

  // タップで点を追加
  const handleTap = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    setPoints(prev => [...prev, { x, y }]);
  };

  // 面積計算（ショーレース公式）
  const calcArea = () => {
    if (points.length < 3) return;
    let area = 0;
    const n = points.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += points[i].x * points[j].y;
      area -= points[j].x * points[i].y;
    }
    const pixelArea = Math.abs(area) / 2;
    const cm2 = pixelArea / (pixelsPerCm * pixelsPerCm);
    const m2 = cm2 / 10000;
    onComplete && onComplete(m2.toFixed(2));
  };

  return (
    <div style={{ width: '100%', maxWidth: '480px' }}>
      <p style={{ color: '#aaa', fontSize: '12px', marginBottom: '8px', textAlign: 'center' }}>
        壁の角をタップして囲んでください（{points.length}点）
      </p>

      <canvas
        ref={canvasRef}
        width={480}
        height={360}
        onClick={handleTap}
        style={{
          width: '100%',
          borderRadius: '12px',
          cursor: 'crosshair',
          border: '1px solid #333'
        }}
      />

      <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
        <button
          onClick={() => setPoints(prev => prev.slice(0, -1))}
          disabled={points.length === 0}
          style={{
            flex: 1,
            padding: '10px',
            backgroundColor: 'transparent',
            color: '#aaa',
            border: '1px solid #333',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          1点戻す
        </button>
        <button
          onClick={calcArea}
          disabled={points.length < 3}
          style={{
            flex: 2,
            padding: '10px',
            backgroundColor: points.length >= 3 ? '#FF6200' : '#333',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: points.length >= 3 ? 'pointer' : 'default',
            fontSize: '14px'
          }}
        >
          面積を計算する
        </button>
      </div>
    </div>
  );
}

export default WallMarker;