import { ExamplesSection as Root } from './ExamplesSection';
import { CountBadge } from './subcomponents/CountBadge';
import { Header } from './subcomponents/Header';
import { Row } from './subcomponents/Row';
import { Table } from './subcomponents/Table';

export const ExamplesSection = Object.assign(Root, {
  Header,
  CountBadge,
  Table,
  Row,
});

export * from './ExamplesSection';
