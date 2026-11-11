(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FugueMeter = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DENOMINATORS = [1, 2, 4, 8, 16, 32];

  function normalize(meter) {
    if (meter == null) return { beats: 4, beatType: 4 };
    const { beats, beatType } = meter;
    if (!Number.isInteger(beats) || beats < 1 || beats > 32 || !DENOMINATORS.includes(beatType)) {
      throw new Error('无效拍号。分子应为 1 至 32，分母应为 1、2、4、8、16 或 32。');
    }
    return { beats, beatType };
  }

  function measureTicks(meter) {
    const { beats, beatType } = normalize(meter);
    return 96 * beats / beatType;
  }

  function beatTicks(meter) {
    return 96 / normalize(meter).beatType;
  }

  function label(meter) {
    const { beats, beatType } = normalize(meter);
    return `${beats}/${beatType}`;
  }

  return { normalize, measureTicks, beatTicks, label };
});
