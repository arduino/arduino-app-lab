import { useTooltip } from '../../tooltip';

interface WrapperTitleProps {
  title?: string;
  children: React.ReactNode;
  id?: string;
  classNames?: {
    container?: string;
    tooltip?: string;
  };
}

const WrapperTitle: React.FC<WrapperTitleProps> = (
  props: WrapperTitleProps,
) => {
  const { title, children, classNames, id } = props;

  const { props: tooltipProps, renderTooltip } = useTooltip({
    content: title,
    timeout: 0,
    renderDelay: 1000,
    tooltipType: 'title',
    direction: 'down',
  });

  return (
    <div {...tooltipProps} id={id} className={classNames?.container}>
      {children}
      {title ? renderTooltip(classNames?.tooltip) : null}
    </div>
  );
};

export default WrapperTitle;
