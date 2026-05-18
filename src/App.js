import { useState } from 'react';
import WallMarker from './WallMarker';
import GuideFrame from './GuideFrame';
import VideoScanner from './VideoScanner';
import MultiScan from './MultiScan';
import SmartScan from './SmartScan';
import './App.css';

function App() {
  const [step, setStep] = useState('home');
  const [cardInfo, setCardInfo] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [area, setArea] = useState(null);

  const handleDebug = () => {
    setCardInfo({ id: 1, pixelsPerCm: 10 });
    setCapturedImage(null);
    setStep('mark');
  };

  const handleComplete = (result) => {
    setArea(result);
    setStep('result');
  };

  const reset = () => {
    setStep('home');
    setArea(null);
    setCardInfo(null);
    setCapturedImage(null);
  };

  return (
    <div style={{
      backgroundColor: '#111',
      minHeight: '100vh',
      color: 'white',
      fontFamily: 'sans-serif',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>

      {/* ホーム画面 */}
      {step === 'home' && (
        <div style={{ textAlign: 'center', width: '100%', maxWidth: '300px' }}>
          <h1 style={{ fontSize: '24px', marginBottom: '8px' }}>壁面積スキャナー</h1>
          <p style={{ color: '#aaa', marginBottom: '40px', fontSize: '14px' }}>
            基準カードをかざして壁の面積を計測します
          </p>
          <button
            onClick={() => setStep('scan')}
            style={{
              backgroundColor: '#FF6200', color: 'white',
              border: 'none', borderRadius: '12px',
              padding: '16px 40px', fontSize: '18px',
              cursor: 'pointer', display: 'block',
              width: '100%', marginBottom: '12px'
            }}
          >
            計測を開始する
          </button>
          <button
          onClick={() => setStep('smart')}
            style={{
              backgroundColor: '#00FF88', color: '#000',
              border: 'none', borderRadius: '12px',
              padding: '16px 40px', fontSize: '18px',
              cursor: 'pointer', display: 'block',
              width: '100%', marginBottom: '12px',
              fontWeight: 'bold'
            }}
          >
            ✨ スマートスキャン（新）
            onClick={() => setStep('video')}
            style={{
              backgroundColor: 'transparent', color: '#aaa',
              border: '1px solid #333', borderRadius: '8px',
              padding: '10px', fontSize: '14px',
              cursor: 'pointer', display: 'block',
              width: '100%', marginBottom: '8px'
            }}
          >
            🎬 動画スキャンモード
          </button>
          <button
            onClick={() => setStep('multi')}
            style={{
              backgroundColor: 'transparent', color: '#aaa',
              border: '1px solid #333', borderRadius: '8px',
              padding: '10px', fontSize: '14px',
              cursor: 'pointer', display: 'block',
              width: '100%', marginBottom: '8px'
            }}
          >
            📷 複数枚合算モード
          </button>
          <button
            onClick={handleDebug}
            style={{
              backgroundColor: 'transparent', color: '#555',
              border: '1px solid #222', borderRadius: '8px',
              padding: '8px', fontSize: '12px',
              cursor: 'pointer', display: 'block', width: '100%'
            }}
          >
            デバッグ：カードなしで進む
          </button>
        </div>
      )}

      {/* スキャン画面 */}
      {step === 'scan' && (
        <div style={{ width: '100%', maxWidth: '480px', textAlign: 'center' }}>
          <p style={{ color: '#aaa', fontSize: '13px', marginBottom: '12px' }}>
            ① カードをホルダーに固定 → ② 枠に合わせる → ③ 認証完了
          </p>
          <GuideFrame
            onCalibrated={(info) => {
              setCardInfo(info);
              setStep('mark');
            }}
          />
          <button
            onClick={() => setStep('home')}
            style={{
              marginTop: '16px', backgroundColor: 'transparent',
              color: '#555', border: '1px solid #333',
              borderRadius: '8px', padding: '8px 20px',
              cursor: 'pointer', fontSize: '12px'
            }}
          >
            戻る
          </button>
        </div>
      )}

      {/* 動画スキャン画面 */}
      {step === 'video' && (
        <div style={{ width: '100%', maxWidth: '480px', textAlign: 'center' }}>
          <p style={{ color: '#aaa', fontSize: '13px', marginBottom: '12px' }}>
            カードを固定して壁全体をゆっくりスキャン
          </p>
          <VideoScanner
            pixelsPerCm={cardInfo?.pixelsPerCm || 10}
            onComplete={(result) => {
              setCapturedImage(result.imageUrl);
              setCardInfo({ id: 1, pixelsPerCm: result.pixelsPerCm || 10 });
              setStep('mark');
            }}
          />
          <button
            onClick={() => setStep('home')}
            style={{
              marginTop: '16px', backgroundColor: 'transparent',
              color: '#555', border: '1px solid #333',
              borderRadius: '8px', padding: '8px 20px',
              cursor: 'pointer', fontSize: '12px'
            }}
          >
            戻る
          </button>
        </div>
      )}

      {/* 複数枚合算画面 */}
      {step === 'multi' && (
        <div style={{ width: '100%', maxWidth: '480px', textAlign: 'center' }}>
          <p style={{ color: '#aaa', fontSize: '13px', marginBottom: '12px' }}>
            複数枚撮影して面積を合算します
          </p>
          <MultiScan
            pixelsPerCm={cardInfo?.pixelsPerCm || 10}
            onComplete={(result) => {
              setArea(result);
              setStep('result');
            }}
          />
          <button
            onClick={() => setStep('home')}
            style={{
              marginTop: '16px', backgroundColor: 'transparent',
              color: '#555', border: '1px solid #333',
              borderRadius: '8px', padding: '8px 20px',
              cursor: 'pointer', fontSize: '12px'
            }}
          >
            戻る
          </button>
        </div>
      )}
{/* スマートスキャン画面 */}
      {step === 'smart' && cardInfo && (
        <div style={{ width: '100%', maxWidth: '480px', textAlign: 'center' }}>
          <p style={{ color: '#00FF88', fontSize: '13px', marginBottom: '12px' }}>
            ✨ スマートスキャン
          </p>
          <SmartScan
            pixelsPerCm={cardInfo.pixelsPerCm}
            onComplete={(result) => {
              setArea(result);
              setStep('result');
            }}
          />
          <button
            onClick={reset}
            style={{
              marginTop: '16px', backgroundColor: 'transparent',
              color: '#555', border: '1px solid #333',
              borderRadius: '8px', padding: '8px 20px',
              cursor: 'pointer', fontSize: '12px'
            }}
          >
            戻る
          </button>
        </div>
      )}
      {/* マーク画面 */}
      {step === 'mark' && cardInfo && (
        <div style={{ width: '100%', maxWidth: '480px', textAlign: 'center' }}>
          <p style={{ color: '#00FF88', fontSize: '13px', marginBottom: '16px' }}>
            ✓ カード認証完了（ID: {cardInfo.id}）
          </p>
          <WallMarker
            imageUrl={capturedImage}
            pixelsPerCm={cardInfo.pixelsPerCm}
            onComplete={handleComplete}
          />
          <button
            onClick={reset}
            style={{
              marginTop: '16px', backgroundColor: 'transparent',
              color: '#555', border: '1px solid #333',
              borderRadius: '8px', padding: '8px 20px',
              cursor: 'pointer', fontSize: '12px'
            }}
          >
            最初からやり直す
          </button>
        </div>
      )}

      {/* 結果画面 */}
      {step === 'result' && (
        <div style={{ textAlign: 'center', width: '100%', maxWidth: '480px' }}>
          <p style={{ color: '#aaa', fontSize: '14px', marginBottom: '8px' }}>計測結果</p>
          <div style={{ fontSize: '64px', fontWeight: 'bold', color: '#FF6200' }}>
            {area?.net}
          </div>
          <div style={{ fontSize: '24px', color: '#aaa', marginBottom: '20px' }}>
            ㎡（正味）
          </div>
          <div style={{
            backgroundColor: '#1a1a1a', borderRadius: '12px',
            padding: '16px', marginBottom: '20px', border: '1px solid #333', textAlign: 'left'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ color: '#aaa', fontSize: '14px' }}>壁 総面積</span>
              <span style={{ color: 'white', fontSize: '14px' }}>{area?.wall} ㎡</span>
            </div>
            {area?.excludeCount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ color: '#FF6200', fontSize: '14px' }}>除外（{area?.excludeCount}箇所）</span>
                <span style={{ color: '#FF6200', fontSize: '14px' }}>− {area?.exclude} ㎡</span>
              </div>
            )}
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              paddingTop: '10px', borderTop: '1px solid #333', marginBottom: '10px'
            }}>
              <span style={{ color: 'white', fontSize: '14px', fontWeight: 'bold' }}>正味面積</span>
              <span style={{ color: '#FF6200', fontSize: '14px', fontWeight: 'bold' }}>{area?.net} ㎡</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: '#aaa', fontSize: '13px' }}>壁紙必要量（+10%）</span>
              <span style={{ color: 'white', fontSize: '13px' }}>
                {(parseFloat(area?.net) * 1.1).toFixed(2)} ㎡
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#aaa', fontSize: '13px' }}>平方センチメートル</span>
              <span style={{ color: 'white', fontSize: '13px' }}>
                {Math.round(parseFloat(area?.net) * 10000).toLocaleString()} cm²
              </span>
            </div>
          </div>
          <button
            onClick={reset}
            style={{
              backgroundColor: '#FF6200', color: 'white',
              border: 'none', borderRadius: '12px',
              padding: '14px 40px', fontSize: '16px',
              cursor: 'pointer', width: '100%'
            }}
          >
            もう一度計測する
          </button>
        </div>
      )}

    </div>
  );
}

export default App;