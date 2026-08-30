import SvgStoveNameplateBlue from './stove-nameplate-blue.svg';
import sidebarSections from './SidebarSections.json'


export default function NavigationSidebar() {
  function SectionGroup({groupName, sections}) {
    const sectionItems = sections.map(section => 
        <li className={`section-navigation-item ${section.disabled ? 'section-navigation-item-disabled' : ''}`}><a href={section.path}>{section.name}</a></li>
    )
    return <ul className="section-navigation-grouping">
      <span className="section-navigation-title">{groupName}</span>
      {sectionItems}
    </ul>
  }

  let sectionGroups = [];

  for (const group of sidebarSections) {
    console.log(group)
    sectionGroups.push(
        <SectionGroup groupName={group.name} sections={group.sections} />
    )
  }

  return <div class="navigation-panel">
            <div className="stove-logo-container"><a href="/stove"><SvgStoveNameplateBlue className="stove-logo"/></a></div>
          {sectionGroups}
  </div>
}