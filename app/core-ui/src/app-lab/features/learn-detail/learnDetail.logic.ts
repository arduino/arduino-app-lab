import {
  getLearnResource as getLearnResourceApi,
  openLinkExternal,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import {
  LearnResource,
  mapAssetSources,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useQuery } from '@tanstack/react-query';
import { useCanGoBack, useNavigate, useRouter } from '@tanstack/react-router';
import { useCallback, useEffect, useRef } from 'react';

import { UseLearnDetailLogic } from './learnDetail.type';

function scrollTop(ref: React.RefObject<HTMLDivElement>): void {
  // wait for layout+paint
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (ref.current && ref.current.scrollTop !== 0) {
        ref.current.scrollTop = 0;
      }
    });
  });
}

async function getLearnResource(resourceId: string): Promise<LearnResource> {
  const resource = await getLearnResourceApi(resourceId);
  if (resource) {
    resource.content = mapAssetSources(
      resource.content,
      (path) => `/learn-assets/${resourceId}/${path}`,
    );
  }
  return resource;
}

export const useLearnDetailLogic = function (
  resourceId: string,
): UseLearnDetailLogic {
  const { data: learnResource, isLoading: getLearnResourceLoading } = useQuery(
    ['learn-resource-', resourceId],
    () => getLearnResource(resourceId),
    {
      refetchOnWindowFocus: false,
      enabled: Boolean(resourceId),
    },
  );

  const router = useRouter();
  const canGoBack = useCanGoBack();
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const navigate = useNavigate({ from: `/learn/${resourceId}` });
  const prevUrlRef = useRef<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Scroll to top on route change, if no hash is present
  useEffect(() => {
    const unsubscribe = router.subscribe(
      'onResolved',
      ({ fromLocation, toLocation }) => {
        if (fromLocation) {
          prevUrlRef.current = fromLocation.pathname;
        }
        if (!toLocation.hash) {
          scrollTop(contentRef);
        }
      },
    );

    return unsubscribe;
  }, [router]);

  const goBack = useCallback(() => {
    // In case we want to re-enable going back to previous page in the future:
    // const currentUrl = router.state.location.pathname;
    // const prevUrl = prevUrlRef.current;
    // if (canGoBack && prevUrl !== currentUrl) {
    //   router.history.back();
    // } else {
    //   router.navigate({ to: '/learn' }); // fallback
    // }
    router.navigate({ to: '/learn' });
  }, [router]);

  const openInternalLink = useCallback(
    (url: string) => {
      if (url.startsWith('#')) {
        console.warn(
          `Anchor links should follow the path pattern /<type>/<resourceId>#<anchor>, got: ${url}`,
        );
        return;
      }

      const parts = url.split('/');
      const targetResourceId = parts.length > 2 ? parts[2] : '';

      switch (true) {
        case url.startsWith('/learn'): {
          if (targetResourceId) {
            const [cleanId, anchor] = targetResourceId.split('#');

            navigate({
              to: '/learn/$resourceId',
              params: { resourceId: cleanId },
              ...(anchor && { hash: anchor }),
            });
          } else {
            console.warn(`Invalid internal link: ${url}, missing resourceId`);
          }
          return;
        }
        case url.startsWith('/examples'):
          navigate({ to: '/examples' });
          return;
        case url.startsWith('/bricks'):
          navigate({ to: '/bricks' });
          return;
        default:
          console.warn(`Unsupported internal link: ${url}`);
          return;
      }
    },
    [navigate],
  );

  return {
    resource: learnResource,
    isLoading: getLearnResourceLoading,
    contentRef,
    goBack,
    openExternalLink: openLinkExternal,
    openInternalLink,
  };
};
