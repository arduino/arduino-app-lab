import { SettingsSection as Root } from './SettingsSection';
import { Banner } from './subcomponents/Banner';
import { Card } from './subcomponents/Card';
import { CardHeader } from './subcomponents/CardHeader';
import { Divider } from './subcomponents/Divider';
import { ExternalLink } from './subcomponents/ExternalLink';
import { Info } from './subcomponents/Info';
import { Row } from './subcomponents/Row';
import { Title } from './subcomponents/Title';
import { UpToDateBadge } from './subcomponents/UpToDateBadge';

export const SettingsSection = Object.assign(Root, {
  Banner,
  Card,
  CardHeader,
  Divider,
  ExternalLink,
  Info,
  Row,
  Title,
  UpToDateBadge,
});

export * from './SettingsSection';
