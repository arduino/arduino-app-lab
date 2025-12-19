import { ArduinoUser } from '@bcmi-labs/art-auth';
import { Config } from '@cloud-editor-mono/common';
import { loadCSS, loadScript } from '@cloud-editor-mono/common';
import {
  USER_CLAIM_ID,
  USER_CLAIM_IS_MINOR,
} from '@cloud-editor-mono/infrastructure';

import { injectedUser, retrieveAuth0User } from '../arduino-auth';
import {
  EmitTrackingEvent,
  TrackingEventDynamicPayload,
  TrackingEventFixedPayload,
  TrackingEventKey,
} from './analyticsService.type';

let isInitialized = false;
let isEnabled = false;

// Enrich the window object with analytics services.
declare global {
  interface Window extends Record<string, unknown> {
    dataLayer: {
      push: (event: Record<string, unknown>) => void;
    };
    arduinoCookieSolution: {
      initCookieConsent: (isAdult: boolean) => void;
    };
    _iub: {
      cs: {
        consent: {
          purposes: { [key: string]: boolean };
        };
      };
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    analytics: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    profitwell: (event: string, data: any) => void;
  }
}

/**
 * Initialize Google Analytics.
 */
async function initGA(): Promise<void> {
  await loadScript(
    `https://www.googletagmanager.com/gtm.js?id=${Config.GTM_ID}`,
    'gtm-script',
  );

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });

  // Push page metadata to the data layer
  window.dataLayer.push({
    event: 'pageMetaData',
    page: {
      type: 'content',
      title: 'Arduino Cloud Editor',
      path: window.location.pathname,
      environment: '%VITE_HF_CDN_ENV%',
      region: 'global',
      brand: 'arduino',
      language: 'EN',
    },
  });
}

/**
 * Initialize Segment analytics.
 */
async function initSegment(): Promise<void> {
  const analytics = window.analytics || [];
  window.analytics = analytics;
  if (analytics.initialize) return;

  if (analytics.invoked) {
    console.error('Segment snippet included twice.');
    return;
  }

  analytics.invoked = !0;
  analytics.methods = [
    'trackSubmit',
    'trackClick',
    'trackLink',
    'trackForm',
    'pageview',
    'identify',
    'reset',
    'group',
    'track',
    'ready',
    'alias',
    'debug',
    'page',
    'screen',
    'once',
    'off',
    'on',
    'addSourceMiddleware',
    'addIntegrationMiddleware',
    'setAnonymousId',
    'addDestinationMiddleware',
    'register',
  ];
  analytics.factory = (e: string) => () => {
    // eslint-disable-next-line prefer-rest-params
    const i = Array.prototype.slice.call(arguments);
    if (
      ['track', 'screen', 'alias', 'group', 'page', 'identify'].indexOf(e) > -1
    ) {
      const c = document.querySelector("link[rel='canonical']");
      i.push({
        __t: 'bpc',
        c: (c && c.getAttribute('href')) || undefined,
        p: window.location.pathname,
        u: window.location.href,
        s: window.location.search,
        t: document.title,
        r: document.referrer,
      });
    }
    i.unshift(e);
    analytics.push(i);
    return analytics;
  };

  analytics.methods.forEach((i: string) => {
    const key = analytics.methods[i];
    analytics[key] = analytics.factory(key);
  });

  analytics._writeKey = Config.SEGMENT_TOKEN;
  analytics._cdn = 'https://evs.aayinltcs.arduino.cc';
  analytics.SNIPPET_VERSION = '5.2.0';

  analytics.load = async (e: string): Promise<void> => {
    await loadScript(Config.SEGMENT_SCRIPT, 'segment-script');
    analytics._loadOptions = e;
  };

  return analytics.load(analytics._writeKey);
}

/**
 * Initialize Iubenda Cookie Solution.
 */
async function initCookieSolution(profile: ArduinoUser): Promise<void> {
  loadCSS(`${Config.HF_CDN_URL}/cookieSolution.css`);
  await loadScript(`${Config.HF_CDN_URL}/cookieSolution.js`, 'cookieSolution');

  // Initialize Iubenda
  const coppa =
    profile[USER_CLAIM_IS_MINOR] === undefined
      ? false
      : !profile[USER_CLAIM_IS_MINOR];
  window.arduinoCookieSolution.initCookieConsent(coppa);
}

/**
 * The `analyticsBootstrap` function initializes various analytics tools and triggers page tracking.
 * - Loads Iubenda Cookie Solution
 * - Loads Google Analytics (and fires some events)
 * - Loads Segment
 * - Evaluates Iubenda consent and triggers page tracking
 * - Triggers identify event for Profitwell (loaded via Segment)
 */
async function analyticsBootstrap(profile: ArduinoUser): Promise<boolean> {
  if (Config.MODE === 'development') return false;

  isEnabled = true;

  const IUBENDA_MONITORING_INDEX = 4;

  async function exist(
    predicate: () => boolean,
    retry = 0,
    delay = 1000,
  ): Promise<void> {
    return new Promise<void>((res, rej) => {
      if (retry > 10) rej();
      if (predicate()) res();
      else setTimeout(() => exist(predicate, retry + 1).then(res), delay);
    });
  }

  await initCookieSolution(profile);
  await initGA();
  await initSegment();

  // Start Segment
  exist(
    () =>
      !!window.analytics?.page &&
      !!window._iub &&
      window._iub?.cs?.consent?.purposes[IUBENDA_MONITORING_INDEX],
  )
    .then(() => window.analytics.page())
    .catch(() => console.warn('Page not triggered!'));

  // Start Profitwell (via Segment)
  if (import.meta.env.PROD) {
    exist(() => !!window.analytics?.identify && !!window._iub)
      .then(() => {
        const statisticCookie =
          window._iub?.cs?.consent?.purposes[IUBENDA_MONITORING_INDEX];
        window.analytics.identify(
          profile[USER_CLAIM_ID],
          { email: profile.email },
          {
            integrations: {
              All: false,
              'Segment.io': statisticCookie,
              ProfitWell: statisticCookie,
            },
          },
        );
      })
      .catch(() => console.warn('Profitwell not triggered!'));
  }

  // ** avoids race condition where `ga4Emitter` is fired before `window.analytics` is ready
  try {
    await exist(
      () => !!window.analytics?.track && !!window.analytics?.identify,
    );
    isInitialized = true;
  } catch (error) {
    console.warn('Analytics could not be initialized');
  }

  return isInitialized;
}

// ** Below is an impl. of `ga4Emitter` from `cloud-website`
// ** the overall pattern is the same, but adapted to reflect cloud editor specific events
function fixedPayloadEnricher<T extends TrackingEventKey>(
  event: T,
): Partial<TrackingEventFixedPayload[T]>;
function fixedPayloadEnricher(
  event: TrackingEventKey,
): Partial<TrackingEventFixedPayload[keyof TrackingEventFixedPayload]> {
  switch (event) {
    case 'INIT':
      return {
        event: 'web_editor_initiate',
      };
    case 'COMPILE':
      return {
        event: 'web_editor_compile',
      };
    case 'UPLOAD':
      return {
        event: 'web_editor_upload',
      };
    case 'SKETCH_MOD':
      return {
        event: 'editor_sketch_interaction',
      };
    case 'BOARD_CHANGE':
      return {
        event: 'editor_board_selection',
      };
    case 'EXAMPLE_SELECT':
      return {
        event: 'editor_examples',
      };
    case 'LIBRARY_SELECT':
      return {
        event: 'editor_libraries',
      };
    case 'LIBRARY_FAVORITE':
      return {
        event: 'editor_libraries',
        action: 'add to favorites',
      };
    case 'REFERENCE_VIEW':
      return {
        event: 'editor_reference',
        action: 'view_reference',
      };
    case 'GEN_AI_INTERACTION':
      return {
        event: 'ai_interaction',
      };
    default:
      return {};
  }
}

export async function ga4Emitter<K extends keyof TrackingEventDynamicPayload>({
  type,
  payload = undefined,
}: EmitTrackingEvent<K>): Promise<void> {
  if (!isEnabled || Config.MODE === 'development') {
    // Avoid printing console.error if not used
    return;
  }

  if (!isInitialized) {
    console.error('Tried to emit event before analytics was initialized');
    return;
  }

  let profile = injectedUser;

  if (!profile) {
    try {
      profile = await retrieveAuth0User();
    } catch (error) {
      console.error('Error retrieving user profile for event emission');
      return;
    }
  }

  if (!profile) {
    console.error('Tried to emit event without a user profile');
    return;
  }

  try {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      ...fixedPayloadEnricher(type),
      ...payload,
      site_area: 'editor',
      user_id: profile[USER_CLAIM_ID],
    });
  } catch (error) {
    console.error(`Error tracking event [${type}] with args [${payload}]`);
  }
}

export function setAnalyticsFlags(value: boolean): void {
  isEnabled = value;
  isInitialized = value;
}

export { analyticsBootstrap };
