/* eslint-disable react-hooks/exhaustive-deps */
import { useRef, useState, useEffect, useCallback } from 'react';

const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_API_KEY;
const PROMPT = 'Look at this room photo. Find the largest visible wall surface (the painted or wallpapered flat vertical surface). Include the full wall area from floor to ceiling, excluding only windows, doors, and furniture that are IN FRONT of the wall. Return the outline as x,y coordinate ratios (0 to 1). Return JSON only: {"points":[{"x":0.1,"y":0.1},{"x":0.9,"y":0.1},{"x":0.9,"y":0.9},{"x":0.1,"y":0.9}]}';

const VERTEX_RADIUS = 18;
const TOLERANCE = 30;

function floodFill(imageData, startX, startY, tolerance) {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  const visited = new Uint8Array(width * height);
  const mask = new Uint8Array(width * height);

  const idx = (x, y) => (y * width + x) * 4;
  const startIdx = idx(startX, startY);
  const sr = data[startIdx];
  const sg = data[startIdx + 1];
  const sb = data[startIdx + 2];

  const colorDiff = (x, y) => {
    const i = idx(x, y);
    return Math.sqrt(
      Math.pow(data[i] - sr, 2) +
      Math.pow(data[i + 1] - sg, 2) +
      Math.pow(data[i + 2] - sb, 2)
    );
  };

  const queue = [[startX, startY]];
  visited[startY * width + startX] = 1;

  while (queue.length > 0) {
    const [x, y] = queue.shift();
    if (colorDiff(x, y) <= tolerance) {
      mask[y * width + x] = 1;
      const neighbors = [[x+1,y],[x-1,y],[x,y+1],[x,y-1]];
      for (const [nx, ny] of neighbors) {
        if (nx >= 0 && nx < width && ny >= 0 && ny < height && !visited[ny * width + nx]) {
          visited[ny * width + nx] = 1;
          queue.push([nx, ny]);
        }
      }
    }
  }
  return mask;
}

function maskToPolygon(mask, width, height, simplify = 8) {
  const points = [];
  for (let y = 0; y < height; y += simplify) {
    let first = -1, last = -1;
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x]) {
        if (first === -1) first = x;
        last = x;
      }
    }
    if (first !== -1) {
      points.push({ x: first, y });
    }
    if (last !== first && last !== -1) {
      points.push({ x: last, y });
    }
  }

  // 右側の点を逆順に追加してポリゴンを閉じる
  const leftPoints = [];
  const rightPoints = [];
  for (let y = 0; y < height; y += simplify) {
    let first = -1, last = -1;
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x]) {
        if (first === -1) first = x;
        last = x;
      }
    }
    if (first !== -1) leftPoints.push({ x: first, y });
    if (last !== -1 && last !== first) rightPoints.push({ x: last, y });
  }
  return [...leftPoints, ...rightPoints.reverse()];
}

function WallMarker({ imageUrl, pixelsPerCm, onComplete }) {
  const canvasRef = useRef(null);
  const [imageObj, setImageObj] = useState(null);
  const [wallPoints, setWallPoints] = useState([]);
  const [excludeZones, setExcludeZones] = useState([]);
  const [mode, setMode] = useState('wall');
  const [draggingInfo, setDraggingInfo] = useState(null);
  const [wallConfirmed, setWallConfirmed] = useState(false);
  const [status, setStatus] = useState('idle');
  const imageDataRef = useRef(null);

  useEffect(() => {
    if (!imageUrl) return;
    const img = new Image();
    img.onload = () => {
      setImageObj(img);
      // 画像データを保存
      const tmpCanvas = document.createElement('canvas');
      tmpCanvas.width = 800;
      tmpCanvas.height = 450;
      const ctx = tmpCanvas.getContext('2d');
      ctx.drawImage(img, 0, 0, 800, 450);
      imageDataRef.current = ctx.getImageData(0, 0, 800, 450);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (imageObj) ctx.drawImage(imageObj, 0, 0, canvas.width, canvas.height);

    // 壁の輪郭
    if (wallPoints.length > 2) {
      ctx.beginPath();
      ctx.moveTo(wallPoints[0].x, wallPoints[0].y);
      wallPoints.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.closePath();
      ctx.fillStyle = 'rgba(0,191,255,0.2)';
      ctx.fill();
      ctx.strokeStyle = '#00BFFF';
      ctx.lineWidth = 2;
      ctx.stroke();
      // 頂点ドット
      wallPoints.forEach((p, i) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, VERTEX_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,191,255,0.8)';
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = 'white';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(i + 1, p.x, p.y);
      });
    }

    // 除外ゾーン
    excludeZones.forEach((zone, zi) => {
      if (zone.length < 3) return;
      ctx.beginPath();
      ctx.moveTo(zone[0].x, zone[0].y);
      zone.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.closePath();
      ctx.fillStyle = 'rgba(255,98,0,0.3)';
      ctx.fill();
      ctx.strokeStyle = '#FF6200';
      ctx.lineWidth = 2;
      ctx.stroke();
      zone.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, VERTEX_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,98,0,0.8)';
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
      });
      const cx = zone.reduce((s, p) => s + p.x, 0) / zone.length;
      const cy = zone.reduce((s, p) => s + p.y, 0) / zone.length;
      ctx.fillStyle = 'white';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('除外' + (zi + 1), cx, cy);
    });
  }, [wallPoints, excludeZones, imageObj]);

  useEffect(() => { draw(); }, [draw]);

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

  const findVertex = (pos, points) => {
    for (let i = 0; i < points.length; i++) {
      const dx = points[i].x - pos.x;
      const dy = points[i].y - pos.y;
      if (Math.sqrt(dx * dx + dy * dy) < VERTEX_RADIUS * 2) return i;
    }
    return -1;
  };

  const handleTapOrStart = (e) => {
    e.preventDefault();
    const pos = getPos(e);

    // 壁の頂点ドラッグ開始
    if (wallPoints.length > 0) {
      const vi = findVertex(pos, wallPoints);
      if (vi !== -1) {
        setDraggingInfo({ type: 'wall', index: vi });
        return;
      }
    }

    // 除外ゾーンの頂点ドラッグ開始
    for (let zi = 0; zi < excludeZones.length; zi++) {
      const vi = findVertex(pos, excludeZones[zi]);
      if (vi !== -1) {
        setDraggingInfo({ type: 'exclude', zoneIndex: zi, index: vi });
        return;
      }
    }

    // フラッドフィルでタップ
    if (!imageDataRef.current) return;
    const x = Math.floor(pos.x);
    const y = Math.floor(pos.y);
    if (x < 0 || x >= 800 || y < 0 || y >= 450) return;

    setStatus('filling');
    setTimeout(() => {
      const mask = floodFill(imageDataRef.current, x, y, TOLERANCE);
      const polygon = maskToPolygon(mask, 800, 450, 6);
      if (polygon.length >= 3) {
        if (mode === 'wall') {
          setWallPoints(polygon);
          setWallConfirmed(true);
        } else {
          setExcludeZones(prev => [...prev, polygon]);
        }
      }
      setStatus('idle');
    }, 50);
  };

  const handleMove = (e) => {
    e.preventDefault();
    if (!draggingInfo) return;
    const pos = getPos(e);
    if (draggingInfo.type === 'wall') {
      setWallPoints(prev => prev.map((p, i) =>
        i === draggingInfo.index ? pos : p
      ));
    } else {
      setExcludeZones(prev => prev.map((zone, zi) =>
        zi === draggingInfo.zoneIndex
          ? zone.map((p, i) => i === draggingInfo.index ? pos : p)
          : zone
      ));
    }
  };

  const handleEnd = (e) => {
    e.preventDefault();
    setDraggingInfo(null);
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
    if (wallPoints.length >= 3) {
      wallM2 = calcArea(wallPoints) / (ppc * ppc) / 10000;
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
      {status === 'filling' && (
        <div style={{ textAlign: 'center', padding: '8px', color: '#00FF88', fontSize: '13px', marginBottom: '8px' }}>
          認識中...
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
        <button
          onClick={() => setMode('wall')}
          style={{
            flex: 1, padding: '8px',
            backgroundColor: mode === 'wall' ? '#00BFFF' : 'transparent',
            color: mode === 'wall' ? 'white' : '#aaa',
            border: '1px solid ' + (mode === 'wall' ? '#00BFFF' : '#333'),
            borderRadius: '8px', cursor: 'pointer', fontSize: '13px'
          }}
        >
          壁をタップ
        </button>
        <button
          onClick={() => setMode('exclude')}
          style={{
            flex: 1, padding: '8px',
            backgroundColor: mode === 'exclude' ? '#FF6200' : 'transparent',
            color: mode === 'exclude' ? 'white' : '#aaa',
            border: '1px solid ' + (mode === 'exclude' ? '#FF6200' : '#333'),
            borderRadius: '8px', cursor: 'pointer', fontSize: '13px'
          }}
        >
          除外をタップ
        </button>
      </div>

      <p style={{ color: '#aaa', fontSize: '12px', marginBottom: '8px', textAlign: 'center' }}>
        {mode === 'wall'
          ? wallConfirmed ? '壁を認識済み。頂点をドラッグして調整できます' : '壁の部分をタップしてください'
          : '除外したい部分をタップしてください（確定済み:' + excludeZones.length + '箇所）'}
      </p>

      <canvas
        ref={canvasRef}
        width={800}
        height={450}
        onMouseDown={handleTapOrStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onTouchStart={handleTapOrStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
        style={{ width: '100%', borderRadius: '12px', border: '1px solid #333', touchAction: 'none' }}
      />

      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
        <button
          onClick={() => {
            if (mode === 'wall') { setWallPoints([]); setWallConfirmed(false); }
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