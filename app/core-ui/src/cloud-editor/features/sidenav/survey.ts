import { SurveyType } from '@cloud-editor-mono/ui-components';
import { PressEvent } from '@react-aria/interactions';

const createSurveyTriggerElement = (
  parent: Element,
  type: SurveyType,
): Element => {
  const placeholderID = `ce-gen-ai-survey-placeholder-${type}`;
  let triggerElement = document.getElementById(placeholderID);

  if (triggerElement) {
    return triggerElement;
  }

  triggerElement = document.createElement('div');
  triggerElement.id = placeholderID;
  triggerElement.style.position = 'fixed';
  triggerElement.style.zIndex = '999999';
  triggerElement.style.bottom = '12px';
  triggerElement.style.left = '32px';
  triggerElement.addEventListener('click', (event) => event.stopPropagation());
  parent.after(triggerElement);

  return triggerElement;
};

const removeElementOnClickOutside = (triggerElement: Element): void => {
  const callback = (e: MouseEvent): void => {
    if (!triggerElement || !(e.target instanceof HTMLElement)) {
      return;
    }
    if (!triggerElement.contains(e.target)) {
      triggerElement.remove();
      document.removeEventListener('click', callback);
    }
  };

  document.addEventListener('click', callback);
};

const observeSurvey = (triggerElement: Element, chatHistory: string): void => {
  const surveyObserver = new MutationObserver(async () => {
    const surveyElement = triggerElement.querySelector(
      '[data-testid="survey-root"]',
    );

    // Fix survey moving when page change
    if (surveyElement) {
      (surveyElement.firstChild as HTMLElement).style.margin = '0';
    }

    const isSurveyFinished = surveyElement?.getAttribute('isclosed');
    const isChatHistorySection = surveyElement?.textContent?.includes(
      'send the conversation',
    );
    const chatHistoryInput = surveyElement?.getElementsByTagName('textarea')[0];

    if (
      isChatHistorySection &&
      chatHistoryInput &&
      // Since mutation observer is set to execute on attribute change,
      // this check avoid infinite loop for the following statements
      !chatHistoryInput.disabled
    ) {
      chatHistoryInput.disabled = true;
      // Pre-fill textarea with chat history
      chatHistoryInput.value = chatHistory;
      chatHistoryInput.dispatchEvent(new Event('input', { bubbles: true }));
      chatHistoryInput.style.backgroundColor = '#f5f5f5';

      const nextButton = triggerElement?.getElementsByTagName('button')[0];

      if (nextButton) {
        nextButton.disabled = false;
      }
    }

    if (isSurveyFinished) {
      // Remove original trigger element the wraps the survey
      // This also allow to garbage collect the observer
      triggerElement.remove();
    }
  });

  surveyObserver.observe(triggerElement, {
    subtree: true,
    childList: true,
    attributes: true,
  });
};

export function triggerSurvey(
  event: PressEvent,
  type: SurveyType,
  chatHistory: string,
): void {
  if ('hj' in window && typeof window.hj === 'function') {
    const triggerElement = createSurveyTriggerElement(event.target, type);

    removeElementOnClickOutside(triggerElement);

    window.hj(
      'event',
      type === 'positive'
        ? 'ce_genai_survey_request_positive'
        : 'ce_genai_survey_request_negative',
    );

    observeSurvey(triggerElement, chatHistory);
  }
}
