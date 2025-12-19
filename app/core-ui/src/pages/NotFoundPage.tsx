import NotFound from '../cloud-editor/features/not-found/NotFound.feat';
import NotFoundProvider from '../common/providers/NotFoundProvider';
import { NotFoundType } from '../routing/routing.type';
import { PageProps } from './page.type';

type NotFoundPageProps = PageProps & {
  notFoundType: NotFoundType;
};

const NotFoundPage: React.FC<NotFoundPageProps> = (
  props: NotFoundPageProps,
) => {
  const { notFoundType, profile, profileIsLoading } = props;

  return (
    <NotFoundProvider profile={profile} profileIsLoading={profileIsLoading}>
      <NotFound notFoundType={notFoundType} />
    </NotFoundProvider>
  );
};

export default NotFoundPage;
