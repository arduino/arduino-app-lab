import {
  Claude,
  Codex,
  Gemini,
  GitHub,
  OpenCode,
  Sparkle,
} from '@cloud-editor-mono/images/assets/icons';

import styles from './provider-logo.module.scss';

const PROVIDER_LOGOS: Record<string, React.FC> = {
  google: Gemini,
  opencode: OpenCode,
  anthropic: Claude,
  openai: Codex,
  openrouter: Sparkle,
  'github-copilot': GitHub,
};

type ProviderLogoProps = {
  providerId: string;
  small?: boolean;
};

// An empty box for a provider with no logo, so every name in a list starts at the same x.
export const ProviderLogo: React.FC<ProviderLogoProps> = ({
  providerId,
  small,
}) => {
  const Logo = PROVIDER_LOGOS[providerId];
  return (
    <span
      className={small ? styles['logo-small'] : styles['logo']}
      aria-hidden="true"
    >
      {Logo && <Logo />}
    </span>
  );
};

export default ProviderLogo;
