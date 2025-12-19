// eslint disable for file ban-ts-comment
/* eslint @typescript-eslint/ban-ts-comment: 0 */

import { Config } from '@cloud-editor-mono/common';
import { useContext, useEffect, useState } from 'react';

import { ComponentContext } from '../component/componentContext';

type UseHotjar = () => {
  ready: boolean;
};
let genericSurveyRequestEventTriggered = false;
export const useHotjarTracking: UseHotjar = function (): ReturnType<UseHotjar> {
  const { isIotComponent } = useContext(ComponentContext);

  const [hotjarReady, setHotjarReady] = useState(false);

  useEffect(() => {
    const _isIotComponent = isIotComponent;
    if (_isIotComponent || Config.MODE === 'development') return;

    const hotjarScriptId = 'hotjar-script';
    (function (h, o, t, j, a, r): void {
      h.hj =
        h.hj ||
        function (): void {
          // @ts-ignore
          // eslint-disable-next-line prefer-rest-params
          (h.hj.q = h.hj.q || []).push(arguments);
        };
      h._hjSettings = { hjid: 1036685, hjsv: 6 };
      // @ts-ignore
      a = o.getElementsByTagName('head')[0];
      // @ts-ignore
      r = o.createElement('script');
      // @ts-ignore
      r.setAttribute('id', hotjarScriptId);
      // @ts-ignore
      r.async = 1;
      // @ts-ignore
      r.src = t + h._hjSettings.hjid + j + h._hjSettings.hjsv;
      // @ts-ignore
      a.appendChild(r);
    })(window, document, 'https://static.hotjar.com/c/hotjar-', '.js?sv=');

    setHotjarReady(true);

    return () => {
      if (_isIotComponent) return;

      delete window._hjSettings;
      delete window.hj;

      const hotjarScript = document.getElementById(hotjarScriptId);
      if (hotjarScript) {
        hotjarScript.remove();
      }
    };
  }, [isIotComponent]);

  useEffect(() => {
    if (
      (hotjarReady || isIotComponent) &&
      !genericSurveyRequestEventTriggered &&
      'hj' in window &&
      typeof window.hj === 'function'
    ) {
      window.hj('event', 'generic_survey_request');
      genericSurveyRequestEventTriggered = true;
    }
  }, [hotjarReady, isIotComponent]);

  return {
    ready: !!(hotjarReady || isIotComponent || Config.MODE === 'development'),
  };
};
