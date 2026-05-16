const AR = require('js-aruco2').AR;

const detector = new AR.Detector();

const VALID_IDS = [1, 2, 3, 4, 5];
const CARD_WIDTH_CM = 14.8;
const CARD_HEIGHT_CM = 21.0;

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

  return {
    valid: true,
    id,
    corners,
    pixelsPerCm,
    cardWidthCm: CARD_WIDTH_CM,
    cardHeightCm: CARD_HEIGHT_CM
  };
}

export { detectArUco, VALID_IDS };