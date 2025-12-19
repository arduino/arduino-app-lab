import { Config } from '@cloud-editor-mono/common';
import {
  DefaultGenerics,
  Navigate,
  Outlet,
  parseSearchWith,
  ReactLocation,
  Route,
  Router as LocationRouter,
  stringifySearchWith,
} from '@tanstack/react-location';

import ErrorPageBoundary from '../ErrorPageBoundary';
import { MainPageProps } from '../pages/MainPage';
import NotFoundPage from '../pages/NotFoundPage';
import { SerialMonitorPageProps } from '../pages/SerialMonitorPage';
import { getLazyComponents } from './lazyComponents';
import { decodeFromBinary, encodeToBinary } from './routerUtils';
import { NotFoundType, SKETCH_ID_ROUTE_PARAM } from './routing.type';

export const defaultLocationConfig = {
  parseSearch: parseSearchWith((value) => JSON.parse(decodeFromBinary(value))),
  stringifySearch: stringifySearchWith((value) =>
    encodeToBinary(JSON.stringify(value)),
  ),
};

const location = new ReactLocation(defaultLocationConfig);

const { MainPage, SerialMonitorPage } = getLazyComponents();

const MONITOR_STRING = 'monitor';
const EXAMPLES_STRING = 'examples';
const LIBRARIES_STRING = 'libraries';
const NOT_FOUND_STRING = 'notfound';
const REDIRECT_STRING = 'redirect';

export const SUB_ROUTE_STRINGS = [
  MONITOR_STRING,
  EXAMPLES_STRING,
  LIBRARIES_STRING,
  NOT_FOUND_STRING,
  REDIRECT_STRING,
];

export const MAIN_PATH = '/';

export const MONITOR_PATH =
  MAIN_PATH !== '/' ? `${MAIN_PATH}/${MONITOR_STRING}` : MONITOR_STRING;

export const EXAMPLES_MATCH_PATH = `${
  MAIN_PATH !== '/' ? `/${MAIN_PATH}/` : MAIN_PATH
}${EXAMPLES_STRING}`;

export const LIBRARIES_MATCH_PATH = `${
  MAIN_PATH !== '/' ? `/${MAIN_PATH}/` : MAIN_PATH
}${LIBRARIES_STRING}`;

export const SKETCH_NOT_FOUND_MATCH_PATH = `${
  MAIN_PATH !== '/' ? `/${MAIN_PATH}/` : MAIN_PATH
}${NOT_FOUND_STRING}`;

export const EXAMPLE_NOT_FOUND_MATCH_PATH = `${EXAMPLES_MATCH_PATH}/${NOT_FOUND_STRING}`;

export const LIBRARY_NOT_FOUND_MATCH_PATH = `${LIBRARIES_MATCH_PATH}/${NOT_FOUND_STRING}`;

export const REDIRECT_MATCH_PATH = `${
  MAIN_PATH !== '/' ? `/${MAIN_PATH}/` : MAIN_PATH
}${REDIRECT_STRING}`;

export const notFoundRouteMap: { [K in NotFoundType]: string } = {
  Sketch: SKETCH_NOT_FOUND_MATCH_PATH,
  Example: EXAMPLE_NOT_FOUND_MATCH_PATH,
  Library: LIBRARY_NOT_FOUND_MATCH_PATH,
};

const NavigateToRoot = (
  <Navigate
    to={MAIN_PATH}
    from={{ pathname: MAIN_PATH !== '/' ? '/' : Config.ROUTING_BASE_URL }}
    fromCurrent={false}
  />
);

const fallbackRoute: Route<DefaultGenerics> = {
  element: NavigateToRoot,
};

const createSerialMonitorRoute = (
  serialMonitorPageProps?: SerialMonitorPageProps,
): Route<DefaultGenerics> => ({
  path: MONITOR_PATH,
  element: <SerialMonitorPage {...serialMonitorPageProps} />,
});

const createMainRoute = (
  mainPageProps?: MainPageProps,
): Route<DefaultGenerics> => {
  return MAIN_PATH === '/'
    ? {
        path: `:${SKETCH_ID_ROUTE_PARAM}`,
        element: <MainPage {...mainPageProps} />,
      }
    : {
        path: MAIN_PATH,
        children: [
          {
            path: `:${SKETCH_ID_ROUTE_PARAM}`,
            element: <MainPage {...mainPageProps} />,
          },
          fallbackRoute,
        ],
      };
};

const createExamplesRoute = (
  mainPageProps?: MainPageProps,
): Route<DefaultGenerics> => ({
  path: EXAMPLES_MATCH_PATH,
  element: <MainPage {...mainPageProps} />,
});

const createLibrariesRoute = (
  mainPageProps?: MainPageProps,
): Route<DefaultGenerics> => ({
  path: LIBRARIES_MATCH_PATH,
  element: <MainPage {...mainPageProps} />,
});

const createRedirectRoute = (
  props?: MainPageProps,
): Route<DefaultGenerics> => ({
  path: REDIRECT_MATCH_PATH,
  element: <MainPage {...props} />,
});

const createNotFoundRoutes = (
  mainPageProps?: MainPageProps,
): Route<DefaultGenerics>[] => [
  {
    path: LIBRARY_NOT_FOUND_MATCH_PATH,
    element: <NotFoundPage {...mainPageProps} notFoundType={'Library'} />,
  },
  {
    path: SKETCH_NOT_FOUND_MATCH_PATH,
    element: <NotFoundPage {...mainPageProps} notFoundType={'Sketch'} />,
  },
  {
    path: EXAMPLE_NOT_FOUND_MATCH_PATH,
    element: <NotFoundPage {...mainPageProps} notFoundType={'Example'} />,
  },
];

export const createRoutes = (
  mainPageProps?: MainPageProps,
  serialMonitorPageProps?: SerialMonitorPageProps,
): Route<DefaultGenerics>[] => {
  return [
    ...createNotFoundRoutes(mainPageProps),
    createSerialMonitorRoute(serialMonitorPageProps),
    createRedirectRoute(mainPageProps),
    createExamplesRoute(mainPageProps),
    createLibrariesRoute(mainPageProps),
    createMainRoute(mainPageProps),
    fallbackRoute,
  ];
};

const routes: Route<DefaultGenerics>[] = createRoutes();

export interface RouterProps {
  routes?: Route<DefaultGenerics>[];
  location?: ReactLocation<DefaultGenerics>;
  renderOutletContextProvider?: (children?: React.ReactNode) => React.ReactNode;
}

export const Router: React.FC<RouterProps> = (props: RouterProps) => {
  const {
    location: propLoc,
    routes: propRoutes,
    renderOutletContextProvider,
  } = props;

  const outletWithErrorBoundary = (
    <ErrorPageBoundary>
      <Outlet />
    </ErrorPageBoundary>
  );

  return (
    <LocationRouter
      location={propLoc || location}
      basepath={Config.ROUTING_BASE_URL}
      routes={propRoutes || routes}
    >
      {renderOutletContextProvider
        ? renderOutletContextProvider(outletWithErrorBoundary)
        : outletWithErrorBoundary}
    </LocationRouter>
  );
};
