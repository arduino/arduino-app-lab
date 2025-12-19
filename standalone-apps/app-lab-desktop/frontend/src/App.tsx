import './App.css';
import '@cloud-editor-mono/ui-components/public/index.scss';

import AppLab from '@cloud-editor-mono/core-ui/app-lab';

import { injectDependencies } from './dependencies';

//Sets dependencies for the app before the app is rendered
injectDependencies();

function App(): JSX.Element {
  return <AppLab />;
}

export default App;
