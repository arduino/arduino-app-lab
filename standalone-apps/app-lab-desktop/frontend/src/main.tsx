import './style.css';

import { createRoot } from 'react-dom/client';

import App from './App';
import { registerCspViolationLogging } from './csp/cspViolations';

// Before anything renders, so no request the policy refuses goes unreported.
registerCspViolationLogging();

const container = document.getElementById('root');

const root = createRoot(container!);

root.render(<App />);
