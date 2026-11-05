// Emotion presets. Each one picks a variant for each face part and sets the
// ear angles (degrees, negative = droop for the left ear) and head tilt.
// eyes:   happy | open | wide | closed | wink
// mouth:  smile | small-smile | grin | neutral | frown | wavy | side | o
// brows:  none | raised | sad | confused | thinking | determined
// gaze:   default eye direction for open eyes, [x, y] from -1 to 1
export const EMOTIONS = {
  neutral:     { eyes: 'open',  mouth: 'small-smile', brows: 'none',      cheeks: false, ears: [0, 0],     tilt: 0,  gaze: [0, 0] },
  happy:       { eyes: 'happy', mouth: 'smile',       brows: 'none',      cheeks: false, ears: [4, -4],    tilt: 0,  gaze: [0, 0] },
  veryHappy:   { eyes: 'happy', mouth: 'grin',        brows: 'none',      cheeks: true,  ears: [10, -10],  tilt: 0,  gaze: [0, 0] },
  surprised:   { eyes: 'wide',  mouth: 'o',           brows: 'raised',    cheeks: false, ears: [14, -14],  tilt: 0,  gaze: [0, 0] },
  confused:    { eyes: 'open',  mouth: 'wavy',        brows: 'confused',  cheeks: false, ears: [-6, 8],    tilt: 7,  gaze: [0, 0] },
  thinking:    { eyes: 'open',  mouth: 'side',        brows: 'thinking',  cheeks: false, ears: [0, 4],     tilt: -5, gaze: [0.7, -0.8] },
  sad:         { eyes: 'open',  mouth: 'frown',       brows: 'sad',       cheeks: false, ears: [-22, 22],  tilt: 0,  gaze: [0, 0.7] },
  wink:        { eyes: 'wink',  mouth: 'smile',       brows: 'none',      cheeks: true,  ears: [4, -4],    tilt: -4, gaze: [0, 0] },
  determined:  { eyes: 'open',  mouth: 'neutral',     brows: 'determined', cheeks: false, ears: [6, -6],   tilt: 0,  gaze: [0, 0] },
};
