import { useRef, useState, useEffect } from 'react';

function WallMarker({ imageUrl, pixelsPerCm, onComplete }) {
  const canvasRef = useRef(null);
  const [imageObj, setImageObj] = useState(null);
  const [mode, setMode] = useState('wall');
  const [wallPoints, setWallPoints] = useState([]);
  const [excludeZones, setExcludeZones] = useState([]);
  const [currentExclude, setCurrentExclude] = useState([]);

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
    if (imageObj) {
      ctx.drawImage(imageObj, 0, 0, canvas.width, canvas.height);
    } else {
      ctx.fillStyle = '#222';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
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
      const cx = zone.reduce((s, p) => s + p.x, 0) / zone.length;
      const cy = zone.reduce((s, p) => s + p.y, 0) / zone.length;
      ctx.fillStyle = '#FF6200';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`除外${zi + 1}`, cx, cy);
    });
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
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    if (mode === 'wall') {
      setWallPoints(prev => [...prev, { x, y }]);
    } else {
      setCurrentExclude(prev => [...prev, { x, y }]);
    }
  };

  const confirmExclude = () => {
    if (currentExclude.length < 3) return;
    setExcludeZones(prev => [...prev, currentExclude]);
    setCurrentExclude([]);
  };

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

  const handleCalc = () => {
    const ppc = pixelsPerCm || 10;
    let wallM2 = 0;
    let excludeM2 = 0;
    if (wallPoints.length >= 3) {
      wallM2 = calcArea(wallPoints) / (ppc * ppc) / 10000;
    }
    excludeM2 = excludeZones.reduce((sum, zone) => {
      return sum + calcArea(zone) / (ppc * ppc) / 10000;
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
          style={{
            flex: 1, padding: '8px',
            backgroundColor: mode === 'exclude' ? '#FF6200' : 'transparent',
            color: mode === 'exclude' ? 'white' : '#aaa',
            border: `1px solid ${mode === 'exclude' ? '#FF6200' : '#333'}`,
            borderRadius: '8px', cursor: 'pointer', fontSize: '13px'
          }}
        >
          除外ゾーン
        </button>
      </div>

      <p style={{ color: '#aaa', fontSize: '12px', marginBottom: '8px', textAlign: 'center' }}>
        {mode === 'wall'
          ? `壁の輪郭をタップ（${wallPoints.length}点）`
          : `除外箇所をタップ（${currentExclude.length}点）確定済み:${excludeZones.length}箇所`}
      </p>

      <canvas
        ref={canvasRef}
        width={800}
        height={450}
        onClick={handleTap}
        onTouchStart={handleTap}
        style={{ width: '100%', borderRadius: '12px', cursor: 'crosshair', border: '1px solid #333' }}
      />

      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
        {mode === 'wall' ? (
          <>
            <button
              onClick={() => setWallPoints(prev => prev.slice(0, -1))}
              disabled={wallPoints.length === 0}
              style={{
                flex: 1, padding: '10px', backgroundColor: 'transparent',
                color: '#aaa', border: '1px solid #333', borderRadius: '8px',
                cursor: 'pointer', fontSize: '13px'
              }}
            >
              1点戻す
            </button>
            <button
              onClick={handleCalc}
              style={{
                flex: 2, padding: '10px',
                backgroundColor: '#FF6200',
                color: 'white', border: 'none', borderRadius: '8px',
                cursor: 'pointer', fontSize: '13px'
              }}
            >
              {wallPoints.length >= 3 ? '面積を計算する' : 'このままOK'}
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setCurrentExclude(prev => prev.slice(0, -1))}
              disabled={currentExclude.length === 0}
              style={{
                flex: 1, padding: '10px', backgroundColor: 'transparent',
                color: '#aaa', border: '1px solid #333', borderRadius: '8px',
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
                cursor: 'pointer', fontSize: '13px'
              }}
            >
              除外確定
            </button>
            <button
              onClick={handleCalc}
              style={{
                flex: 1, padding: '10px', backgroundColor: '#00BFFF',
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