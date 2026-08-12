import { RouterProvider } from '@tanstack/react-router';

import router from '../../../src/app-lab/router';

export { openAppFileInEditor } from '../../../src/app-lab/openAppFileInEditor';

const App = (): JSX.Element => <RouterProvider router={router} />;

export default App;
