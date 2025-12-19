export type AppState = {
  previousState?: string;
  previousHref?: string;
};

export enum Auth0GetTokenError {
  Timeout = 'timeout',
  LoginRequired = 'login_required',
  InteractionRequired = 'interaction_required',
}
