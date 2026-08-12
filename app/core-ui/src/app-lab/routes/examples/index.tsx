import { createFileRoute } from '@tanstack/react-router';

import ExamplesFeat from '../../features/examples/Examples.feat';

export const Route = createFileRoute('/examples/')({
  component: () => {
    return <ExamplesFeat />;
  },
  beforeLoad: () => {
    return {
      section: 'examples',
    };
  },
});
