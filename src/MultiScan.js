import { useState } from 'react';
import WallMarker from './WallMarker';

function MultiScan({ pixelsPerCm, onComplete }) {
  const [scans, setScans] = useState([]); // 完了したスキャンの配列
  const [currentImage, setCurrentImage] = useState(null);
  const [step, setStep] = useState('photo'); // photo: 撮影, mark: マーク

  // 写真を選択
  const handlePhoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setCurrentImage(url);
    setStep('mark');
  };

  // 1枚のマーク完了
  const handleMark = (result) => {
    const newScan = {
      id: scans.length + 1,
      wall: parseFloat(result.wall),
      exclude: parseFloat(result.exclude),
      net: parseFloat(result.net),
      excludeCount: result.excludeCount
    };
    const updated = [...scans, newScan];
    setScans(updated);
    setCurrentImage(null);
    setStep('photo');
  };

  // 合算して完了
  const handleFinish = () => {
    const totalWall = scans.reduce((s, sc) => s + sc.wall, 0);
    const totalExclude = scans.reduce((s, sc) => s + sc.exclude, 0);
    const totalNet = scans.reduce((s, sc) => s + sc.net, 0);
    onComplete && onComplete({
      wall: totalWall.toFixed(2),
      exclude: totalExclude.toFixed(2),
      net: totalNet.toFixed(2),
      excludeCount: scans.reduce((s, sc) => s + sc.excludeCount, 0)
    });
  };

  return (
    <div style={{ width: '100%', maxWidth: '480px' }}>

      {/* スキャン済みリスト */}
      {scans.length > 0 && step === 'photo' && (
        <div style={{
          backgroundColor: '#1a1a1a', borderRadius: '12px',
          padding: '12px', marginBottom: '12px', border: '1px solid #333'
        }}>
          <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '8px' }}>
            スキャン済み
          </div>
          {scans.map((sc) => (
            <div key={sc.id} style={{
              display: 'flex', justifyContent: 'space-between',
              marginBottom: '4px', fontSize: '13px'
            }}>
              <span style={{ color: '#aaa' }}>#{sc.id}</span>
              <span style={{ color: 'white' }}>{sc.net} ㎡</span>
            </div>
          ))}
          <div style={{
            borderTop: '1px solid #333', marginTop: '8px', paddingTop: '8px',
            display: 'flex', justifyContent: 'space-between', fontSize: '14px'
          }}>
            <span style={{ color: '#aaa' }}>合計</span>
            <span style={{ color: '#FF6200', fontWeight: 'bold' }}>
              {scans.reduce((s, sc) => s + sc.net, 0).toFixed(2)} ㎡
            </span>
          </div>
        </div>
      )}

      {/* 撮影ステップ */}
      {step === 'photo' && (
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#aaa', fontSize: '13px', marginBottom: '16px' }}>
            {scans.length === 0
              ? '1枚目の写真を選択してください'
              : `${scans.length + 1}枚目を追加 または 計算して終了`}
          </p>
          <label style={{
            display: 'block', padding: '14px',
            backgroundColor: '#FF6200', color: 'white',
            borderRadius: '12px', fontSize: '16px',
            cursor: 'pointer', marginBottom: '10px'
          }}>
            📷 写真を選択
            <input
              type="file"
              accept="image/*"
              onChange={handlePhoto}
              style={{ display: 'none' }}
            />
          </label>
          {scans.length > 0 && (
            <button
              onClick={handleFinish}
              style={{
                width: '100%', padding: '14px',
                backgroundColor: '#00BFFF', color: 'white',
                border: 'none', borderRadius: '12px',
                fontSize: '16px', cursor: 'pointer'
              }}
            >
              ✓ 合算して計算する（{scans.length}枚）
            </button>
          )}
        </div>
      )}

      {/* マークステップ */}
      {step === 'mark' && currentImage && (
        <div>
          <p style={{ color: '#aaa', fontSize: '13px', marginBottom: '8px', textAlign: 'center' }}>
            #{scans.length + 1} 壁を囲んでください
          </p>
          <WallMarker
            imageUrl={currentImage}
            pixelsPerCm={pixelsPerCm}
            onComplete={handleMark}
          />
          <button
            onClick={() => { setCurrentImage(null); setStep('photo'); }}
            style={{
              marginTop: '10px', width: '100%', padding: '10px',
              backgroundColor: 'transparent', color: '#555',
              border: '1px solid #333', borderRadius: '8px',
              cursor: 'pointer', fontSize: '12px'
            }}
          >
            キャンセル
          </button>
        </div>
      )}
    </div>
  );
}

export default MultiScan;