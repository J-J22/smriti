import { el } from '../../core/dom.js';
import { homeIcon } from '../shared.js';

const STAGES = ['intro', 'exercise-1', 'exercise-2', 'exercise-3', 'praise'];

export function renderExercises(container, params, navigate, content) {
  const c = content.patient.exercises;
  const stageIndex = params.stage || 0;
  const stageKey = STAGES[stageIndex] || STAGES[0];
  const isLast = stageIndex >= STAGES.length - 1;

  container.appendChild(
    el('div', { class: 'patient-screen' }, [
      homeIcon(navigate, content),
      el('h1', {}, c.stages[stageKey]),
      el('button', {
        class: 'big-btn',
        onclick: () => {
          if (isLast) navigate('patient-home');
          else navigate('exercises', { stage: stageIndex + 1 });
        },
      }, isLast ? c.done : c.next),
    ])
  );
}
