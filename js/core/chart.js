// Hand-built inline SVG charts. No charting library: one would be a runtime
// CDN dependency, which breaks the offline requirement outright.

import { svgEl } from './dom.js';

// Daily activity as bars. Zero-days render as a faint baseline so a gap in
// practice is visible rather than simply absent.
export function barChart(values, options) {
  const settings = options || {};
  const width = settings.width || 300;
  const height = settings.height || 64;
  const gap = 2;
  const count = Math.max(1, values.length);
  const barWidth = (width - gap * (count - 1)) / count;
  const max = Math.max(1, ...values.map((point) => point.value));

  const bars = values.map((point, index) => {
    const scaled = (point.value / max) * (height - 6);
    const barHeight = point.value > 0 ? Math.max(4, scaled) : 2;
    return svgEl('rect', {
      x: (index * (barWidth + gap)).toFixed(2),
      y: (height - barHeight).toFixed(2),
      width: barWidth.toFixed(2),
      height: barHeight.toFixed(2),
      rx: Math.min(3, barWidth / 2).toFixed(2),
      class: point.value > 0 ? 'bar is-active' : 'bar',
    });
  });

  return svgEl('svg', {
    viewBox: '0 0 ' + width + ' ' + height,
    class: 'chart chart-bars',
    preserveAspectRatio: 'none',
    role: 'img',
    'aria-label': settings.label || '',
  }, bars);
}

// A trend line for a short series. Fixed 0-100 scale by default so two
// exercises can be compared by eye.
export function sparkline(values, options) {
  const settings = options || {};
  const width = settings.width || 300;
  const height = settings.height || 48;
  const min = settings.min === undefined ? 0 : settings.min;
  const max = settings.max === undefined ? 100 : settings.max;
  const span = Math.max(1, max - min);

  if (values.length < 2) {
    return svgEl('svg', {
      viewBox: '0 0 ' + width + ' ' + height,
      class: 'chart chart-line',
      preserveAspectRatio: 'none',
      role: 'img',
      'aria-label': settings.label || '',
    }, []);
  }

  const step = width / (values.length - 1);
  const points = values.map((value, index) => {
    const x = index * step;
    const y = height - 4 - ((value - min) / span) * (height - 8);
    return [x, y];
  });

  const path = points
    .map((point, index) => (index === 0 ? 'M' : 'L') + point[0].toFixed(1) + ' ' + point[1].toFixed(1))
    .join(' ');
  const area = path + ' L' + width + ' ' + height + ' L0 ' + height + ' Z';

  // An optional second series on the same axes, drawn as a bare line. Used to
  // lay what the model expected over what actually happened.
  let overlay = null;
  if (Array.isArray(settings.overlay) && settings.overlay.length === values.length) {
    const overlayStep = width / (settings.overlay.length - 1);
    overlay = svgEl('path', {
      d: settings.overlay
        .map((value, index) => {
          const x = index * overlayStep;
          const y = height - 4 - ((value - min) / span) * (height - 8);
          return (index === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1);
        })
        .join(' '),
      class: 'line-overlay',
    });
  }

  return svgEl('svg', {
    viewBox: '0 0 ' + width + ' ' + height,
    class: 'chart chart-line',
    preserveAspectRatio: 'none',
    role: 'img',
    'aria-label': settings.label || '',
  }, [
    svgEl('path', { d: area, class: 'line-fill' }),
    svgEl('path', { d: path, class: 'line-stroke' }),
    overlay,
    svgEl('circle', {
      cx: points[points.length - 1][0].toFixed(1),
      cy: points[points.length - 1][1].toFixed(1),
      r: 3.5,
      class: 'line-head',
    }),
  ]);
}
