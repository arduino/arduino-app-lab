import { useTooltip } from '../../tooltip';

interface WrapperTitleProps {
  title?: string;
  children: React.ReactNode;
  id?: string;
  className?: string;
}

const WrapperTitle: React.FC<WrapperTitleProps> = (
  props: WrapperTitleProps,
) => {
  const { title, children, className, id } = props;

  const { props: tooltipProps, renderTooltip } = useTooltip({
    content: title,
    timeout: 0,
    renderDelay: 1000,
    tooltipType: 'title',
  });

  return (
    <div {...tooltipProps} id={id} className={className}>
      {children}
      {title ? renderTooltip() : null}
    </div>
  );
};

export default WrapperTitle;
