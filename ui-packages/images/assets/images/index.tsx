import React from 'react';

import _genAiBanner from './gen-ai-banner.png';
import _genAiBannerBg from './gen-ai-banner-bg.png';
import _userAvatar from './user-avatar.png';

const userAvatar = (
  <img src={_userAvatar} alt="User avatar" width="52" height="52" />
);
const genAiBanner = <img src={_genAiBanner} alt="Gen AI Banner" />;
const genAiBannerBg = (
  <img src={_genAiBannerBg} alt="Gen AI Banner Background" />
);

export { genAiBanner, genAiBannerBg, userAvatar };
