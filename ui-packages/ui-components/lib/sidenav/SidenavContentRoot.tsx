import { SidenavContext } from './context/sidenavContext';
import { SidenavItemWithId, UseSidenavLogic } from './sidenav.type';
import SidenavContent from './SidenavContent';
import { header, icons, sections } from './sidenavSpec';

interface SidenavContentRootProps {
  sidenavSharedLogic: ReturnType<UseSidenavLogic>['sidenavSharedLogic'];
  activeItem: SidenavItemWithId;
  contentLogicMap: ReturnType<UseSidenavLogic>['contentLogicMap'];
  headerLogicMap: ReturnType<UseSidenavLogic>['headerLogicMap'];
  sectionKey: ReturnType<UseSidenavLogic>['sectionKey'];
  currentSidenavPanelWidth: number;
}

const SidenavContentRoot: React.FC<SidenavContentRootProps> = (
  props: SidenavContentRootProps,
) => {
  const {
    sidenavSharedLogic,
    activeItem,
    contentLogicMap,
    headerLogicMap,
    sectionKey,
    currentSidenavPanelWidth,
  } = props;

  return (
    <SidenavContext.Provider
      value={{ ...sidenavSharedLogic(), currentSidenavPanelWidth }}
    >
      <SidenavContent
        key={`${activeItem.id}-section-content-key`}
        sectionItem={activeItem}
        sectionLogic={contentLogicMap[activeItem.id]}
        renderSection={sections[activeItem.id]}
        headerLogic={headerLogicMap[activeItem.id]}
        renderHeader={header[activeItem.id]}
        sectionKey={sectionKey}
        Icon={icons[activeItem.id]}
      />
    </SidenavContext.Provider>
  );
};

export default SidenavContentRoot;
