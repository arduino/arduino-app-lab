import { createFileRoute, useParams } from '@tanstack/react-router';

import LearnDetail from '../../features/learn-detail/LearnDetail.feat';
import { DETAIL_PATH_BY_SECTION } from '../../routes/__root';

const LearnResourceDetail: React.FC = () => {
  const { resourceId } = useParams({ from: DETAIL_PATH_BY_SECTION['learn'] });
  return <LearnDetail resourceId={resourceId} />;
};

export const Route = createFileRoute('/learn/$resourceId')({
  component: LearnResourceDetail,
});
