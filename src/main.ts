import { CaseworkApp } from './presentation/CaseworkApp';
import './presentation/styles/casework.css';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('#app 요소를 찾을 수 없다.');

new CaseworkApp(root);
