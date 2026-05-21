/* eslint-disable react-hooks/exhaustive-deps */
import { useRef, useState, useEffect, useCallback } from 'react';

const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_API_KEY;
const PROMPT = 'Look at this room photo. Find the largest visible wall surface (the painted or wallpapered flat vertical surface). Include the full wall area from floor to ceiling, excluding only windows, doors, and furniture that are IN FRONT of the wall. Return the outline as x,y coordinate ratios (0 to 1). Return JSON only: {"points":[{"x":0.1,"y":0.1},{"x":0.9,"y":0.1},{"x":0.9,"y":0.9},{"x":0.1,"y":0.9}]}';

function WallMarker({ imageUrl, pixelsPerCm, onComplete }) {
  const canvasRef = useRef(null);
  const [imageObj, setImageObj] = useState(null);
  const [mode, setMode] = useState('wall');
  const [wallPath, setWallPath] = useState([]);
  const [excludeZones, setExcludeZones] = useState([]);
  const [currentPath, setCurrentPath] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [wallConfirmed, setWallConfirmed] = useState(false);
  const [autoStatus, setAutoStatus] = useState('idle');
  const autoCalledRef = useRef(false);

  useEffect(() => {
    if (!imageUrl) return;
    const img = new Image();
    img.onload = () => {
      setImageObj(img);
      if (!autoCalledRef.current) {
        autoCalledRef.current = true;
        autoDetectWall(imageUrl);
      }
    };
    img.src = imageUrl;
  }, [imageUrl]);

  const autoDetectWall = async (url) => {
    setAutoStatus('loading');
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(blob);
      });

      const response = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + GEMINI_API_KEY,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { inline_data: { mime_type: 'image/jpeg', data: base64 } },
                { text: PROMPT }
              ]
            }]
          })
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        console.error('API error:', response.status, errText);
        setAutoStatus('failed');
        return;
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      console.log('Gemini response:', text);
      if (!text) {
        setAutoStatus('failed');
        return;
      }
      const clean = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      if (parsed.points && parsed.points.length >= 3) {
        const scaled = parsed.points.map(p => ({ x: p.x * 800, y: p.y * 450 }));
        setWallPath(scaled);
        setWallConfirmed(true);
        setMode('exclude');
        setAutoStatus('done');
      } else {
        setAutoStatus('failed');
      }
    } catch (e) {
      console.error(e);
      setAutoStatus('failed');
    }
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (imageObj) ctx.drawImage(imageObj, 0, 0, canvas.width, canvas.height);
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
      ctx.fillText('除外' + (zi + 1), cx, cy);
    });
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

  useEffect(() => { draw(); }, [draw]);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const src = e.touches ? e.touches[0] : e;
    return { x: (src.clientX - rect.left) * scaleX, y: (src.clientY - rect.top) * scaleY };
  };

  const onStart = (e) => { e.preventDefault(); e.stopPropagation(); setIsDrawing(true); setCurrentPath([getPos(e)]); };

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
    if (!isDrawing || currentPath.length < 3) { setIsDrawing(false); setCurrentPath([]); return; }
    if (mode === 'wall') { setWallPath(currentPath); setWallConfirmed(true); }
    else { setExcludeZones(prev => [...prev, currentPath]); }
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
    if (wallPath.length >= 3) wallM2 = calcArea(wallPath) / (ppc * ppc) / 10000;
    const excludeM2 = excludeZones.reduce((sum, zone) => sum + calcArea(zone) / (ppc * ppc) / 10000, 0);
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
      {autoStatus === 'loading' && (
        <div style={{ textAlign: 'center', padding: '12px', backgroundColor: '#1a1a1a', borderRadius: '8px', marginBottom: '8px', color: '#00FF88', fontSize: '13px' }}>
          AIが壁を自動認識中...
        </div>
      )}
      {autoStatus === 'done' && (
        <div style={{ textAlign: 'center', padding: '8px', color: '#00FF88', fontSize: '13px', marginBottom: '8px' }}>
          壁を自動認識しました
        </div>
      )}
      {autoStatus === 'failed' && (
        <div style={{ textAlign: 'center', padding: '8px', color: '#FF6200', fontSize: '13px', marginBottom: '8px' }}>
          自動認識失敗。手動でなぞってください
        </div>
      )}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
        <button onClick={() => setMode('wall')} style={{ flex: 1, padding: '8px', backgroundColor: mode === 'wall' ? '#00BFFF' : 'transparent', color: mode === 'wall' ? 'white' : '#aaa', border: '1px solid ' + (mode === 'wall' ? '#00BFFF' : '#333'), borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>
          壁をなぞる
        </button>
        <button onClick={() => setMode('exclude')} style={{ flex: 1, padding: '8px', backgroundColor: mode === 'exclude' ? '#FF6200' : 'transparent', color: mode === 'exclude' ? 'white' : '#aaa', border: '1px solid ' + (mode === 'exclude' ? '#FF6200' : '#333'), borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>
          除外をなぞる
        </button>
      </div>
      <p style={{ color: '#aaa', fontSize: '12px', marginBottom: '8px', textAlign: 'center' }}>
        {mode === 'wall' ? (wallConfirmed ? '壁認識済み。除外ゾーンを追加するか計算してください' : '壁の輪郭を指でなぞってください') : ('除外ゾーンをなぞる（確定済み:' + excludeZones.length + '箇所）')}
      </p>
      <canvas
        ref={canvasRef} width={800} height={450}
        onMouseDown={onStart} onMouseMove={onMove} onMouseUp={onEnd} onMouseLeave={onEnd}
        onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd} onTouchCancel={onEnd}
        style={{ width: '100%', borderRadius: '12px', border: '1px solid #333', touchAction: 'none' }}
      />
      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
        <button
          onClick={() => { if (mode === 'wall') { setWallPath([]); setWallConfirmed(false); } else setExcludeZones(prev => prev.slice(0, -1)); }}
          style={{ flex: 1, padding: '10px', backgroundColor: 'transparent', color: '#aaa', border: '1px solid #333', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}
        >
          やり直す
        </button>
        <button onClick={handleCalc} style={{ flex: 2, padding: '10px', backgroundColor: '#FF6200', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>
          {wallConfirmed ? '面積を計算する' : 'このままOK'}
        </button>
      </div>
    </div>
  );
}

export default WallMarker;