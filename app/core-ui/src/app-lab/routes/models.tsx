import { createFileRoute } from '@tanstack/react-router';

import Models from '../features/models/Models.feat';

export const Route = createFileRoute('/models')({
  component: Models,
});
