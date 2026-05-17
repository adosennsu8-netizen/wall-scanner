import { useRef, useState, useEffect } from 'react';

function WallMarker({ imageUrl, pixelsPerCm, onComplete }) {
  const canvasRef = useRef(null);
  const [imageObj, setImageObj] = useState(null);
  const [mode, setMode] = useState('wall'); // wall: 壁を囲む, exclude: 除外ゾーン
  const [wallPoints, setWallPoints] = useState([]);
  const [excludeZones, setExcludeZones] = useState([]); // 除外ゾーンの配列
  const [currentExclude, setCurrentExclude] = useState([]); // 現在描画中の除外ゾーン

  useEffect(() => {
    if (!imageUrl) return;
    const img = new Image();
    img.onload = () => setImageObj(img);
    img.src = imageUrl;
  }, [imageUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 背景
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

    // 壁の輪郭を描画
    if (wallPoints.length > 0) {
      ctx.beginPath();
      ctx.moveTo(wallPoints[0].x, wallPoints[0].y);
      wallPoints.forEach(p => ctx.lineTo(p.x, p.y));
      if (mode !== 'wall') ctx.closePath();
      ctx.strokeStyle = '#00BFFF';
      ctx.lineWidth = 2;
      ctx.stroke();
      if (mode !== 'wall' && wallPoints.length > 2) {
        ctx.fillStyle = 'rgba(0,191,255,0.1)';
        ctx.fill();
      }
      wallPoints.forEach((p, i) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
        ctx.fillStyle = i === 0 ? '#00FF88' : '#00BFFF';
        ctx.fill();
      });
    }

    // 確定済み除外ゾーンを描画
    excludeZones.forEach((zone, zi) => {
      ctx.beginPath();
      ctx.moveTo(zone[0].x, zone[0].y);
      zone.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.closePath();
      ctx.strokeStyle = '#FF6200';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,98,0,0.2)';
      ctx.fill();
      // ラベル
      const cx = zone.reduce((s, p) => s + p.x, 0) / zone.length;
      const cy = zone.reduce((s, p) => s + p.y, 0) / zone.length;
      ctx.fillStyle = '#FF6200';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`除外${zi + 1}`, cx, cy);
    });

    // 現在描画中の除外ゾーン
    if (currentExclude.length > 0) {
      ctx.beginPath();
      ctx.moveTo(currentExclude[0].x, currentExclude[0].y);
      currentExclude.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.strokeStyle = '#FF6200';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
      currentExclude.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#FF6200';
        ctx.fill();
      });
    }

  }, [wallPoints, excludeZones, currentExclude, imageObj, mode]);

  const handleTap = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    if (mode === 'wall') {
      setWallPoints(prev => [...prev, { x, y }]);
    } else {
      setCurrentExclude(prev => [...prev, { x, y }]);
    }
  };

  // 除外ゾーンを確定
  const confirmExclude = () => {
    if (currentExclude.length < 3) return;
    setExcludeZones(prev => [...prev, currentExclude]);
    setCurrentExclude([]);
  };

  // ショーレース公式
  const calcArea = (points) => {
    let area = 0;
    const n = points.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += points[i].x * points[j].y;
      area -= points[j].x * points[i].y;
    }
    return Math.abs(area) / 2;
  };

  // 面積計算
  const handleCalc = () => {
    if (wallPoints.length < 3) return;
    const ppc = pixelsPerCm || 10;

    const wallPx = calcArea(wallPoints);
    const wallM2 = wallPx / (ppc * ppc) / 10000;

    const excludeM2 = excludeZones.reduce((sum, zone) => {
      const px = calcArea(zone);
      return sum + px / (ppc * ppc) / 10000;
    }, 0);

    const netM2 = wallM2 - excludeM2;

    onComplete && onComplete({
      wall: wallM2.toFixed(2),
      exclude: excludeM2.toFixed(2),
      net: netM2.toFixed(2),
      excludeCount: excludeZones.length
    });
  };

  return (
    <div style={{ width: '100%', maxWidth: '480px' }}>

      {/* モード切替 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
        <button
          onClick={() => setMode('wall')}
          style={{
            flex: 1, padding: '8px',
            backgroundColor: mode === 'wall' ? '#00BFFF' : 'transparent',
            color: mode === 'wall' ? 'white' : '#aaa',
            border: `1px solid ${mode === 'wall' ? '#00BFFF' : '#333'}`,
            borderRadius: '8px', cursor: 'pointer', fontSize: '13px'
          }}
        >
          壁を囲む
        </button>
        <button
          onClick={() => setMode('exclude')}
          disabled={wallPoints.length < 3}
          style={{
            flex: 1, padding: '8px',
            backgroundColor: mode === 'exclude' ? '#FF6200' : 'transparent',
            color: mode === 'exclude' ? 'white' : wallPoints.length < 3 ? '#555' : '#aaa',
            border: `1px solid ${mode === 'exclude' ? '#FF6200' : '#333'}`,
            borderRadius: '8px', cursor: wallPoints.length < 3 ? 'default' : 'pointer', fontSize: '13px'
          }}
        >
          除外ゾーン
        </button>
      </div>

      {/* ガイドテキスト */}
      <p style={{ color: '#aaa', fontSize: '12px', marginBottom: '8px', textAlign: 'center' }}>
        {mode === 'wall'
          ? `壁の角をタップ（${wallPoints.length}点）`
          : `除外したい箇所をタップ（${currentExclude.length}点）確定済み：${excludeZones.length}箇所`}
      </p>

      <canvas
        ref={canvasRef}
        width={480}
        height={360}
        onClick={handleTap}
        style={{
          width: '100%', borderRadius: '12px',
          cursor: 'crosshair', border: '1px solid #333'
        }}
      />

      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
        {mode === 'wall' ? (
          <>
            <button
              onClick={() => setWallPoints(prev => prev.slice(0, -1))}
              disabled={wallPoints.length === 0}
              style={{
                flex: 1, padding: '10px',
                backgroundColor: 'transparent', color: '#aaa',
                border: '1px solid #333', borderRadius: '8px',
                cursor: 'pointer', fontSize: '13px'
              }}
            >
              1点戻す
            </button>
            <button
              onClick={handleCalc}
              disabled={wallPoints.length < 3}
              style={{
                flex: 2, padding: '10px',
                backgroundColor: wallPoints.length >= 3 ? '#FF6200' : '#333',
                color: 'white', border: 'none', borderRadius: '8px',
                cursor: wallPoints.length >= 3 ? 'pointer' : 'default',
                fontSize: '13px'
              }}
            >
              面積を計算する
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setCurrentExclude(prev => prev.slice(0, -1))}
              disabled={currentExclude.length === 0}
              style={{
                flex: 1, padding: '10px',
                backgroundColor: 'transparent', color: '#aaa',
                border: '1px solid #333', borderRadius: '8px',
                cursor: 'pointer', fontSize: '13px'
              }}
            >
              1点戻す
            </button>
            <button
              onClick={confirmExclude}
              disabled={currentExclude.length < 3}
              style={{
                flex: 1, padding: '10px',
                backgroundColor: currentExclude.length >= 3 ? '#FF6200' : '#333',
                color: 'white', border: 'none', borderRadius: '8px',
                cursor: currentExclude.length >= 3 ? 'pointer' : 'default',
                fontSize: '13px'
              }}
            >
              除外確定
            </button>
            <button
              onClick={handleCalc}
              disabled={wallPoints.length < 3}
              style={{
                flex: 1, padding: '10px',
                backgroundColor: '#00BFFF',
                color: 'white', border: 'none', borderRadius: '8px',
                cursor: 'pointer', fontSize: '13px'
              }}
            >
              計算する
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default WallMarker;