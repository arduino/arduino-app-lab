import { useMatch, useNavigate } from '@tanstack/react-location';
import { useEffect } from 'react';

import { SKETCH_ID_ROUTE_PARAM } from '../../../routing/routing.type';

export function useComponent(
  sketchId?: string,
  profileIsLoading?: boolean,
): unknown {
  const navigate = useNavigate();
  const {
    params: { [SKETCH_ID_ROUTE_PARAM]: sketchIDParam },
  } = useMatch();

  useEffect(() => {
    if (
      profileIsLoading ||
      !sketchId ||
      (sketchId && sketchIDParam === sketchId)
    )
      return;

    navigate({
      to: `/${sketchId}`,
      replace: true,
    });
  }, [navigate, profileIsLoading, sketchIDParam, sketchId]);

  return {};
}
