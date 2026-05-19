import { useRef, useState, useEffect, useCallback } from 'react';
function WallMarker({ imageUrl, pixelsPerCm, onComplete }) {
  const canvasRef = useRef(null);
  const [imageObj, setImageObj] = useState(null);
  const [mode, setMode] = useState('wall');
  const [wallPath, setWallPath] = useState([]);
  const [excludeZones, setExcludeZones] = useState([]);
  const [currentPath, setCurrentPath] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [wallConfirmed, setWallConfirmed] = useState(false);

  useEffect(() => {
    if (!imageUrl) return;
    const img = new Image();
    img.onload = () => setImageObj(img);
    img.src = imageUrl;
  }, [imageUrl]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (imageObj) ctx.drawImage(imageObj, 0, 0, canvas.width, canvas.height);

    // 壁の塗りつぶし
    if (wallPath.length > 2) {
      ctx.beginPath();
      ctx.moveTo(wallPath[0].x, wallPath[0].y);
      wallPath.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.closePath();
      ctx.fillStyle = 'rgba(0,191,255,0.25)';
      ctx.fill();
      ctx.strokeStyle = '#00BFFF';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // 除外ゾーン
    excludeZones.forEach((zone, zi) => {
      if (zone.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(zone[0].x, zone[0].y);
      zone.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.closePath();
      ctx.fillStyle = 'rgba(255,98,0,0.35)';
      ctx.fill();
      ctx.strokeStyle = '#FF6200';
      ctx.lineWidth = 2;
      ctx.stroke();
      const cx = zone.reduce((s, p) => s + p.x, 0) / zone.length;
      const cy = zone.reduce((s, p) => s + p.y, 0) / zone.length;
      ctx.fillStyle = 'white';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`除外${zi + 1}`, cx, cy);
    });

    // 描画中のパス
    if (currentPath.length > 1) {
      ctx.beginPath();
      ctx.moveTo(currentPath[0].x, currentPath[0].y);
      currentPath.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.strokeStyle = mode === 'wall' ? '#00FF88' : '#FF6200';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [wallPath, excludeZones, currentPath, imageObj, mode]);

  useEffect(() => { draw(); }, [wallPath, excludeZones, currentPath, imageObj, mode]);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const src = e.touches ? e.touches[0] : e;
    return {
      x: (src.clientX - rect.left) * scaleX,
      y: (src.clientY - rect.top) * scaleY
    };
  };

  const onStart = (e) => {
    e.preventDefault();
    setIsDrawing(true);
    const pos = getPos(e);
    setCurrentPath([pos]);
  };

  const onMove = (e) => {
    e.preventDefault();
    if (!isDrawing) return;
    const pos = getPos(e);
    setCurrentPath(prev => {
      const last = prev[prev.length - 1];
      const dx = pos.x - last.x;
      const dy = pos.y - last.y;
      if (Math.sqrt(dx * dx + dy * dy) < 5) return prev;
      return [...prev, pos];
    });
  };

  const onEnd = (e) => {
    e.preventDefault();
    if (!isDrawing || currentPath.length < 3) {
      setIsDrawing(false);
      setCurrentPath([]);
      return;
    }
    if (mode === 'wall') {
      setWallPath(currentPath);
      setWallConfirmed(true);
    } else {
      setExcludeZones(prev => [...prev, currentPath]);
    }
    setCurrentPath([]);
    setIsDrawing(false);
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
    if (wallPath.length >= 3) {
      wallM2 = calcArea(wallPath) / (ppc * ppc) / 10000;
    }
    const excludeM2 = excludeZones.reduce((sum, zone) => {
      return sum + calcArea(zone) / (ppc * ppc) / 10000;
    }, 0);
    const netM2 = Math.max(0, wallM2 - excludeM2);
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
          🖊 壁をなぞる
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
          🚫 除外をなぞる
        </button>
      </div>

      <p style={{ color: '#aaa', fontSize: '12px', marginBottom: '8px', textAlign: 'center' }}>
        {mode === 'wall'
          ? wallConfirmed ? '✅ 壁を認識済み。除外ゾーンを追加するか計算してください' : '壁の輪郭を指でなぞってください'
          : `除外ゾーンをなぞる（確定済み:${excludeZones.length}箇所）`}
      </p>

      <canvas
        ref={canvasRef}
        width={800}
        height={450}
        onMouseDown={onStart}
        onMouseMove={onMove}
        onMouseUp={onEnd}
        onTouchStart={onStart}
        onTouchMove={onMove}
        onTouchEnd={onEnd}
        style={{ width: '100%', borderRadius: '12px', border: '1px solid #333', touchAction: 'none' }}
      />

      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
        <button
          onClick={() => {
            if (mode === 'wall') { setWallPath([]); setWallConfirmed(false); }
            else setExcludeZones(prev => prev.slice(0, -1));
          }}
          style={{
            flex: 1, padding: '10px', backgroundColor: 'transparent',
            color: '#aaa', border: '1px solid #333', borderRadius: '8px',
            cursor: 'pointer', fontSize: '13px'
          }}
        >
          やり直す
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
          {wallConfirmed ? '面積を計算する' : 'このままOK'}
        </button>
      </div>
    </div>
  );
}

export default WallMarker;