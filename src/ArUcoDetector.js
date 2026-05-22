const AR = require('js-aruco2').AR;
const detector = new AR.Detector();
const VALID_IDS = Array.from({length: 256}, (_, i) => i);
const CARD_WIDTH_CM = 9.1;
const CARD_HEIGHT_CM = 5.5;

function computePerspectiveTransform(corners, pixelsPerCm) {
  const w = CARD_WIDTH_CM * pixelsPerCm;
  const h = CARD_HEIGHT_CM * pixelsPerCm;

  const src = [
    corners[0].x, corners[0].y,
    corners[1].x, corners[1].y,
    corners[2].x, corners[2].y,
    corners[3].x, corners[3].y
  ];

  const dst = [
    0, 0,
    w, 0,
    w, h,
    0, h
  ];

  return { src, dst, w, h };
}

function detectArUco(canvas) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const markers = detector.detect(imageData);
  if (markers.length === 0) return null;
  const marker = markers[0];
  const id = marker.id;
  if (!VALID_IDS.includes(id)) {
    return { valid: false, id };
  }
  const corners = marker.corners;
  const topEdgePx = Math.sqrt(
    Math.pow(corners[1].x - corners[0].x, 2) +
    Math.pow(corners[1].y - corners[0].y, 2)
  );
  const pixelsPerCm = topEdgePx / CARD_WIDTH_CM;
  const perspectiveData = computePerspectiveTransform(corners, pixelsPerCm);

  return {
    valid: true,
    id,
    corners,
    pixelsPerCm,
    cardWidthCm: CARD_WIDTH_CM,
    cardHeightCm: CARD_HEIGHT_CM,
    perspectiveData
  };
}

export { detectArUco, VALID_IDS };