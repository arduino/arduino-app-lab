const CUSTOM_CLAIMS_NAMESPACE = 'http://arduino.cc' as const;

export const USER_CLAIM_BIRTHDAY =
  `${CUSTOM_CLAIMS_NAMESPACE}/birthday` as const;
export const USER_CLAIM_CONNECTION =
  `${CUSTOM_CLAIMS_NAMESPACE}/connection` as const;
export const USER_CLAIM_HAS_CONSENT =
  `${CUSTOM_CLAIMS_NAMESPACE}/consent` as const;
export const USER_CLAIM_HAS_PASSWORD =
  `${CUSTOM_CLAIMS_NAMESPACE}/has_password` as const;
export const USER_CLAIM_ID = `${CUSTOM_CLAIMS_NAMESPACE}/id` as const;
export const USER_CLAIM_LOGINS = `${CUSTOM_CLAIMS_NAMESPACE}/logins` as const;
export const USER_CLAIM_ROLES = `${CUSTOM_CLAIMS_NAMESPACE}/roles` as const;
export const USER_CLAIM_USERNAME =
  `${CUSTOM_CLAIMS_NAMESPACE}/username` as const;
export const USER_CLAIM_IS_MINOR =
  `${CUSTOM_CLAIMS_NAMESPACE}/is_minor` as const;
